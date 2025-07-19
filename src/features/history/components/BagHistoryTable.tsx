import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useBagHistory } from '../hooks/useBagHistory';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <span className="ml-2">Chargement de l'historique...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        {error}
      </div>
    );
  }

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