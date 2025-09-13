import React, { useMemo } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import { RotateCcw, XCircle, RefreshCw, UserMinus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import '../../../../styles/BadgeStyles.css';
import type { ExchangeHistory as ExchangeHistoryType, BagPhaseConfig, ShiftPeriod } from '../../../../types/planning';
import type { User } from '../../../../types/users';

interface ExchangeHistoryListProps {
  history: ExchangeHistoryType[];
  users: User[];
  bagPhaseConfig: BagPhaseConfig;
  onRevertExchange: (historyId: string) => void;
  filterPeriod?: 'all' | ShiftPeriod;
  filterUserId?: string;
  sortColumn?: 'validation' | 'date';
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (column: 'validation' | 'date') => void;
}

const periodNames: Record<'M' | 'AM' | 'S', string> = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};

// Fonction d'aide pour récupérer le nom de la période en toute sécurité
const getPeriodName = (period: string): string => {
  if (period === 'M') return periodNames.M;
  if (period === 'AM') return periodNames.AM;
  if (period === 'S') return periodNames.S;
  return period; // Valeur par défaut si la période n'est pas reconnue
};

const ExchangeHistoryList: React.FC<ExchangeHistoryListProps> = ({
  history,
  users,
  bagPhaseConfig,
  onRevertExchange,
  filterPeriod = 'all',
  filterUserId = '',
  sortColumn = 'validation',
  sortDirection = 'desc',
  onSortChange
}) => {
  // Filtrage et tri des données
  const filteredAndSortedHistory = useMemo(() => {
    let filtered = [...history];
    
    // Filtrer par période
    if (filterPeriod !== 'all') {
      filtered = filtered.filter(exchange => exchange.period === filterPeriod);
    }
    
    // Filtrer par utilisateur
    if (filterUserId) {
      filtered = filtered.filter(exchange => 
        exchange.originalUserId === filterUserId || 
        exchange.newUserId === filterUserId ||
        exchange.removedUserId === filterUserId
      );
    }
    
    // Trier les résultats
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      if (sortColumn === 'validation') {
        compareValue = new Date(a.exchangedAt).getTime() - new Date(b.exchangedAt).getTime();
      } else if (sortColumn === 'date') {
        compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });
    
    return filtered;
  }, [history, filterPeriod, filterUserId, sortColumn, sortDirection]);
  
  if (filteredAndSortedHistory.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-500 text-center">
          {filterPeriod !== 'all' || filterUserId 
            ? 'Aucun échange ne correspond aux filtres sélectionnés'
            : 'Aucun échange validé dans l\'historique'
          }
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
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                N°
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => onSortChange?.('validation')}
                  className="flex items-center gap-1 hover:text-gray-700 transition-colors group"
                >
                  Validation
                  {sortColumn === 'validation' ? (
                    sortDirection === 'desc' ? 
                      <ArrowDown className="h-3 w-3 text-indigo-600" /> : 
                      <ArrowUp className="h-3 w-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => onSortChange?.('date')}
                  className="flex items-center gap-1 hover:text-gray-700 transition-colors group"
                >
                  Détails de l'échange
                  {sortColumn === 'date' ? (
                    sortDirection === 'desc' ? 
                      <ArrowDown className="h-3 w-3 text-indigo-600" /> : 
                      <ArrowUp className="h-3 w-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedHistory.map((exchange, index) => {
              const originalUser = users.find(u => u.id === exchange.originalUserId);
              const newUser = users.find(u => u.id === exchange.newUserId);
              const validatedBy = users.find(u => u.id === exchange.validatedBy);
              const exchangeDate = new Date(exchange.date);
              const validationDate = new Date(exchange.exchangedAt);
              const isRejected = exchange.status === 'rejected';
              const rejectedBy = isRejected && exchange.rejectedBy ? 
                users.find(u => u.id === exchange.rejectedBy) : null;
              const isInterestRemoved = exchange.status === 'interest_removed';
              const removedUser = isInterestRemoved && exchange.removedUserId ? 
                users.find(u => u.id === exchange.removedUserId) : null;
              const removedBy = isInterestRemoved && exchange.removedBy ? 
                users.find(u => u.id === exchange.removedBy) : null;

              return (
                <tr key={exchange.id} className={`hover:bg-gray-50 ${
                  isRejected ? 'bg-red-50' : 
                  isInterestRemoved ? 'bg-yellow-50' : ''
                }`}>
                  <td className="px-3 py-4 text-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </td>
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
                    {isRejected ? (
                      <div className="text-xs text-red-600 mt-1">
                        Rejeté par {rejectedBy ? `${rejectedBy.firstName} ${rejectedBy.lastName}` : exchange.rejectedBy || 'admin'}
                      </div>
                    ) : isInterestRemoved ? (
                      <div className="text-xs text-yellow-700 mt-1">
                        Retrait par {removedBy ? `${removedBy.firstName} ${removedBy.lastName}` : exchange.removedBy || 'admin'}
                      </div>
                    ) : (
                      validatedBy && (
                        <div className="text-xs text-gray-500 mt-1">
                          Validé par {validatedBy.firstName} {validatedBy.lastName}
                        </div>
                      )
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-sm font-medium text-gray-900">
                        {formatParisDate(exchangeDate, 'EEEE d MMMM', { locale: frLocale })}
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        ({getPeriodName(exchange.period)})
                      </span>
                    </div>
                    
                    {isInterestRemoved ? (
                      // Affichage spécifique pour les retraits d'intérêt
                      <div className="flex items-center gap-4 text-sm mt-2">
                        <div className="font-medium text-gray-900">
                          {originalUser ? originalUser.lastName.toUpperCase() : 'INCONNU'}
                          <span className={`text-xs ml-1 px-2 py-0.5 rounded-full border font-medium bg-yellow-100 text-yellow-800 border-yellow-200`}>
                            {exchange.shiftType}
                          </span>
                        </div>
                        <UserMinus className="h-4 w-4 text-yellow-600" />
                        <div className="font-medium text-gray-900">
                          {removedUser ? removedUser.lastName.toUpperCase() : 'INCONNU'}
                          <span className="text-xs ml-1 text-yellow-700">
                            (retiré de la liste des intéressés)
                          </span>
                        </div>
                      </div>
                    ) : (
                      // Affichage normal pour les échanges et rejets
                      <div className="flex items-center gap-4 text-sm mt-2">
                        <div className="font-medium text-gray-900">
                          {originalUser ? originalUser.lastName.toUpperCase() : 'INCONNU'}
                          <span className={`text-xs ml-1 px-2 py-0.5 rounded-full border font-medium ${
                            isRejected
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : exchange.period === 'M'
                              ? 'badge-morning'
                              : exchange.period === 'AM'
                              ? 'badge-afternoon'
                              : 'badge-evening'
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
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onRevertExchange(exchange.id)}
                        className={`inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          isRejected 
                            ? 'border-green-300 text-green-700 hover:bg-green-50 focus:ring-green-500'
                            : isInterestRemoved
                            ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 focus:ring-yellow-500'
                            : 'border-orange-300 text-orange-700 hover:bg-orange-50 focus:ring-orange-500'
                        }`}
                        title={isRejected ? "Restaurer l'échange rejeté" : isInterestRemoved ? "Restaurer l'intérêt" : "Annuler l'échange de garde"}
                      >
                        {isRejected ? (
                          <><RefreshCw className="h-4 w-4 mr-2" />Restaurer</>
                        ) : isInterestRemoved ? (
                          <><RefreshCw className="h-4 w-4 mr-2" />Restaurer</>
                        ) : (
                          <><RotateCcw className="h-4 w-4 mr-2" />Annuler</>
                        )}
                      </button>
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
        {filteredAndSortedHistory.map((exchange, index) => {
          const originalUser = users.find(u => u.id === exchange.originalUserId);
          const newUser = users.find(u => u.id === exchange.newUserId);
          const exchangeDate = new Date(exchange.date);
          const validationDate = new Date(exchange.exchangedAt);
          const validatedBy = users.find(u => u.id === exchange.validatedBy);
          const isRejected = exchange.status === 'rejected';
          const rejectedBy = isRejected && exchange.rejectedBy ? 
            users.find(u => u.id === exchange.rejectedBy) : null;
          const isInterestRemoved = exchange.status === 'interest_removed';
          const removedUser = isInterestRemoved && exchange.removedUserId ? 
            users.find(u => u.id === exchange.removedUserId) : null;
          const removedBy = isInterestRemoved && exchange.removedBy ? 
            users.find(u => u.id === exchange.removedBy) : null;

          return (
            <div key={exchange.id} className={`relative rounded-lg shadow-sm border p-4 ${
              isRejected 
                ? 'bg-red-50 border-red-200' 
                : isInterestRemoved
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-white border-gray-200'
            }`}>
              {/* Numéro de ligne en haut à gauche */}
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-gray-600 text-white text-xs flex items-center justify-center font-medium">
                {index + 1}
              </div>
              {/* Détails de l'échange */}
              <div className="pl-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm font-medium text-gray-900">
                    {formatParisDate(exchangeDate, 'EEEE d MMMM', { locale: frLocale })}
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {getPeriodName(exchange.period)}
                  </span>
                </div>

                {isInterestRemoved ? (
                  // Affichage spécifique pour les retraits d'intérêt en mode mobile
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {originalUser ? originalUser.lastName.toUpperCase() : 'INCONNU'}
                        <span className="text-xs ml-1 px-2 py-0.5 rounded-full border font-medium bg-yellow-100 text-yellow-800 border-yellow-200">
                          {exchange.shiftType}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserMinus className="h-4 w-4 text-yellow-600" />
                      <div className="font-medium text-gray-900">
                        {removedUser ? removedUser.lastName.toUpperCase() : 'INCONNU'}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Affichage normal pour les échanges et rejets
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {originalUser ? originalUser.lastName.toUpperCase() : 'INCONNU'}
                        <span className={`text-xs ml-1 px-2 py-0.5 rounded-full border font-medium ${
                          isRejected
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : exchange.period === 'M'
                            ? 'badge-morning'
                            : exchange.period === 'AM'
                            ? 'badge-afternoon'
                            : 'badge-evening'
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
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => onRevertExchange(exchange.id)}
                    className={`inline-flex items-center p-2 border text-sm font-medium rounded-md bg-white ${
                      isRejected
                        ? 'border-green-300 text-green-700 hover:bg-green-50'
                        : isInterestRemoved
                        ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                        : 'border-orange-300 text-orange-700 hover:bg-orange-50'
                    }`}
                    title={isRejected ? "Restaurer" : isInterestRemoved ? "Restaurer l'intérêt" : "Annuler l'échange"}
                  >
                    {isRejected || isInterestRemoved ? (
                      <RefreshCw className="h-5 w-5" />
                    ) : (
                      <RotateCcw className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Info de validation en bas et plus discrète */}
              <div className={`mt-3 pt-3 border-t text-xs ${
                isRejected 
                  ? 'border-red-200 text-red-600' 
                  : isInterestRemoved
                  ? 'border-yellow-200 text-yellow-600'
                  : 'border-gray-200 text-gray-500'
              }`}>
                {isRejected ? 'Rejeté' : isInterestRemoved ? 'Retiré' : 'Validé'} le {validationDate.toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {isRejected ? (
                  rejectedBy && (
                    <span> par {rejectedBy.firstName} {rejectedBy.lastName}</span>
                  )
                ) : isInterestRemoved ? (
                  removedBy && (
                    <span> par {removedBy.firstName} {removedBy.lastName}</span>
                  )
                ) : (
                  validatedBy && (
                    <span> par {validatedBy.firstName} {validatedBy.lastName}</span>
                  )
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
