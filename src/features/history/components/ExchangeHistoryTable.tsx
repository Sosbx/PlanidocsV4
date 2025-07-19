import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RefreshCw, ArrowRight, Gift, Loader2 } from 'lucide-react';
import { useDirectExchangeHistory } from '../hooks/useDirectExchangeHistory';
import { HistoryFilters } from '../types';
import { PERIOD_LABELS } from '../../../constants/planning';
import { firebaseTimestampToParisDate } from '../../../utils/timezoneUtils';

interface ExchangeHistoryTableProps {
  filters: HistoryFilters;
  showAllUsers: boolean;
  userId?: string;
}

const ExchangeHistoryTable: React.FC<ExchangeHistoryTableProps> = ({
  filters,
  showAllUsers,
  userId,
}) => {
  const { history, loading, error } = useDirectExchangeHistory(filters, showAllUsers);

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
        Aucun échange direct trouvé
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'exchange':
        return <RefreshCw className="h-4 w-4" />;
      case 'give':
        return <Gift className="h-4 w-4" />;
      default:
        return <ArrowRight className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'exchange':
        return 'Échange';
      case 'give':
        return 'Cession';
      case 'replacement':
        return 'Remplacement';
      default:
        return type;
    }
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
              Garde
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avec
            </th>
            {showAllUsers && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Initiateur
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Créé le
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {history.map((exchange) => {
            const isInitiator = exchange.initiatorId === userId;
            const otherUser = isInitiator 
              ? exchange.completedByName 
              : exchange.initiatorName;
            
            return (
              <tr key={exchange.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(exchange.shiftDate), 'dd/MM/yyyy', { locale: fr })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-2">
                      {getTypeIcon(exchange.type)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {getTypeLabel(exchange.type)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{exchange.shiftType}</div>
                    <div className="text-gray-500">
                      {PERIOD_LABELS[exchange.period]} - {exchange.timeSlot}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {otherUser || '-'}
                </td>
                {showAllUsers && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {exchange.initiatorName}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {exchange.completedAt && format(
                    firebaseTimestampToParisDate(exchange.completedAt),
                    'dd/MM/yyyy HH:mm',
                    { locale: fr }
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

export default ExchangeHistoryTable;