import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, Users, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ShiftExchange as PlanningShiftExchange } from '../../../../types/planning';
import type { ShiftExchange as FeatureShiftExchange } from '../../types';
import type { User } from '../../../../types/users';

// Type union pour accepter les deux types de ShiftExchange
type ShiftExchange = PlanningShiftExchange | FeatureShiftExchange;

interface ParticipationPanelProps {
  exchanges: ShiftExchange[];
  users: User[];
  history: any[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface UserStats {
  userId: string;
  userName: string;
  interestCount: number; // Nombre de positions demandées
  interestRate: number; // Taux d'intérêt (demandes/total postes)
  receivedCount: number; // Nombre de postes reçus
  attributionRate: number; // Taux d'attribution (reçus/demandes)
}

type SortField = 'userName' | 'interestRate' | 'attributionRate';
type SortDirection = 'asc' | 'desc';

const ParticipationPanel: React.FC<ParticipationPanelProps> = ({
  exchanges = [],
  users = [],
  history = [],
  isOpen,
  onToggle,
  onClose
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [sortField, setSortField] = useState<SortField>('interestRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc'); // 'asc' pour privilégier ceux qui demandent moins
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  
  // S'assurer que les données sont des tableaux valides
  const safeExchanges = Array.isArray(exchanges) ? exchanges : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeHistory = Array.isArray(history) ? history : [];

  // Calculer les statistiques pour chaque utilisateur
  const userStats = useMemo(() => {
    try {
      const stats: Record<string, UserStats> = {};
      const totalPositions = safeExchanges.length;

      // Si pas de données utilisateurs, retourner un tableau vide
      if (safeUsers.length === 0) {
        return [];
      }

      // Initialiser les stats pour tous les utilisateurs
      safeUsers.forEach(user => {
        if (!user || !user.id) return;
        stats[user.id] = {
          userId: user.id,
          userName: user.lastName?.toUpperCase() || 'INCONNU',
          interestCount: 0,
          interestRate: 0,
          receivedCount: 0,
          attributionRate: 0
        };
      });

      // Compter les intérêts
      safeExchanges.forEach(exchange => {
        if (exchange && exchange.interestedUsers && Array.isArray(exchange.interestedUsers)) {
          exchange.interestedUsers.forEach(userId => {
            if (stats[userId]) {
              stats[userId].interestCount++;
            }
          });
        }
      });

      // Compter les postes reçus (avec déduplication)
      const processedHistoryIds = new Set<string>();
      safeHistory.forEach(h => {
        if (h && h.newUserId && stats[h.newUserId]) {
          // Éviter les doublons basés sur la combinaison date-period-userId
          const uniqueKey = `${h.date}-${h.period}-${h.newUserId}`;
          if (!processedHistoryIds.has(uniqueKey)) {
            processedHistoryIds.add(uniqueKey);
            stats[h.newUserId].receivedCount++;
          }
        }
      });

      // Calculer les taux avec validation
      Object.values(stats).forEach(stat => {
        stat.interestRate = totalPositions > 0 
          ? Math.round((stat.interestCount / totalPositions) * 100) 
          : 0;
        
        // Calculer le taux d'attribution avec plafonnement à 100%
        const rawAttributionRate = stat.interestCount > 0 
          ? (stat.receivedCount / stat.interestCount) * 100
          : 0;
        
        // Log pour débogage si le taux dépasse 100%
        if (rawAttributionRate > 100) {
          console.warn(`Taux d'attribution anormal pour ${stat.userName}:`, {
            receivedCount: stat.receivedCount,
            interestCount: stat.interestCount,
            calculatedRate: rawAttributionRate
          });
        }
        
        // Plafonner à 100% maximum
        stat.attributionRate = Math.min(100, Math.round(rawAttributionRate));
      });

      // Filtrer uniquement les utilisateurs qui ont au moins manifesté un intérêt
      return Object.values(stats).filter(stat => stat.interestCount > 0);
    } catch (error) {
      console.error('Erreur dans le calcul des stats ParticipationPanel:', error);
      return [];
    }
  }, [safeExchanges, safeUsers, safeHistory]);

  // Fonction de tri
  const sortedStats = useMemo(() => {
    const sorted = [...userStats];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'userName':
          comparison = a.userName.localeCompare(b.userName);
          break;
        case 'interestRate':
          comparison = a.interestRate - b.interestRate;
          break;
        case 'attributionRate':
          comparison = a.attributionRate - b.attributionRate;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [userStats, sortField, sortDirection]);

  // Gérer le clic sur les en-têtes
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'interestRate' ? 'asc' : 'desc');
    }
  };


  const getColorForInterestRate = (rate: number) => {
    // Inversé : moins de demandes = mieux
    if (rate <= 25) return 'text-green-600';
    if (rate <= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBackgroundForInterestRate = (rate: number) => {
    // Inversé : moins de demandes = mieux
    if (rate <= 25) return 'bg-green-50';
    if (rate <= 50) return 'bg-orange-50';
    return 'bg-red-50';
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-indigo-600" />
      : <ArrowDown className="h-3 w-3 text-indigo-600" />;
  };

  // Fonction pour récupérer les détails des gardes d'un utilisateur
  const getUserExchangeDetails = (userId: string) => {
    const userExchanges = safeExchanges
      .filter(exchange => exchange.interestedUsers?.includes(userId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Log temporaire pour debug
    if (userExchanges.length > 0) {
      console.log(`Détails pour ${userId}:`, {
        exchanges: userExchanges.slice(0, 3), // Premiers échanges
        history: safeHistory.filter(h => h.newUserId === userId).slice(0, 3) // Historique correspondant
      });
    }
    
    return userExchanges.map(exchange => ({
        id: exchange.id,
        date: exchange.date,
        period: exchange.period,
        shiftType: exchange.shiftType,
        isAttributed: safeHistory.some(h => 
          // Vérifier par originalExchangeId (méthode moderne)
          (h.originalExchangeId === exchange.id && h.newUserId === userId) ||
          // OU vérifier par correspondance date/période/utilisateurs (pour les anciennes données)
          (h.date === exchange.date && 
           h.period === exchange.period && 
           h.originalUserId === exchange.userId && 
           h.newUserId === userId)
        )
      }));
  };

  // Helper pour obtenir la couleur de la période
  const getPeriodColor = (period: string) => {
    switch (period) {
      case 'M': return 'bg-amber-100 text-amber-700';
      case 'AM': return 'bg-sky-100 text-sky-700';
      case 'S': return 'bg-violet-100 text-violet-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Fonction pour formater la date
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  // Gérer le clic sur un utilisateur
  const handleUserClick = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  // Vérification après tous les hooks
  if (!isOpen) return null;

  return (
    <div className={`fixed right-4 top-20 z-50 transition-all duration-300 ${
      isMinimized ? 'w-64' : 'w-96'
    }`}>
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h3 className="font-semibold text-sm">
              Taux de Participation BAG
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title={isMinimized ? "Agrandir" : "Réduire"}
            >
              {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenu */}
        {!isMinimized && (
          <div className="max-h-[600px] overflow-y-auto">
            {/* Résumé */}
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Total postes BAG:</span>
                  <span className="font-semibold ml-1">{safeExchanges.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Médecins actifs:</span>
                  <span className="font-semibold ml-1">{userStats.length}</span>
                </div>
              </div>
            </div>

            {/* Tableau des statistiques */}
            <div className="p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-2 px-1 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('userName')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Médecin</span>
                        {getSortIcon('userName')}
                      </div>
                    </th>
                    <th 
                      className="text-center py-2 px-1 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50" 
                      title="Demandes / Total BAG"
                      onClick={() => handleSort('interestRate')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Taux Intérêt</span>
                        {getSortIcon('interestRate')}
                      </div>
                    </th>
                    <th 
                      className="text-center py-2 px-1 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50" 
                      title="Postes reçus / Demandes"
                      onClick={() => handleSort('attributionRate')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Taux Attribution</span>
                        {getSortIcon('attributionRate')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((stat) => (
                    <React.Fragment key={stat.userId}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-1">
                          <button
                            onClick={() => handleUserClick(stat.userId)}
                            className="flex items-center gap-1 text-left hover:text-indigo-600 transition-colors"
                          >
                            <ChevronRight 
                              className={`h-3 w-3 transition-transform ${
                                expandedUserId === stat.userId ? 'rotate-90' : ''
                              }`}
                            />
                            <span className="font-medium truncate block max-w-[120px]" title={stat.userName}>
                              {stat.userName}
                            </span>
                          </button>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${getBackgroundForInterestRate(stat.interestRate)}`}>
                            <span className={`font-semibold ${getColorForInterestRate(stat.interestRate)}`}>
                              {stat.interestRate}%
                            </span>
                            <span className="text-xs text-gray-600">
                              ({stat.interestCount}/{safeExchanges.length})
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                            stat.receivedCount > stat.interestCount ? 'bg-red-50' :
                            stat.attributionRate >= 50 ? 'bg-blue-50' :
                            stat.attributionRate >= 25 ? 'bg-yellow-50' :
                            'bg-gray-50'
                          }`}>
                            <span className={`font-semibold ${
                              stat.receivedCount > stat.interestCount ? 'text-red-600' :
                              stat.attributionRate >= 50 ? 'text-blue-600' :
                              stat.attributionRate >= 25 ? 'text-yellow-600' :
                              'text-gray-600'
                            }`}>
                              {stat.attributionRate}%
                              {stat.receivedCount > stat.interestCount && ' ⚠️'}
                            </span>
                            <span className="text-xs text-gray-600">
                              ({stat.receivedCount}/{stat.interestCount})
                            </span>
                          </div>
                        </td>
                      </tr>
                      {expandedUserId === stat.userId && (
                        <tr className="animate-in slide-in-from-top-1 duration-200">
                          <td colSpan={3} className="px-2 py-2 bg-gray-50 border-l-2 border-indigo-400">
                            <div className="space-y-1 text-xs">
                              {getUserExchangeDetails(stat.userId).length > 0 ? (
                                getUserExchangeDetails(stat.userId).map((detail, idx) => (
                                  <div key={idx} className="flex items-center gap-2 py-0.5">
                                    <span className="text-gray-600 font-medium">{formatDate(detail.date)}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPeriodColor(detail.period)}`}>
                                      {detail.period}
                                    </span>
                                    <span className="text-gray-700">{detail.shiftType}</span>
                                    {detail.isAttributed && (
                                      <span className="text-green-600 text-xs font-medium">✓ Attribué</span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500 italic">Aucune garde demandée</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {userStats.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Aucune participation enregistrée
                </div>
              )}
            </div>

            {/* Légende réduite */}
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
              <span className="text-green-600">●</span> Faible demande (privilégier) | 
              <span className="text-orange-600 ml-2">●</span> Demande moyenne | 
              <span className="text-red-600 ml-2">●</span> Forte demande
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipationPanel;