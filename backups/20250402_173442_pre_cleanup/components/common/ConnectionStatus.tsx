import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

export const ConnectionStatus: React.FC = () => {
  const { isOnline, hasError } = useConnectionStatus();

  if (!hasError) return null;

  return (
    <div className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
      isOnline ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
    }`}>
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      <span>
        {isOnline 
          ? 'Connecté à Firebase'
          : 'Mode hors ligne - Les modifications seront synchronisées une fois la connexion rétablie'
        }
      </span>
    </div>
  );
};