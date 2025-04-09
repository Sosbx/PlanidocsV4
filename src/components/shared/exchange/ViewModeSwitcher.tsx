import React from 'react';
import { Calendar, List } from 'lucide-react';

interface ViewModeSwitcherProps {
  viewMode: 'list' | 'calendar';
  setViewMode: (mode: 'list' | 'calendar') => void;
  showText?: boolean;
  className?: string;
}

/**
 * Composant partagé pour basculer entre les vues liste et calendrier
 * Utilisé à la fois dans ShiftExchangePage et DirectExchangePage
 */
const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({
  viewMode,
  setViewMode,
  showText = true,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => setViewMode('list')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
          viewMode === 'list'
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        aria-label="Vue liste"
      >
        <List className="h-4 w-4" />
        {showText && <span className="text-xs font-medium">Liste</span>}
      </button>
      <button
        onClick={() => setViewMode('calendar')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
          viewMode === 'calendar'
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        aria-label="Vue calendrier"
      >
        <Calendar className="h-4 w-4" />
        {showText && <span className="text-xs font-medium">Calendrier</span>}
      </button>
    </div>
  );
};

export default ViewModeSwitcher;
