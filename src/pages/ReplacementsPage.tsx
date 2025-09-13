import React, { useState, useEffect, useMemo } from 'react';
import { createParisDate, formatParisDate, parseParisDate } from '@/utils/timezoneUtils';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from "../lib/firebase/config";
import { frLocale } from '../utils/dateLocale';
import { useUsers } from '../features/auth/hooks/useUsers';
import { AlertTriangle, Download, X, Check, Search, Trash2, Users, Calendar, Clock, BarChart3 } from 'lucide-react';
import { useAuth } from '../features/auth/hooks/useAuth';
import * as XLSX from 'xlsx';
import { ReplacementExportModal } from '../components/ReplacementExportModal';

interface Replacement {
  id: string;
  exchangeId: string;
  date: string;
  period: string;
  shiftType: string;
  timeSlot: string;
  originalUserId: string;
  createdAt: string;
  status: 'pending' | 'notified' | 'filled' | 'assigned';
  notifiedUsers: string[];
  replacementName?: string;
  assignedAt?: string;
  assignedBy?: string;
}

const periodNames = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};

const periodOrder = { 'M': 1, 'AM': 2, 'S': 3 };

type SortMode = 'byDoctor' | 'byDate' | 'byPeriod' | 'byStatus';

const ReplacementsPage: React.FC = () => {
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replacementNames, setReplacementNames] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('byDoctor');
  const [showExportModal, setShowExportModal] = useState(false);
  const { users } = useUsers();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchReplacements = async () => {
      try {
        setLoading(true);
        const replacementsQuery = query(
          collection(db, 'remplacements'),
          orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(replacementsQuery);
        const replacementsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Replacement[];
        
        setReplacements(replacementsData);
        
        // Initialiser les noms des remplaçants
        const names: Record<string, string> = {};
        replacementsData.forEach(r => {
          if (r.replacementName) {
            names[r.id] = r.replacementName;
          }
        });
        setReplacementNames(names);
      } catch (error) {
        console.error('Error fetching replacements:', error);
        setError('Une erreur est survenue lors du chargement des remplacements.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReplacements();
  }, []);

  const handleAssignReplacement = async (replacementId: string) => {
    const name = replacementNames[replacementId]?.trim();
    if (!name) return;

    try {
      setSavingIds(prev => new Set(prev).add(replacementId));
      
      const replacementRef = doc(db, 'remplacements', replacementId);
      await updateDoc(replacementRef, {
        replacementName: name,
        status: 'assigned',
        assignedAt: Timestamp.now(),
        assignedBy: currentUser?.id || 'admin',
        lastModified: Timestamp.now()
      });
      
      setReplacements(prevReplacements => 
        prevReplacements.map(r => 
          r.id === replacementId 
            ? { 
                ...r, 
                replacementName: name,
                status: 'assigned',
                assignedAt: new Date().toISOString(),
                assignedBy: currentUser?.id || 'admin'
              } 
            : r
        )
      );
    } catch (error) {
      console.error('Error assigning replacement:', error);
      alert('Une erreur est survenue lors de l\'assignation du remplaçant.');
    } finally {
      setSavingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(replacementId);
        return newSet;
      });
    }
  };

  const handleRemoveReplacement = async (replacementId: string) => {
    try {
      setSavingIds(prev => new Set(prev).add(replacementId));
      
      const replacementRef = doc(db, 'remplacements', replacementId);
      await updateDoc(replacementRef, {
        replacementName: null,
        status: 'pending',
        assignedAt: null,
        assignedBy: null,
        lastModified: Timestamp.now()
      });
      
      setReplacements(prevReplacements => 
        prevReplacements.map(r => 
          r.id === replacementId 
            ? { 
                ...r, 
                replacementName: undefined,
                status: 'pending',
                assignedAt: undefined,
                assignedBy: undefined
              } 
            : r
        )
      );
      
      setReplacementNames(prev => {
        const newNames = { ...prev };
        delete newNames[replacementId];
        return newNames;
      });
    } catch (error) {
      console.error('Error removing replacement:', error);
      alert('Une erreur est survenue lors de la suppression du remplaçant.');
    } finally {
      setSavingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(replacementId);
        return newSet;
      });
    }
  };

  const handleDeleteReplacement = async (replacementId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette proposition de remplacement ?')) {
      return;
    }

    try {
      setDeletingIds(prev => new Set(prev).add(replacementId));
      
      // Récupérer le remplacement pour obtenir l'exchangeId
      const replacement = replacements.find(r => r.id === replacementId);
      const exchangeId = replacement?.exchangeId;
      
      const replacementRef = doc(db, 'remplacements', replacementId);
      await deleteDoc(replacementRef);
      
      // Si un exchangeId existe, mettre à jour l'échange dans shift_exchanges
      if (exchangeId) {
        try {
          const exchangeRef = doc(db, 'shift_exchanges', exchangeId);
          await updateDoc(exchangeRef, {
            proposedToReplacements: false,
            lastModified: Timestamp.now()
          });
          console.log('Échange mis à jour, proposedToReplacements remis à false');
        } catch (exchangeError) {
          console.error('Erreur lors de la mise à jour de l\'échange:', exchangeError);
          // On continue même si la mise à jour échoue
        }
      }
      
      // Mettre à jour l'état local
      setReplacements(prevReplacements => 
        prevReplacements.filter(r => r.id !== replacementId)
      );
      
      // Supprimer aussi le nom s'il était en cours de saisie
      setReplacementNames(prev => {
        const newNames = { ...prev };
        delete newNames[replacementId];
        return newNames;
      });
    } catch (error) {
      console.error('Error deleting replacement:', error);
      alert('Une erreur est survenue lors de la suppression.');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(replacementId);
        return newSet;
      });
    }
  };

  const exportToExcel = (options?: {
    exportType: 'simple' | 'detailed';
    dateRange: 'all' | 'custom';
    startDate?: string;
    endDate?: string;
    includeAssigned: boolean;
    includePending: boolean;
    includeMetadata: boolean;
  }) => {
    // Si pas d'options, export simple par défaut
    const exportOptions = options || {
      exportType: 'simple',
      dateRange: 'all',
      includeAssigned: true,
      includePending: true,
      includeMetadata: false
    };

    // Filtrer les données selon les options
    let dataToFilter = sortMode === 'byDate' || sortMode === 'byPeriod' || sortMode === 'byStatus'
      ? Object.values(sortedData).flat()
      : replacements;

    // Appliquer les filtres de statut
    dataToFilter = dataToFilter.filter(r => {
      if (!exportOptions.includeAssigned && (r.status === 'assigned' || r.status === 'filled')) return false;
      if (!exportOptions.includePending && (r.status === 'pending' || r.status === 'notified')) return false;
      return true;
    });

    // Appliquer les filtres de date
    if (exportOptions.dateRange === 'custom' && exportOptions.startDate && exportOptions.endDate) {
      const startDate = parseParisDate(exportOptions.startDate);
      const endDate = parseParisDate(exportOptions.endDate);
      dataToFilter = dataToFilter.filter(r => {
        const date = parseParisDate(r.date);
        return date >= startDate && date <= endDate;
      });
    }

    // Préparer les données selon le mode de tri actuel
    let dataToExport: Record<string, string | number>[] = [];
    
    if (sortMode === 'byDoctor' && exportOptions.exportType === 'simple') {
      // Export groupé par médecin pour l'export simple
      const groupedFiltered = dataToFilter.reduce((acc, r) => {
        if (!acc[r.originalUserId]) acc[r.originalUserId] = [];
        acc[r.originalUserId].push(r);
        return acc;
      }, {} as Record<string, Replacement[]>);

      Object.entries(groupedFiltered).forEach(([userId, userReplacements]) => {
        const user = users.find(u => u.id === userId);
        const userName = user ? `${user.lastName.toUpperCase()} ${user.firstName}` : 'Médecin inconnu';
        
        // Ajouter une ligne de séparation pour le médecin
        dataToExport.push({
          'Date': `=== ${userName} ===`,
          'Jour': '',
          'Période': '',
          'Type de garde': '',
          'Horaire': '',
          'Médecin': '',
          'Remplaçant': '',
          'Statut': `${userReplacements.length} garde(s)`
        });
        
        // Ajouter les remplacements du médecin
        userReplacements.forEach(r => {
          const date = parseParisDate(r.date);
          dataToExport.push({
            'Date': formatParisDate(date, 'dd/MM/yyyy'),
            'Jour': formatParisDate(date, 'EEEE', { locale: frLocale }),
            'Période': periodNames[r.period as keyof typeof periodNames],
            'Type de garde': r.shiftType,
            'Horaire': r.timeSlot || 'Non spécifié',
            'Médecin': '',
            'Remplaçant': r.replacementName || '',
            'Statut': r.status === 'assigned' ? 'Assigné' : r.status === 'filled' ? 'Pourvu' : 'En attente'
          });
        });
        
        // Ligne vide entre les médecins
        dataToExport.push({});
      });
    } else {
      // Export détaillé ou export simple non groupé
      dataToExport = dataToFilter.map(r => {
        const user = users.find(u => u.id === r.originalUserId);
        const date = parseParisDate(r.date);
        
        const baseData = {
          'Date': formatParisDate(date, 'dd/MM/yyyy'),
          'Jour': formatParisDate(date, 'EEEE', { locale: frLocale }),
          'Période': periodNames[r.period as keyof typeof periodNames],
          'Type de garde': r.shiftType,
          'Horaire': r.timeSlot || 'Non spécifié',
          'Médecin': user ? `${user.lastName.toUpperCase()} ${user.firstName}` : 'Inconnu',
          'Remplaçant': r.replacementName || '',
          'Statut': r.status === 'assigned' ? 'Assigné' : r.status === 'filled' ? 'Pourvu' : 'En attente'
        };

        if (exportOptions.exportType === 'detailed') {
          // Ajouter les colonnes supplémentaires pour l'export détaillé
          return {
            ...baseData,
            'ID Échange': r.exchangeId || '',
            'Date création': r.createdAt ? formatParisDate(parseParisDate(r.createdAt), 'dd/MM/yyyy HH:mm') : '',
            'Assigné le': r.assignedAt ? formatParisDate(parseParisDate(r.assignedAt), 'dd/MM/yyyy HH:mm') : '',
            'Assigné par': r.assignedBy || '',
            'Notifiés': r.notifiedUsers?.join(', ') || ''
          };
        }

        return baseData;
      });
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Remplacements');

    // Ajuster la largeur des colonnes
    const colWidths = exportOptions.exportType === 'detailed' 
      ? [
          { wch: 12 }, // Date
          { wch: 12 }, // Jour
          { wch: 12 }, // Période
          { wch: 15 }, // Type de garde
          { wch: 20 }, // Horaire
          { wch: 25 }, // Médecin
          { wch: 25 }, // Remplaçant
          { wch: 12 }, // Statut
          { wch: 20 }, // ID Échange
          { wch: 18 }, // Date création
          { wch: 18 }, // Assigné le
          { wch: 20 }, // Assigné par
          { wch: 30 }  // Notifiés
        ]
      : [
          { wch: 12 }, // Date
          { wch: 12 }, // Jour
          { wch: 12 }, // Période
          { wch: 15 }, // Type de garde
          { wch: 20 }, // Horaire
          { wch: 25 }, // Médecin
          { wch: 25 }, // Remplaçant
          { wch: 12 }  // Statut
        ];
    ws['!cols'] = colWidths;

    // Générer le fichier avec le mode de tri dans le nom
    const sortModeSuffix = sortMode === 'byDoctor' ? 'par_medecin' : 
                          sortMode === 'byDate' ? 'par_date' :
                          sortMode === 'byPeriod' ? 'par_periode' : 'par_statut';
    const exportTypeSuffix = exportOptions.exportType === 'detailed' ? '_detaille' : '';
    const fileName = `remplacements_${sortModeSuffix}${exportTypeSuffix}_${formatParisDate(createParisDate(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Trier et grouper les remplacements selon le mode choisi
  const sortedData = useMemo(() => {
    const filtered = replacements.filter(r => {
      if (!searchTerm) return true;
      
      const user = users.find(u => u.id === r.originalUserId);
      const userName = user ? `${user.lastName} ${user.firstName}`.toLowerCase() : '';
      const date = formatParisDate(parseParisDate(r.date), 'dd/MM/yyyy');
      const replacementName = r.replacementName?.toLowerCase() || '';
      
      return userName.includes(searchTerm.toLowerCase()) ||
             date.includes(searchTerm) ||
             replacementName.includes(searchTerm.toLowerCase()) ||
             r.shiftType.toLowerCase().includes(searchTerm.toLowerCase());
    });

    switch (sortMode) {
      case 'byDoctor': {
        // Grouper par médecin (comportement actuel)
        const grouped = filtered.reduce((acc, replacement) => {
          const userId = replacement.originalUserId;
          if (!acc[userId]) {
            acc[userId] = [];
          }
          acc[userId].push(replacement);
          return acc;
        }, {} as Record<string, Replacement[]>);

        // Trier chaque groupe par date et période
        Object.keys(grouped).forEach(userId => {
          grouped[userId].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            
            const periodA = periodOrder[a.period as keyof typeof periodOrder] || 0;
            const periodB = periodOrder[b.period as keyof typeof periodOrder] || 0;
            return periodA - periodB;
          });
        });

        return grouped;
      }

      case 'byDate': {
        // Grouper par date
        const grouped = filtered.reduce((acc, replacement) => {
          const dateKey = replacement.date;
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          acc[dateKey].push(replacement);
          return acc;
        }, {} as Record<string, Replacement[]>);

        // Trier chaque groupe par période puis par médecin
        Object.keys(grouped).forEach(dateKey => {
          grouped[dateKey].sort((a, b) => {
            const periodA = periodOrder[a.period as keyof typeof periodOrder] || 0;
            const periodB = periodOrder[b.period as keyof typeof periodOrder] || 0;
            if (periodA !== periodB) return periodA - periodB;
            
            const userA = users.find(u => u.id === a.originalUserId);
            const userB = users.find(u => u.id === b.originalUserId);
            const nameA = userA ? `${userA.lastName} ${userA.firstName}` : '';
            const nameB = userB ? `${userB.lastName} ${userB.firstName}` : '';
            return nameA.localeCompare(nameB);
          });
        });

        // Trier les dates
        const sortedDates = Object.keys(grouped).sort();
        const sortedGrouped: Record<string, Replacement[]> = {};
        sortedDates.forEach(date => {
          sortedGrouped[date] = grouped[date];
        });

        return sortedGrouped;
      }

      case 'byPeriod': {
        // Grouper par période
        const grouped = filtered.reduce((acc, replacement) => {
          const periodKey = replacement.period;
          if (!acc[periodKey]) {
            acc[periodKey] = [];
          }
          acc[periodKey].push(replacement);
          return acc;
        }, {} as Record<string, Replacement[]>);

        // Trier chaque groupe par date puis par médecin
        Object.keys(grouped).forEach(periodKey => {
          grouped[periodKey].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            
            const userA = users.find(u => u.id === a.originalUserId);
            const userB = users.find(u => u.id === b.originalUserId);
            const nameA = userA ? `${userA.lastName} ${userA.firstName}` : '';
            const nameB = userB ? `${userB.lastName} ${userB.firstName}` : '';
            return nameA.localeCompare(nameB);
          });
        });

        // Trier les périodes dans l'ordre M, AM, S
        const sortedPeriods = ['M', 'AM', 'S'];
        const sortedGrouped: Record<string, Replacement[]> = {};
        sortedPeriods.forEach(period => {
          if (grouped[period]) {
            sortedGrouped[period] = grouped[period];
          }
        });

        return sortedGrouped;
      }

      case 'byStatus': {
        // Grouper par statut
        const grouped = filtered.reduce((acc, replacement) => {
          const statusKey = replacement.status;
          if (!acc[statusKey]) {
            acc[statusKey] = [];
          }
          acc[statusKey].push(replacement);
          return acc;
        }, {} as Record<string, Replacement[]>);

        // Trier chaque groupe par date puis par période
        Object.keys(grouped).forEach(statusKey => {
          grouped[statusKey].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            
            const periodA = periodOrder[a.period as keyof typeof periodOrder] || 0;
            const periodB = periodOrder[b.period as keyof typeof periodOrder] || 0;
            return periodA - periodB;
          });
        });

        // Trier les statuts dans un ordre logique
        const statusOrder = ['assigned', 'filled', 'notified', 'pending'];
        const sortedGrouped: Record<string, Replacement[]> = {};
        statusOrder.forEach(status => {
          if (grouped[status]) {
            sortedGrouped[status] = grouped[status];
          }
        });

        return sortedGrouped;
      }

      default:
        return {};
    }
  }, [replacements, users, searchTerm, sortMode]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    const assigned = replacements.filter(r => r.status === 'assigned' || r.status === 'filled').length;
    const pending = replacements.filter(r => r.status === 'pending' || r.status === 'notified').length;
    return {
      total: replacements.length,
      assigned,
      pending
    };
  }, [replacements]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-indigo-900 mb-6">Remplacements</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-indigo-900 mb-6">Remplacements</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
          <div>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-indigo-900">Remplacements</h1>
        <button
          onClick={() => setShowExportModal(true)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </button>
      </div>

      <div className="mb-4 space-y-4">
        {/* Boutons de tri */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSortMode('byDoctor')}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              sortMode === 'byDoctor'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Par médecin
          </button>
          <button
            onClick={() => setSortMode('byDate')}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              sortMode === 'byDate'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Par date
          </button>
          <button
            onClick={() => setSortMode('byPeriod')}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              sortMode === 'byPeriod'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Clock className="h-4 w-4 mr-2" />
            Par période
          </button>
          <button
            onClick={() => setSortMode('byStatus')}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              sortMode === 'byStatus'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Par statut
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par médecin, date, type de garde..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
      
      {Object.keys(sortedData).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500">
            {searchTerm ? 'Aucun remplacement ne correspond à votre recherche.' : 'Aucun remplacement n\'est actuellement disponible.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(sortedData).map(([groupKey, groupReplacements]) => {
            let groupTitle = '';
            let groupSubtitle = '';
            
            switch (sortMode) {
              case 'byDoctor': {
                const user = users.find(u => u.id === groupKey);
                groupTitle = user ? `${user.lastName.toUpperCase()} ${user.firstName}` : 'Médecin inconnu';
                groupSubtitle = `${groupReplacements.length} garde${groupReplacements.length > 1 ? 's' : ''} à pourvoir`;
                break;
              }
              case 'byDate': {
                const date = parseParisDate(groupKey);
                groupTitle = formatParisDate(date, 'EEEE dd MMMM yyyy', { locale: frLocale });
                groupSubtitle = `${groupReplacements.length} remplacement${groupReplacements.length > 1 ? 's' : ''}`;
                break;
              }
              case 'byPeriod': {
                groupTitle = periodNames[groupKey as keyof typeof periodNames] || groupKey;
                groupSubtitle = `${groupReplacements.length} garde${groupReplacements.length > 1 ? 's' : ''} à pourvoir`;
                break;
              }
              case 'byStatus': {
                const statusLabels = {
                  'assigned': 'Assignés',
                  'filled': 'Pourvus',
                  'notified': 'Notifiés',
                  'pending': 'En attente'
                };
                groupTitle = statusLabels[groupKey as keyof typeof statusLabels] || groupKey;
                groupSubtitle = `${groupReplacements.length} remplacement${groupReplacements.length > 1 ? 's' : ''}`;
                break;
              }
            }
            
            return (
              <div key={groupKey} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                  <h3 className="text-lg font-semibold text-indigo-900">
                    {groupTitle}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {groupSubtitle}
                  </p>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {groupReplacements.map(replacement => {
                    const date = parseParisDate(replacement.date);
                    const isPast = date < parseParisDate(formatParisDate(createParisDate(), 'yyyy-MM-dd'));
                    const isSaving = savingIds.has(replacement.id);
                    const isDeleting = deletingIds.has(replacement.id);
                    const user = users.find(u => u.id === replacement.originalUserId);
                    
                    return (
                      <div 
                        key={replacement.id} 
                        className={`px-4 py-3 ${isPast ? 'opacity-60' : ''} hover:bg-gray-50`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              {/* Afficher les infos selon le mode de tri */}
                              {sortMode !== 'byDate' && (
                                <>
                                  <span className="font-medium">
                                    {formatParisDate(date, 'dd/MM/yyyy')}
                                  </span>
                                  <span className="text-gray-600">
                                    {formatParisDate(date, 'EEEE', { locale: frLocale })}
                                  </span>
                                </>
                              )}
                              
                              {sortMode !== 'byPeriod' && (
                                <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                                  {periodNames[replacement.period as keyof typeof periodNames]}
                                </span>
                              )}
                              
                              <span className="text-gray-700">
                                {replacement.shiftType}
                              </span>
                              
                              {replacement.timeSlot && (
                                <span className="text-gray-500">
                                  {replacement.timeSlot}
                                </span>
                              )}
                              
                              {sortMode !== 'byDoctor' && user && (
                                <span className="text-indigo-600 font-medium">
                                  {user.lastName.toUpperCase()} {user.firstName}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-4">
                            {replacement.replacementName ? (
                              <>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                  {replacement.replacementName}
                                </span>
                                <button
                                  onClick={() => handleRemoveReplacement(replacement.id)}
                                  disabled={isSaving}
                                  className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                                  title="Supprimer le remplaçant"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  placeholder="Nom du remplaçant"
                                  value={replacementNames[replacement.id] || ''}
                                  onChange={(e) => setReplacementNames(prev => ({
                                    ...prev,
                                    [replacement.id]: e.target.value
                                  }))}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleAssignReplacement(replacement.id);
                                    }
                                  }}
                                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                  disabled={isSaving}
                                />
                                <button
                                  onClick={() => handleAssignReplacement(replacement.id)}
                                  disabled={!replacementNames[replacement.id]?.trim() || isSaving}
                                  className="p-1.5 text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Valider le remplaçant"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            
                            {/* Bouton de suppression de la proposition */}
                            <button
                              onClick={() => handleDeleteReplacement(replacement.id)}
                              disabled={isDeleting}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Supprimer cette proposition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal d'export */}
      <ReplacementExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={(options) => exportToExcel(options)}
        totalCount={stats.total}
        assignedCount={stats.assigned}
        pendingCount={stats.pending}
      />
    </div>
  );
};

export default ReplacementsPage;