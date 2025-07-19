import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Users, Loader2, UserCheck } from 'lucide-react';
import { useReplacementHistory } from '../hooks/useReplacementHistory';
import { HistoryFilters } from '../types';
import { PERIOD_LABELS } from '../../../constants/planning';
import { firebaseTimestampToParisDate } from '../../../utils/timezoneUtils';
import { useUsers } from '../../../features/auth/hooks/useUsers';

interface ReplacementHistoryTableProps {
  filters: HistoryFilters;
  showAllUsers: boolean;
  userId?: string;
}

const ReplacementHistoryTable: React.FC<ReplacementHistoryTableProps> = ({
  filters,
  showAllUsers,
  userId,
}) => {
  const { history, loading, error } = useReplacementHistory(filters, showAllUsers);
  const { users } = useUsers();

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
        Aucun remplacement trouvé
      </div>
    );
  }

  const getUserName = (id: string) => {
    const user = users.find(u => u.uid === id);
    return user ? `${user.firstName} ${user.lastName}` : 'Utilisateur inconnu';
  };

  const getUserRole = (replacement: any, currentUserId?: string) => {
    if (replacement.userId === currentUserId) return 'Remplacé';
    if (replacement.replacementUserId === currentUserId) return 'Remplaçant';
    return '-';
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
              Rôle
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Garde
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Médecin remplacé
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Remplaçant
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Complété le
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {history.map((replacement) => {
            const role = getUserRole(replacement, userId);
            
            return (
              <tr key={replacement.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(replacement.date), 'dd/MM/yyyy', { locale: fr })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-2">
                      {role === 'Remplaçant' ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {showAllUsers || !userId ? 'Remplacement' : role}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{replacement.shiftType}</div>
                    <div className="text-gray-500">
                      {PERIOD_LABELS[replacement.period]} - {replacement.timeSlot}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getUserName(replacement.userId)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getUserName(replacement.replacementUserId)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {replacement.completedAt && format(
                    firebaseTimestampToParisDate(replacement.completedAt),
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

export default ReplacementHistoryTable;