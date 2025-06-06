import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import type { ShiftExchange, BagPhaseConfig } from '../../../types/planning';
import type { User } from '../../../types/users';
import { isGrayedOut } from '../../../utils/dateUtils';
import InterestedUserCard from './InterestedUserCard';
import ConfirmationModal from '../../ConfirmationModal';

interface ExchangeListProps {
  exchanges: ShiftExchange[];
  users: User[];
  bagPhaseConfig: BagPhaseConfig;
  conflictStates: Record<string, Record<string, boolean>>;
  userAssignments: Record<string, Record<string, ShiftAssignment>>;
  onValidateExchange: (exchangeId: string, interestedUserId: string, hasConflict: boolean) => void;
  onRejectExchange: (exchangeId: string) => void;
  onRemoveUser: (exchangeId: string, userId: string) => void;
  history: any[]; // Added history prop
}

const periodNames = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};

const ExchangeList: React.FC<ExchangeListProps> = ({
  exchanges,
  users,
  bagPhaseConfig,
  conflictStates,
  userAssignments,
  onValidateExchange,
  onRejectExchange,
  onRemoveUser,
  history // Added history prop
}) => {
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);
  const [exchangeToReject, setExchangeToReject] = useState<string | null>(null);

  const handleRejectClick = (exchangeId: string) => {
    setExchangeToReject(exchangeId);
    setShowRejectConfirmation(true);
  };

  const handleConfirmReject = () => {
    if (exchangeToReject) {
      onRejectExchange(exchangeToReject);
      setShowRejectConfirmation(false);
      setExchangeToReject(null);
    }
  };

  // Trier les échanges par date uniquement, pour garder les échanges désactivés à leur place chronologique
  const sortedExchanges = [...exchanges].sort((a, b) => {
    // Trier uniquement par date pour maintenir l'ordre chronologique
    return a.date.localeCompare(b.date);
  });

  if (sortedExchanges.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-500 text-center">
          Aucune garde n'est actuellement disponible à l'échange
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Version desktop */}
      <div className="hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-20">Médecin</div>
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-24">Date</div>
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-20">Garde</div>
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-32">Commentaire</div>
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-32">Intéressés</div>
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-16">Actions</div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedExchanges.map(exchange => {
              const exchangeUser = users.find(u => u.id === exchange.userId);
              const date = new Date(exchange.date);
              const isWeekendOrHoliday = isGrayedOut(date);
              const interestedUsers = exchange.interestedUsers || [];
              const isUnavailable = exchange.status === 'unavailable';

              return (
                <tr key={exchange.id} className={`
                  ${isWeekendOrHoliday ? 'bg-red-50/30' : ''} 
                  ${isUnavailable ? 'bg-gray-100' : 'hover:bg-gray-50'}
                `}>
                  <td className={`px-4 py-4 whitespace-nowrap ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {exchangeUser?.lastName.toUpperCase() || 'INCONNU'}
                          {history?.length > 0 && exchangeUser && exchanges.filter(e => e.interestedUsers?.includes(exchangeUser.id)).length > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({Math.round((history.filter(h => h.newUserId === exchangeUser?.id).length / exchanges.filter(e => e.interestedUsers?.includes(exchangeUser?.id)).length) * 100)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {exchangeUser?.firstName || ''}
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">
                        {format(date, 'EEE d MMM', { locale: fr })}
                      </span>
                      <span className="text-xs text-gray-500">
                        {periodNames[exchange.period]}
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <span className={`px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-lg shadow-sm ${
                      exchange.period === 'M'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : exchange.period === 'AM'
                        ? 'bg-sky-50 text-sky-800 border border-sky-200'
                        : 'bg-violet-50 text-violet-800 border border-violet-200'
                    }`}>
                      {exchange.shiftType}
                    </span>
                  </td>
                  <td className={`px-4 py-4 ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <div className="text-sm text-gray-500">
                      {exchange.comment || <span className="text-gray-400 italic">Aucun commentaire</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {isUnavailable ? (
                      <div className="flex items-center text-amber-600">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span className="text-sm">Garde indisponible</span>
                      </div>
                    ) : interestedUsers.length > 0 ? (
                      <div className="space-y-1">
                        {interestedUsers.map(userId => (
                          <InterestedUserCard
                            key={userId}
                            userId={userId}
                            users={users}
                            exchange={exchange}
                            conflictStates={conflictStates}
                            userAssignments={userAssignments}
                            bagPhaseConfig={bagPhaseConfig}
                            onValidateExchange={onValidateExchange}
                            onRemoveUser={onRemoveUser}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 italic">
                        Aucun intéressé
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleRejectClick(exchange.id)}
                      className={`inline-flex items-center px-2.5 py-1.5 border text-xs font-medium rounded ${
                        bagPhaseConfig.phase !== 'distribution' || isUnavailable
                          ? 'border-gray-300 text-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                      }`}
                      disabled={bagPhaseConfig.phase !== 'distribution' || isUnavailable}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Rejeter
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Version mobile */}
      <div className="md:hidden space-y-4">
        {sortedExchanges.map(exchange => {
          const exchangeUser = users.find(u => u.id === exchange.userId);
          const date = new Date(exchange.date);
          const isWeekendOrHoliday = isGrayedOut(date);
          const interestedUsers = exchange.interestedUsers || [];
          const isUnavailable = exchange.status === 'unavailable';

          return (
            <div key={exchange.id} className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${
              isWeekendOrHoliday ? 'bg-red-50/30' : ''
            } ${isUnavailable ? 'bg-gray-100' : ''}`}>
              {/* En-tête avec date et médecin */}
              <div className={`flex justify-between items-start mb-4 ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {format(date, 'EEEE d MMMM', { locale: fr })}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {periodNames[exchange.period]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {exchangeUser?.lastName.toUpperCase() || 'INCONNU'}
                    {history?.length > 0 && exchangeUser && exchanges.filter(e => e.interestedUsers?.includes(exchangeUser.id)).length > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({Math.round((history.filter(h => h.newUserId === exchangeUser?.id).length / exchanges.filter(e => e.interestedUsers?.includes(exchangeUser?.id)).length) * 100)}%)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {exchangeUser?.firstName || ''}
                  </div>
                </div>
              </div>

              {/* Garde et commentaire */}
              <div className={`flex items-center justify-between mb-4 ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                <span className={`px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-lg shadow-sm ${
                  exchange.period === 'M'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : exchange.period === 'AM'
                    ? 'bg-sky-50 text-sky-800 border border-sky-200'
                    : 'bg-violet-50 text-violet-800 border border-violet-200'
                }`}>
                  {exchange.shiftType}
                </span>
                <div className="text-sm text-gray-500">
                  {exchange.comment || <span className="text-gray-400 italic">Aucun commentaire</span>}
                </div>
              </div>

              {/* Garde indisponible */}
              {isUnavailable && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center text-amber-700">
                  <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                  <span>Cette garde est actuellement indisponible</span>
                </div>
              )}

              {/* Intéressés */}
              <div className="space-y-2">
                {interestedUsers.length > 0 && !isUnavailable ? (
                  interestedUsers.map(userId => (
                    <InterestedUserCard
                      key={userId}
                      userId={userId}
                      users={users}
                      exchange={exchange}
                      conflictStates={conflictStates}
                      userAssignments={userAssignments}
                      bagPhaseConfig={bagPhaseConfig}
                      onValidateExchange={onValidateExchange}
                      onRemoveUser={onRemoveUser}
                    />
                  ))
                ) : !isUnavailable ? (
                  <div className="text-sm text-gray-500 italic text-center py-2">
                    Aucun intéressé
                  </div>
                ) : null}
              </div>

              {/* Action */}
              {!isUnavailable && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleRejectClick(exchange.id)}
                    className={`inline-flex items-center p-2 border rounded-full ${
                      bagPhaseConfig.phase !== 'distribution'
                        ? 'border-gray-300 text-gray-300 bg-gray-50 cursor-not-allowed'
                        : 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                    }`}
                    disabled={bagPhaseConfig.phase !== 'distribution'}
                    title="Rejeter"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de confirmation pour le rejet */}
      <ConfirmationModal
        isOpen={showRejectConfirmation}
        title="Rejeter l'échange"
        message="Êtes-vous sûr de vouloir rejeter cet échange ? Cette action est irréversible."
        confirmLabel="Rejeter"
        onConfirm={handleConfirmReject}
        onCancel={() => {
          setShowRejectConfirmation(false);
          setExchangeToReject(null);
        }}
      />
    </div>
  );
};

export default ExchangeList;