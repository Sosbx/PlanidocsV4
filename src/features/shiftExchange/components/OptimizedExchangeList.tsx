import React, { memo, useMemo } from 'react';
import type { ShiftExchange } from '../types';
import type { User } from '../../../types/users';

interface OptimizedExchangeListProps {
  exchanges: ShiftExchange[];
  users: User[];
  currentUserId?: string;
  onToggleInterest: (exchange: ShiftExchange) => void;
  isInteractionDisabled: boolean;
  conflictStates: Record<string, boolean>;
  interestedPeriodsMap: Record<string, boolean>;
  showOwnShifts: boolean;
  showMyInterests: boolean;
}

/**
 * Composant d'item d'échange mémorisé pour éviter les re-renders inutiles
 */
const ExchangeItem = memo(({ 
  exchange, 
  user, 
  currentUserId,
  onToggleInterest,
  isInteractionDisabled,
  hasConflict,
  isInterested
}: {
  exchange: ShiftExchange;
  user?: User;
  currentUserId?: string;
  onToggleInterest: (exchange: ShiftExchange) => void;
  isInteractionDisabled: boolean;
  hasConflict: boolean;
  isInterested: boolean;
}) => {
  const isOwnShift = exchange.userId === currentUserId;
  const canInteract = !isInteractionDisabled && !isOwnShift && exchange.status === 'pending';
  
  const periodLabel = {
    'M': 'Matin',
    'AM': 'Après-midi',
    'S': 'Soir'
  }[exchange.period];
  
  return (
    <div className="p-4 border-b hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">
            {new Date(exchange.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {periodLabel} • {exchange.timeSlot}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {user ? `${user.firstName} ${user.lastName}` : 'Utilisateur inconnu'}
          </p>
          {exchange.comment && (
            <p className="text-sm text-gray-600 mt-2 italic">"{exchange.comment}"</p>
          )}
        </div>
        
        <div className="ml-4">
          {canInteract && (
            <button
              onClick={() => onToggleInterest(exchange)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isInterested
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : hasConflict
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              {isInterested ? 'Retirer intérêt' : 'Manifester intérêt'}
            </button>
          )}
          
          {isOwnShift && (
            <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
              Ma garde
            </span>
          )}
          
          {exchange.status === 'unavailable' && (
            <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-400 text-white rounded-full">
              Indisponible
            </span>
          )}
        </div>
      </div>
      
      {exchange.interestedUsers && exchange.interestedUsers.length > 0 && (
        <div className="mt-3 flex items-center text-sm text-gray-600">
          <span className="font-medium">{exchange.interestedUsers.length}</span>
          <span className="ml-1">personne{exchange.interestedUsers.length > 1 ? 's' : ''} intéressée{exchange.interestedUsers.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparaison personnalisée pour éviter les re-renders inutiles
  return (
    prevProps.exchange.id === nextProps.exchange.id &&
    prevProps.exchange.status === nextProps.exchange.status &&
    prevProps.exchange.interestedUsers?.length === nextProps.exchange.interestedUsers?.length &&
    prevProps.hasConflict === nextProps.hasConflict &&
    prevProps.isInterested === nextProps.isInterested &&
    prevProps.isInteractionDisabled === nextProps.isInteractionDisabled
  );
});

ExchangeItem.displayName = 'ExchangeItem';

/**
 * Liste optimisée des échanges avec virtualisation et mémorisation
 */
export const OptimizedExchangeList: React.FC<OptimizedExchangeListProps> = memo(({
  exchanges,
  users,
  currentUserId,
  onToggleInterest,
  isInteractionDisabled,
  conflictStates,
  interestedPeriodsMap,
  showOwnShifts,
  showMyInterests
}) => {
  // Filtrage mémorisé
  const filteredExchanges = useMemo(() => {
    return exchanges.filter(exchange => {
      const isOwnShift = exchange.userId === currentUserId;
      const isInterested = exchange.interestedUsers?.includes(currentUserId || '') || false;
      
      if (showMyInterests) {
        return isInterested;
      }
      
      if (!showOwnShifts && isOwnShift) {
        return false;
      }
      
      return true;
    });
  }, [exchanges, currentUserId, showOwnShifts, showMyInterests]);
  
  // Map des utilisateurs pour accès rapide
  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(user => map.set(user.id, user));
    return map;
  }, [users]);
  
  if (filteredExchanges.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        {showMyInterests ? 'Aucune garde où vous êtes intéressé' : 'Aucune garde disponible'}
      </div>
    );
  }
  
  return (
    <div className="divide-y divide-gray-200">
      {filteredExchanges.map(exchange => {
        const key = `${exchange.date}-${exchange.period}`;
        const hasConflict = conflictStates[exchange.id] || false;
        const isInterested = interestedPeriodsMap[key] || false;
        const user = usersMap.get(exchange.userId);
        
        return (
          <ExchangeItem
            key={exchange.id}
            exchange={exchange}
            user={user}
            currentUserId={currentUserId}
            onToggleInterest={onToggleInterest}
            isInteractionDisabled={isInteractionDisabled}
            hasConflict={hasConflict}
            isInterested={isInterested}
          />
        );
      })}
    </div>
  );
});

OptimizedExchangeList.displayName = 'OptimizedExchangeList';

export default OptimizedExchangeList;