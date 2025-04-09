import React from 'react';
import { List, Calendar } from 'lucide-react';

interface ViewModeSwitcherProps {
  viewMode: 'list' | 'calendar';
  setViewMode: (mode: 'list' | 'calendar') => void;
  showText?: boolean;
}

/**
 * Composant permettant de basculer entre les modes d'affichage liste et calendrier
 * pour la bourse aux gardes
 * 
 * @param viewMode - Mode d'affichage actuel ('list' ou 'calendar')
 * @param setViewMode - Fonction pour changer le mode d'affichage
 * @param showText - Indique si le texte doit être affiché à côté des icônes (par défaut: true)
 */
const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({ 
  viewMode, 
  setViewMode,
  showText = true 
}) => {
  return (
    <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
      <button
        onClick={() => setViewMode('list')}
        className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'list'
            ? 'bg-indigo-100 text-indigo-800'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <List className="h-4 w-4" />
        {showText && <span className="hidden xs:inline-block">Liste</span>}
      </button>
      <button
        onClick={() => setViewMode('calendar')}
        className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'calendar'
            ? 'bg-indigo-100 text-indigo-800'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Calendar className="h-4 w-4" />
        {showText && <span className="hidden xs:inline-block">Agenda</span>}
      </button>
    </div>
  );
};

export default ViewModeSwitcher;
