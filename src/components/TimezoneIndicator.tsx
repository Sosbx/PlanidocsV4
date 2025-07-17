import React from 'react';
import { Clock } from 'lucide-react';
import { useTimezoneInfo } from '../hooks/useTimezone';

interface TimezoneIndicatorProps {
  className?: string;
  showOnlyIfDifferent?: boolean;
}

/**
 * Indicateur du fuseau horaire utilisé par l'application
 * Affiche une petite indication que toutes les dates sont en heure de Paris
 */
export const TimezoneIndicator: React.FC<TimezoneIndicatorProps> = ({ 
  className = '', 
  showOnlyIfDifferent = true 
}) => {
  const { timezone, userTimezone, isDifferentTimezone, timezoneOffset } = useTimezoneInfo();
  
  // Si on ne doit afficher que quand différent et que c'est le même timezone, ne rien afficher
  if (showOnlyIfDifferent && !isDifferentTimezone) {
    return null;
  }
  
  return (
    <div className={`flex items-center gap-1 text-xs text-gray-500 ${className}`}>
      <Clock className="h-3 w-3" />
      <span>
        {timezone}
        {isDifferentTimezone && (
          <span className="ml-1 text-amber-600">
            ({timezoneOffset.display} vs {userTimezone})
          </span>
        )}
      </span>
    </div>
  );
};

export default TimezoneIndicator;