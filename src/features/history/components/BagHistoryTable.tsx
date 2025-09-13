import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, RefreshCw, Loader2, AlertCircle, CheckCircle, XCircle, Users, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { useBagHistory } from '../hooks/useBagHistory';
import { useBagUserHistory } from '../hooks/useBagUserHistory';
import { HistoryFilters } from '../types';
import { PERIOD_LABELS } from '../../../constants/planning';
import { firebaseTimestampToParisDate } from '../../../utils/timezoneUtils';

interface BagHistoryTableProps {
  filters: HistoryFilters;
  showAllUsers: boolean;
  userId?: string;
}

const BagHistoryTable: React.FC<BagHistoryTableProps> = ({
  filters,
  showAllUsers,
  userId,
}) => {
  const { history, loading, error } = useBagHistory(filters, showAllUsers);
  const { 
    history: userHistory, 
    loading: userLoading, 
    error: userError,
    isValidated 
  } = useBagUserHistory(filters);

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <span className="ml-2">Chargement de l'historique...</span>
      </div>
    );
  }

  if (error || userError) {
    return (
      <div className="text-center py-8 text-red-600">
        {error || userError}
      </div>
    );
  }

  // Message si le planning n'est pas encore validé pour les utilisateurs non-admin
  if (!showAllUsers && userId && !isValidated) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center px-4 py-2 rounded-lg bg-yellow-50 text-yellow-800">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span className="text-sm">
            L'historique détaillé sera disponible après la validation finale du planning
          </span>
        </div>
      </div>
    );
  }
  
  // Vue personnalisée pour les utilisateurs non-admin
  if (!showAllUsers && userId && isValidated) {
    const { proposedShifts, receivedShifts } = userHistory;
    
    if (proposedShifts.length === 0 && receivedShifts.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Aucun mouvement de garde dans la bourse aux gardes
        </div>
      );
    }
    
    return (
      <div className="space-y-8">
        {/* Section: Gardes proposées */}
        {proposedShifts.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <ArrowRight className="h-5 w-5 mr-2 text-blue-600" />
              Mes gardes proposées
            </h3>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Période
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type de garde
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Intéressés
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receveur
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {proposedShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(shift.date), 'dd/MM/yyyy', { locale: fr })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {PERIOD_LABELS[shift.period]} {shift.timeSlot}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.shiftType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {shift.status === 'pourvue' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Pourvue
                          </span>
                        )}
                        {shift.status === 'non_pourvue' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Non pourvue
                          </span>
                        )}
                        {shift.status === 'remplaçant' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Users className="h-3 w-3 mr-1" />
                            Remplaçant
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shift.interestedCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {shift.interestedCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.receiver || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Section: Gardes reçues */}
        {receivedShifts.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <ArrowLeftRight className="h-5 w-5 mr-2 text-green-600" />
              Gardes reçues via la BAG
            </h3>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Période
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type de garde
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Donneur original
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type d'échange
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {receivedShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(shift.date), 'dd/MM/yyyy', { locale: fr })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {PERIOD_LABELS[shift.period]} {shift.timeSlot}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.shiftType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.originalOwner}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          shift.exchangeType === 'échange' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {shift.exchangeType === 'échange' ? (
                            <><RefreshCw className="h-3 w-3 mr-1" />Échange</>
                          ) : (
                            <><ArrowRight className="h-3 w-3 mr-1" />Cession</>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Message si le planning n'est pas encore validé
  if (!showAllUsers && userId && !isValidated) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center px-4 py-2 rounded-lg bg-yellow-50 text-yellow-800">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span className="text-sm">
            L'historique détaillé sera disponible après la validation finale du planning
          </span>
        </div>
      </div>
    );
  }
  
  // Vue admin : tableau existant
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucun échange BaG trouvé
      </div>
    );
  }

  const getUserRole = (exchange: any, participantId: string) => {
    const participant = exchange.participants.find((p: any) => p.userId === participantId);
    if (!participant) return '-';
    
    // Find what the user gave and received
    const gaveSomething = exchange.exchanges.some((e: any) => 
      e.previousAssignment?.userId === participantId
    );
    const receivedSomething = exchange.exchanges.some((e: any) => 
      e.newAssignment?.userId === participantId
    );
    
    if (gaveSomething && receivedSomething) return 'Échange';
    if (gaveSomething) return 'Cession';
    if (receivedSomething) return 'Réception';
    return '-';
  };

  const getExchangeDetails = (exchange: any, participantId: string) => {
    const details: string[] = [];
    
    // Find what the user gave
    exchange.exchanges.forEach((e: any) => {
      if (e.previousAssignment?.userId === participantId) {
        details.push(`Cédé: ${e.date} - ${e.shiftType} ${PERIOD_LABELS[e.period]} ${e.timeSlot}`);
      }
    });
    
    // Find what the user received
    exchange.exchanges.forEach((e: any) => {
      if (e.newAssignment?.userId === participantId) {
        details.push(`Reçu: ${e.date} - ${e.shiftType} ${PERIOD_LABELS[e.period]} ${e.timeSlot}`);
      }
    });
    
    return details;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Détails
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Participants
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cycle BaG
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {history.map((exchange) => {
            const userRole = userId ? getUserRole(exchange, userId) : '-';
            const details = userId ? getExchangeDetails(exchange, userId) : [];
            const isPermutation = exchange.exchanges.length === 2 && 
              exchange.participants.length === 2;
            
            return (
              <tr key={exchange.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(
                    firebaseTimestampToParisDate(exchange.executedAt),
                    'dd/MM/yyyy HH:mm',
                    { locale: fr }
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-2">
                      {isPermutation ? (
                        <RefreshCw className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {showAllUsers || !userId ? (
                        isPermutation ? 'Permutation' : 'Échange multiple'
                      ) : (
                        userRole
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-1">
                    {showAllUsers || !userId ? (
                      exchange.exchanges.map((e: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          {e.date} - {e.shiftType} {PERIOD_LABELS[e.period]} {e.timeSlot}
                        </div>
                      ))
                    ) : (
                      details.map((detail, idx) => (
                        <div key={idx} className="text-xs">
                          {detail}
                        </div>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-1">
                    {exchange.participants.map((p: any) => (
                      <div key={p.userId} className="text-xs">
                        {p.userName}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {exchange.cycleInfo ? (
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Cycle {exchange.cycleInfo.cycleNumber}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BagHistoryTable;