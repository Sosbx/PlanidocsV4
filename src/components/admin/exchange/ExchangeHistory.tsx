import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RotateCcw, Send } from 'lucide-react';
import type { ExchangeHistory } from '../../../types/planning';
import type { User } from '../../../types/users';

interface ExchangeHistoryListProps {
  history: ExchangeHistory[];
  users: User[];
  bagPhaseConfig: BagPhaseConfig;
  onRevertExchange: (historyId: string) => void;
  onNotify: (historyId: string) => void;
}

const periodNames = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};

const ExchangeHistoryList: React.FC<ExchangeHistoryListProps> = ({
  history,
  users,
  bagPhaseConfig,
  onRevertExchange,
  onNotify
}) => {
  if (history.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-500 text-center">
          Aucun échange validé dans l'historique
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
                Validation
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Détails de l'échange
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map(exchange => {
              const originalUser = users.find(u => u.id === exchange.originalUserId);
              const newUser = users.find(u => u.id === exchange.newUserId);
              const validatedBy = users.find(u => u.id === exchange.validatedBy);
              const exchangeDate = new Date(exchange.date);
              const validationDate = new Date(exchange.exchangedAt);

              return (
                <tr key={exchange.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {validationDate.toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {validatedBy && (
                      <div className="text-xs text-gray-500 mt-1">
                        Validé par {validatedBy.firstName} {validatedBy.lastName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-sm font-medium text-gray-900">
                        {format(exchangeDate, 'EEEE d MMMM', { locale: fr })}
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        ({periodNames[exchange.period]})
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm mt-2">
                      <div className="font-medium text-gray-900">
                        {originalUser ? originalUser.lastName.toUpperCase() : 'INCONNU'}
                        <span className={`text-xs ml-1 px-2 py-0.5 rounded-full border font-medium ${
                          exchange.period === 'M'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : exchange.period === 'AM'
                            ? 'bg-sky-100 text-sky-800 border-sky-200'
                            : 'bg-violet-100 text-violet-800 border-violet-200'
                        }`}>
                          {exchange.shiftType}
                        </span>
                      </div>
                      {exchange.newShiftType ? (
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      )}
                      <div className="font-medium text-gray-900">
                        {newUser ? newUser.lastName.toUpperCase() : 'INCONNU'}
                        {exchange.newShiftType && (
                          <span className={`text-xs ml-1 px-2 py-0.5 rounded-full border font-medium ${
                            exchange.period === 'M'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : exchange.period === 'AM'
                              ? 'bg-sky-100 text-sky-800 border-sky-200'
                              : 'bg-violet-100 text-violet-800 border-violet-200'
                          }`}>
                            {exchange.newShiftType}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onRevertExchange(exchange.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        title="Rejeter l'échange de garde"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Annuler
                      </button>
                      {bagPhaseConfig.phase === 'completed' && (
                        <button
                          onClick={() => onNotify(exchange.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Notifier
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Version mobile */}
      <div className="md:hidden space-y-4">
        {history.map(exchange => {
          const originalUser = users.find(u => u.id === exchange.originalUserId);
          const newUser = users.find(u => u.id === exchange.newUserId);
          const exchangeDate = new Date(exchange.date);
          const validationDate = new Date(exchange.exchangedAt);
          const validatedBy = users.find(u => u.id === exchange.validatedBy);

          return (
            <div key={exchange.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              {/* Détails de l'échange */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm font-medium text-gray-900">
                    {format(exchangeDate, 'EEEE d MMMM', { locale: fr })}
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {periodNames[exchange.period]}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {originalUser ? originalUser.lastName.toUpperCase() : 'INCONNU'}
                      <span className={`text-xs ml-1 px-2 py-0.5 rounded-full border font-medium ${
                        exchange.period === 'M'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : exchange.period === 'AM'
                          ? 'bg-sky-100 text-sky-800 border-sky-200'
                          : 'bg-violet-100 text-violet-800 border-violet-200'
                      }`}>
                        {exchange.shiftType}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center px-2">
                      {exchange.newShiftType ? (
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      )}
                    </div>
                    <div className="font-medium text-gray-900">
                      <div className="font-medium text-gray-900">
                        {newUser ? newUser.lastName.toUpperCase() : 'INCONNU'}
                        {exchange.newShiftType && (
                          <span className={`text-xs ml-1 px-2 py-0.5 rounded-full border font-medium ${
                            exchange.period === 'M'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : exchange.period === 'AM'
                              ? 'bg-sky-100 text-sky-800 border-sky-200'
                              : 'bg-violet-100 text-violet-800 border-violet-200'
                          }`}>
                            {exchange.newShiftType}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => onRevertExchange(exchange.id)}
                        className="inline-flex items-center p-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50"
                        title="Annuler l'échange"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </button>
                      {bagPhaseConfig.phase === 'completed' && (
                        <button
                          onClick={() => onNotify(exchange.id)}
                          className="inline-flex items-center p-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50"
                          title="Notifier"
                        >
                          <Send className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Info de validation en bas et plus discrète */}
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                Validé le {validationDate.toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {validatedBy && (
                  <span> par {validatedBy.firstName} {validatedBy.lastName}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExchangeHistoryList;