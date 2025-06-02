import React, { memo, useCallback, useRef, useEffect, useState, useMemo } from 'react';
import type { ShiftExchange } from '../../../types/shiftExchange';
import type { User } from '../../../types/users';

interface VirtualizedExchangeListProps {
  exchanges: ShiftExchange[];
  users: User[];
  currentUserId?: string;
  onToggleInterest: (exchange: ShiftExchange) => void;
  isInteractionDisabled: boolean;
  conflictStates: Record<string, boolean>;
  interestedPeriodsMap: Record<string, boolean>;
  itemHeight?: number;
  overscan?: number;
  className?: string;
}

/**
 * Hook personnalisé pour la virtualisation
 */
const useVirtualization = <T extends { id: string }>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    setScrollTop
  };
};

/**
 * Composant d'item d'échange optimisé
 */
const VirtualExchangeItem = memo(({ 
  exchange, 
  user, 
  currentUserId,
  onToggleInterest,
  isInteractionDisabled,
  hasConflict,
  isInterested,
  style
}: {
  exchange: ShiftExchange;
  user?: User;
  currentUserId?: string;
  onToggleInterest: (exchange: ShiftExchange) => void;
  isInteractionDisabled: boolean;
  hasConflict: boolean;
  isInterested: boolean;
  style: React.CSSProperties;
}) => {
  const isOwnShift = exchange.userId === currentUserId;
  const canInteract = !isInteractionDisabled && !isOwnShift && exchange.status === 'pending';
  
  const periodLabel = {
    'M': 'Matin',
    'AM': 'Après-midi',
    'S': 'Soir'
  }[exchange.period];
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onToggleInterest(exchange);
  }, [exchange, onToggleInterest]);
  
  return (
    <div 
      className="px-4 py-3 border-b hover:bg-gray-50 transition-colors"
      style={style}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">
            {new Date(exchange.date).toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short'
            })}
            <span className="ml-2 text-sm font-normal text-gray-600">
              {periodLabel} • {exchange.timeSlot}
            </span>
          </h4>
          <p className="text-sm text-gray-500 truncate">
            {user ? `${user.firstName} ${user.lastName}` : 'Utilisateur'}
          </p>
          {exchange.comment && (
            <p className="text-xs text-gray-600 mt-1 italic truncate">
              "{exchange.comment}"
            </p>
          )}
        </div>
        
        <div className="ml-3 flex-shrink-0">
          {canInteract && (
            <button
              onClick={handleClick}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all transform hover:scale-105 ${
                isInterested
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : hasConflict
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              {isInterested ? 'Retirer' : 'Intéressé'}
            </button>
          )}
          
          {isOwnShift && (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
              Ma garde
            </span>
          )}
          
          {exchange.status === 'unavailable' && (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-400 text-white rounded">
              Indisponible
            </span>
          )}
        </div>
      </div>
      
      {exchange.interestedUsers && exchange.interestedUsers.length > 0 && (
        <div className="mt-2 flex items-center text-xs text-gray-600">
          <span className="inline-flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            {exchange.interestedUsers.length}
          </span>
        </div>
      )}
    </div>
  );
});

VirtualExchangeItem.displayName = 'VirtualExchangeItem';

/**
 * Liste virtualisée des échanges pour de meilleures performances
 */
export const VirtualizedExchangeList: React.FC<VirtualizedExchangeListProps> = memo(({
  exchanges,
  users,
  currentUserId,
  onToggleInterest,
  isInteractionDisabled,
  conflictStates,
  interestedPeriodsMap,
  itemHeight = 80,
  overscan = 3,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  
  // Map des utilisateurs pour accès rapide
  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(user => map.set(user.id, user));
    return map;
  }, [users]);
  
  // Virtualisation
  const {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  } = useVirtualization(exchanges, itemHeight, containerHeight, overscan);
  
  // Observer pour la hauteur du conteneur
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Gestion du scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, [setScrollTop]);
  
  if (exchanges.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Aucune garde disponible
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: '100%', minHeight: '400px' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((exchange, index) => {
            const key = `${exchange.date}-${exchange.period}`;
            const hasConflict = conflictStates[exchange.id] || false;
            const isInterested = interestedPeriodsMap[key] || false;
            const user = usersMap.get(exchange.userId);
            
            return (
              <VirtualExchangeItem
                key={exchange.id}
                exchange={exchange}
                user={user}
                currentUserId={currentUserId}
                onToggleInterest={onToggleInterest}
                isInteractionDisabled={isInteractionDisabled}
                hasConflict={hasConflict}
                isInterested={isInterested}
                style={{ 
                  height: itemHeight,
                  position: 'absolute',
                  top: index * itemHeight,
                  left: 0,
                  right: 0
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

VirtualizedExchangeList.displayName = 'VirtualizedExchangeList';

export default VirtualizedExchangeList;