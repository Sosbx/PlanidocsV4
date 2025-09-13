import React, { useState, useEffect } from 'react';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { Clock, Check, RefreshCw, Eye, Download, X } from 'lucide-react';
import { getTimeRemaining } from '../../../utils/timeUtils';
import { getExchangeHistory } from '../../../lib/firebase/exchange';
import { getShiftExchanges } from '../../../lib/firebase/exchange';
import { useUsers } from '../../../features/auth/hooks/useUsers';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { format } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShiftPeriod } from '../../../types/exchange';
import { getPeriodDisplayText } from '../../../utils/dateUtils';
import { BagPhase } from '../types';
import ExportButtons from '../../statistics/components/common/ExportButtons';
import { exportExchangesToExcel } from '../../../utils/exchangeExcelExport';
import { calculatePercentage } from '../../../utils/bagStatistics';
import ExportChoiceModal from './ExportChoiceModal';

// Utilisation du contexte migré
import { useBagPhase } from '../hooks/useBagPhase';

const BagPhaseIndicator: React.FC = () => {
  const { config } = useBagPhase();
  const { users } = useUsers();
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(config.submissionDeadline));
  const [showExportChoiceModal, setShowExportChoiceModal] = useState(false);
  const [pendingExportType, setPendingExportType] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    if (config.phase !== 'submission') return;

    const timer = setInterval(() => {
      const remaining = getTimeRemaining(config.submissionDeadline);
      setTimeLeft(remaining);
      
      if (remaining.isExpired) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [config.submissionDeadline, config.phase]);

  const [showPreview, setShowPreview] = useState(false);
  const [exchangeData, setExchangeData] = useState<any[]>([]);

  const generateExchangeSummary = async (includePending = false, filterByUser?: string) => {
    if (config.phase === 'distribution') {
      // En phase distribution, récupérer tous les échanges
      const allExchanges = await getShiftExchanges();
      const validatedExchanges = allExchanges.filter(exchange => exchange.status === 'validated');
      const pendingExchanges = allExchanges.filter(exchange => exchange.status === 'pending');
      
      // Pour les admins en phase 2: inclure toutes les propositions et intérêts
      if (user?.roles.isAdmin && includePending) {
        const propositionsData = allExchanges.map(exchange => {
          const donorUser = users.find(u => u.id === exchange.userId);
          const interestedUsersList = exchange.interestedUsers?.map(userId => {
            const u = users.find(user => user.id === userId);
            return u ? `${u.lastName} ${u.firstName}` : 'Inconnu';
          }).join(', ') || 'Aucun';
          
          return {
            date: formatParisDate(new Date(exchange.date), 'dd/MM/yyyy', { locale: frLocale }),
            donor: donorUser ? `${donorUser.lastName} ${donorUser.firstName}` : 'Inconnu',
            shift: exchange.shiftType,
            period: getPeriodDisplayText(exchange.period as ShiftPeriod),
            status: exchange.status === 'validated' ? 'Validé' : 'En attente',
            interestedUsers: interestedUsersList,
            interestedCount: exchange.interestedUsers?.length || 0,
            receiver: exchange.validatedBy ? users.find(u => u.id === exchange.validatedBy)?.lastName || 'Inconnu' : 'Non attribué',
            type: exchange.operationTypes?.includes('permutation') ? 'Échange' : 'Cède',
            comment: exchange.comment || ''
          };
        });
        
        return { propositions: propositionsData, validated: [], pending: [] };
      }
      
      const validatedData = validatedExchanges.map(exchange => {
        const donorUser = users.find(u => u.id === exchange.userId);
        const interestedUser = exchange.validatedBy ? users.find(u => u.id === exchange.validatedBy) : null;
        
        return {
          date: formatParisDate(new Date(exchange.date), 'dd/MM/yyyy', { locale: frLocale }),
          donor: donorUser ? `${donorUser.lastName} ${donorUser.firstName}` : 'Inconnu',
          shift: exchange.shiftType,
          period: getPeriodDisplayText(exchange.period as ShiftPeriod),
          receiver: interestedUser ? `${interestedUser.lastName} ${interestedUser.firstName}` : 'À déterminer',
          type: exchange.operationTypes?.includes('permutation') ? 'Échange' : 'Cède',
          comment: exchange.comment || ''
        };
      });
      
      if (includePending) {
        const pendingData = pendingExchanges.map(exchange => {
          const donorUser = users.find(u => u.id === exchange.userId);
          
          return {
            date: formatParisDate(new Date(exchange.date), 'dd/MM/yyyy', { locale: frLocale }),
            donor: donorUser ? `${donorUser.lastName} ${donorUser.firstName}` : 'Inconnu',
            shift: exchange.shiftType,
            period: getPeriodDisplayText(exchange.period as ShiftPeriod),
            receiver: 'En attente',
            type: exchange.operationTypes?.includes('permutation') ? 'Échange' : 'Cède',
            comment: exchange.comment || ''
          };
        });
        
        return { validated: validatedData, pending: pendingData };
      }
      
      return validatedData;
    } else {
      // En phase completed, récupérer l'historique complet et les gardes non pourvues
      const history = await getExchangeHistory();
      const allExchanges = await getShiftExchanges();
      
      // Gardes pourvues (de l'historique)
      let pourvuesData = history
        .filter(exchange => exchange.status === 'completed')
        .map(exchange => {
          const donorUser = users.find(u => u.id === exchange.originalUserId);
          const receiverUser = users.find(u => u.id === exchange.newUserId);
          
          return {
            date: formatParisDate(new Date(exchange.date), 'dd/MM/yyyy', { locale: frLocale }),
            dateTimestamp: new Date(exchange.date).getTime(),
            donor: donorUser ? `${donorUser.lastName} ${donorUser.firstName}` : 'Inconnu',
            shift: exchange.shiftType,
            period: getPeriodDisplayText(exchange.period as ShiftPeriod),
            receiver: receiverUser ? `${receiverUser.lastName} ${receiverUser.firstName}` : 'Inconnu',
            type: exchange.isPermutation ? 'Échange' : 'Cède',
            status: 'Pourvue',
            comment: exchange.comment || ''
          };
        });
      
      // Gardes non pourvues (encore dans les échanges)
      const nonPourvuesData = allExchanges
        .filter(exchange => exchange.status === 'pending')
        .map(exchange => {
          const donorUser = users.find(u => u.id === exchange.userId);
          
          return {
            date: formatParisDate(new Date(exchange.date), 'dd/MM/yyyy', { locale: frLocale }),
            dateTimestamp: new Date(exchange.date).getTime(),
            donor: donorUser ? `${donorUser.lastName} ${donorUser.firstName}` : 'Inconnu',
            shift: exchange.shiftType,
            period: getPeriodDisplayText(exchange.period as ShiftPeriod),
            receiver: 'Non attribuée',
            type: exchange.operationTypes?.includes('permutation') ? 'Échange' : 'Cède',
            status: 'Non pourvue',
            comment: exchange.comment || ''
          };
        });
      
      // Combiner et trier par date croissante
      let allData = [...pourvuesData, ...nonPourvuesData].sort((a, b) => a.dateTimestamp - b.dateTimestamp);
      
      // Filtrer par utilisateur si demandé
      if (filterByUser) {
        allData = allData.filter(exchange => {
          const userFullName = users.find(u => u.id === filterByUser);
          if (!userFullName) return false;
          const fullName = `${userFullName.lastName} ${userFullName.firstName}`;
          return exchange.donor === fullName || exchange.receiver === fullName;
        });
      }
      
      return allData;
    }
  };

  const handlePreview = async () => {
    const data = await generateExchangeSummary(true); // Inclure les pending pour l'aperçu
    if (config.phase === 'distribution' && !Array.isArray(data)) {
      // Pour la phase distribution, combiner validated et pending pour l'affichage
      setExchangeData([...data.validated, ...data.pending || []]);
    } else {
      setExchangeData(Array.isArray(data) ? data : data.validated || []);
    }
    setShowPreview(true);
  };

  const handleExportClick = async (type: 'pdf' | 'excel') => {
    if (!user?.roles.isAdmin && config.phase === 'completed') {
      // Pour les utilisateurs non-admin en phase completed, afficher le modal de choix
      setPendingExportType(type);
      setShowExportChoiceModal(true);
    } else {
      // Pour les admins ou autres phases, export direct
      if (type === 'pdf') {
        await handleDownloadPDF();
      } else {
        await handleDownloadExcel();
      }
    }
  };

  const handleExportChoice = async (choice: 'mine' | 'all') => {
    setShowExportChoiceModal(false);
    const filterUserId = choice === 'mine' ? user?.id : undefined;
    
    if (pendingExportType === 'pdf') {
      await handleDownloadPDF(filterUserId);
    } else if (pendingExportType === 'excel') {
      await handleDownloadExcel(filterUserId);
    }
    
    setPendingExportType(null);
  };

  const handleDownloadPDF = async (filterUserId?: string) => {
    const data = await generateExchangeSummary(user?.roles.isAdmin && config.phase === 'distribution', filterUserId);
    const phase = config.phase as 'distribution' | 'completed';
    
    const doc = new jsPDF();
    
    // Titre
    doc.setFontSize(16);
    const title = phase === 'distribution' 
      ? 'Échanges en cours - Phase de distribution'
      : 'Récapitulatif des échanges de garde';
    doc.text(title, 14, 20);
    
    // Date d'export
    doc.setFontSize(10);
    doc.text(`Exporté le ${formatParisDate(createParisDate(), 'dd/MM/yyyy HH:mm', { locale: frLocale })}`, 14, 30);

    // Adapter le tableau selon le type de données
    if (phase === 'distribution' && user?.roles.isAdmin && data.propositions) {
      // Phase 2 admin : toutes les propositions
      autoTable(doc, {
        startY: 40,
        head: [['Date', 'Période', 'Proposant', 'Garde', 'Statut', 'Intéressés', 'Nb Int.', 'Attribution']],
        body: data.propositions.map(row => [
          row.date,
          row.period,
          row.donor,
          row.shift,
          row.status,
          row.interestedUsers,
          row.interestedCount,
          row.receiver
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] }
      });
    } else if (phase === 'completed' && Array.isArray(data)) {
      // Phase 3 : gardes pourvues et non pourvues
      const pourvues = data.filter(row => row.status === 'Pourvue');
      const nonPourvues = data.filter(row => row.status === 'Non pourvue');
      
      let yPosition = 40;
      
      if (pourvues.length > 0) {
        doc.setFontSize(12);
        doc.text('Gardes pourvues', 14, yPosition);
        yPosition += 10;
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Période', 'Donneur', 'Garde', 'Receveur', 'Type', 'Commentaire']],
          body: pourvues.map(row => [
            row.date,
            row.period,
            row.donor,
            row.shift,
            row.receiver,
            row.type,
            row.comment
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [76, 175, 80] }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }
      
      if (nonPourvues.length > 0) {
        doc.setFontSize(12);
        doc.text('Gardes non pourvues', 14, yPosition);
        yPosition += 10;
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Période', 'Proposant', 'Garde', 'Type souhaité', 'Statut', 'Commentaire']],
          body: nonPourvues.map(row => [
            row.date,
            row.period,
            row.donor,
            row.shift,
            row.type,
            'Non attribuée',
            row.comment
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [244, 67, 54] }
        });
      }
    } else {
      // Format par défaut
      autoTable(doc, {
        startY: 40,
        head: [['Date', 'Période', 'Donneur', 'Garde', 'Receveur', 'Type', 'Commentaire']],
        body: data.map(row => [
          row.date,
          row.period,
          row.donor,
          row.shift,
          row.receiver,
          row.type,
          row.comment
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] }
      });
    }

    doc.save(`${phase === 'distribution' ? 'echanges_en_cours' : 'Récapitulatif_échanges'}_${formatParisDate(createParisDate(), 'dd-MM-yyyy')}.pdf`);
  };

  const handleDownloadExcel = async (filterUserId?: string) => {
    const data = await generateExchangeSummary(true, filterUserId); // Inclure les pending pour Excel
    const phase = config.phase as 'distribution' | 'completed';
    await exportExchangesToExcel(data, phase, user?.roles.isAdmin);
  };
  
  if (!config.isConfigured) return null;

  const renderPhaseContent = () => {
    // Pour les utilisateurs non-admin, ne pas afficher les boutons d'export sauf en phase completed
    const shouldShowExportButtons = user?.roles.isAdmin || config.phase === 'completed';

    switch (config.phase) {
      case 'submission':
        return (
          <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded-md inline-flex items-center text-xs font-medium">
            <Clock className="h-4 w-4 mr-1.5 text-blue-600" />
            <span>Phase d'échange</span>
            {/* Affichage du temps restant simplifié (jours et heures seulement) */}
            <span className="ml-2 text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded">
              {timeLeft.days > 0 ? `${timeLeft.days}j ` : ''}
              {String(timeLeft.hours).padStart(2, '0')}h
            </span>
          </div>
        );

      case 'distribution':
        return (
          <div className="flex items-center gap-4">
            <div className="bg-amber-50 text-amber-800 px-2 py-1 rounded-md inline-flex items-center text-xs font-medium">
              <RefreshCw className="h-4 w-4 mr-1.5 text-amber-600" />
              <span>Répartition en cours</span>
            </div>
            {user?.roles.isAdmin && (
              <>
                <button
                  onClick={handlePreview}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Aperçu
                </button>
                <ExportButtons
                  onExportPDF={() => handleExportClick('pdf')}
                  onExportExcel={() => handleExportClick('excel')}
                />
              </>
            )}
          </div>
        );

      case 'completed':
        return (
          <div className="flex items-center gap-4">
            <div className="bg-green-50 text-green-800 px-2 py-1 rounded-md inline-flex items-center text-xs font-medium">
              <Check className="h-4 w-4 mr-1.5 text-green-600" />
              <span>Terminé</span>
            </div>
            <button
              onClick={handlePreview}
              className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Aperçu
            </button>
            {shouldShowExportButtons && (
              <ExportButtons
                onExportPDF={() => handleExportClick('pdf')}
                onExportExcel={() => handleExportClick('excel')}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Calculer le nombre de gardes pour le modal
  const getShiftCounts = async () => {
    const allData = await generateExchangeSummary(false, undefined);
    const myData = await generateExchangeSummary(false, user?.id);
    return {
      all: Array.isArray(allData) ? allData.length : 0,
      mine: Array.isArray(myData) ? myData.length : 0
    };
  };

  const [shiftCounts, setShiftCounts] = useState({ all: 0, mine: 0 });
  
  useEffect(() => {
    if (showExportChoiceModal && config.phase === 'completed') {
      getShiftCounts().then(setShiftCounts);
    }
  }, [showExportChoiceModal, config.phase]);

  return (
    <div className="mb-0">
      {renderPhaseContent()}
      
      {/* Modal de choix d'export */}
      <ExportChoiceModal
        isOpen={showExportChoiceModal}
        onClose={() => {
          setShowExportChoiceModal(false);
          setPendingExportType(null);
        }}
        onChoose={handleExportChoice}
        myShiftsCount={shiftCounts.mine}
        allShiftsCount={shiftCounts.all}
      />
      
      {/* Modal d'aperçu */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {config.phase === 'distribution' 
                  ? 'Échanges en cours - Phase de distribution' 
                  : 'Récapitulatif des échanges'}
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              {config.phase === 'distribution' && (() => {
                const validatedExchanges = exchangeData.filter(e => e.receiver !== 'En attente');
                const pendingExchanges = exchangeData.filter(e => e.receiver === 'En attente');
                
                return (
                  <>
                    {validatedExchanges.length > 0 && (
                      <>
                        <h3 className="text-lg font-semibold mb-3 text-green-700">
                          Échanges validés ({validatedExchanges.length})
                        </h3>
                        <table className="min-w-full divide-y divide-gray-200 mb-6">
                          <thead className="bg-green-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Période
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Donneur
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Garde
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Receveur
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Commentaire
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {validatedExchanges.map((row, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.period}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.donor}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.shift}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.receiver}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    row.type === 'Échange' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {row.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{row.comment}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    
                    {pendingExchanges.length > 0 && (
                      <>
                        <h3 className="text-lg font-semibold mb-3 text-red-700">
                          Gardes sans preneur ({pendingExchanges.length})
                        </h3>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-red-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Période
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Donneur
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Garde
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Statut
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type souhaité
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Commentaire
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pendingExchanges.map((row, index) => (
                              <tr key={index} className="hover:bg-red-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.period}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.donor}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.shift}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    En attente
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    row.type === 'Échange' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {row.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{row.comment}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    
                    {validatedExchanges.length > 0 && pendingExchanges.length > 0 && (
                      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                        <p className="text-sm font-medium text-gray-700">
                          Statistiques : {validatedExchanges.length} échanges validés, {pendingExchanges.length} gardes sans preneur
                          <span className="ml-2">
                            (Taux de réussite : {calculatePercentage(validatedExchanges.length, exchangeData.length)}%)
                          </span>
                        </p>
                      </div>
                    )}
                  </>
                );
              })() || (
                // Phase completed : affichage normal
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Période
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Donneur
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Garde
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Receveur
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commentaire
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {exchangeData.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.period}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.donor}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.shift}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.receiver}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            row.type === 'Échange' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{row.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BagPhaseIndicator;
