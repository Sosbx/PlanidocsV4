import React from 'react';
import { Filter, Sun, Sunset, Moon, AlertTriangle } from 'lucide-react';
import DisplayOptionsDropdown from './DisplayOptionsDropdown';
import { ShiftPeriod } from '../types';

interface ShiftExchangeFiltersProps {
  filterPeriod: 'all' | ShiftPeriod;
  setFilterPeriod: (period: 'all' | ShiftPeriod) => void;
  showOwnShifts: boolean;
  setShowOwnShifts: (show: boolean) => void;
  showMyInterests: boolean;
  setShowMyInterests: (show: boolean) => void;
  showDesiderata: boolean;
  setShowDesiderata: (show: boolean) => void;
  hidePrimaryDesiderata: boolean;
  setHidePrimaryDesiderata: (hide: boolean) => void;
  hideSecondaryDesiderata: boolean;
  setHideSecondaryDesiderata: (hide: boolean) => void;
  isInteractionDisabled: boolean;
  bagPhaseConfig: {
    phase: string;
  };
  isCalendarView?: boolean; // Indique si on est dans la vue calendrier
}

/**
 * Composant de filtres pour la bourse aux gardes
 * Permet de filtrer les gardes par période et de configurer les options d'affichage
 */
const ShiftExchangeFilters: React.FC<ShiftExchangeFiltersProps> = ({
  filterPeriod,
  setFilterPeriod,
  showOwnShifts,
  setShowOwnShifts,
  showMyInterests,
  setShowMyInterests,
  showDesiderata,
  setShowDesiderata,
  hidePrimaryDesiderata,
  setHidePrimaryDesiderata,
  hideSecondaryDesiderata,
  setHideSecondaryDesiderata,
  isInteractionDisabled,
  bagPhaseConfig,
  isCalendarView = false
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        {/* Bloc gauche avec filtres de période */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-gray-700">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Filtres</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterPeriod('all')}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPeriod === 'all'
                  ? 'bg-gray-100 text-gray-800 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterPeriod(ShiftPeriod.MORNING)}
              className={`flex items-center px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPeriod === ShiftPeriod.MORNING
                  ? 'bg-amber-50 text-amber-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Sun className="h-2.5 w-2.5 mr-0.5" />
              M
            </button>
            <button
              onClick={() => setFilterPeriod(ShiftPeriod.AFTERNOON)}
              className={`flex items-center px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPeriod === ShiftPeriod.AFTERNOON
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Sunset className="h-2.5 w-2.5 mr-0.5" />
              AM
            </button>
            <button
              onClick={() => setFilterPeriod(ShiftPeriod.EVENING)}
              className={`flex items-center px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPeriod === ShiftPeriod.EVENING
                  ? 'bg-purple-50 text-purple-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Moon className="h-2.5 w-2.5 mr-0.5" />
              S
            </button>
          </div>
        </div>
        
        {/* Bloc central avec alerte conditionnelle */}
        <div className="flex-grow flex justify-center">
          {bagPhaseConfig.phase === 'distribution' && (
            <div className="bg-yellow-50 px-2 py-1 rounded-md text-yellow-700 text-xs font-medium flex items-center gap-1 shrink-0">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              <span className="hidden sm:inline">Répartition en cours</span>
            </div>
          )}
        </div>

        {/* Bloc droit avec le menu d'affichage */}
        <div className="shrink-0">
          <DisplayOptionsDropdown 
            showOwnShifts={showOwnShifts}
            setShowOwnShifts={setShowOwnShifts}
            showMyInterests={showMyInterests}
            setShowMyInterests={setShowMyInterests}
            showDesiderata={showDesiderata} 
            setShowDesiderata={setShowDesiderata}
            hidePrimaryDesiderata={hidePrimaryDesiderata}
            setHidePrimaryDesiderata={setHidePrimaryDesiderata}
            hideSecondaryDesiderata={hideSecondaryDesiderata}
            setHideSecondaryDesiderata={setHideSecondaryDesiderata}
            isInteractionDisabled={isInteractionDisabled}
            isCalendarView={isCalendarView}
          />
        </div>
      </div>
    </div>
  );
};

export default ShiftExchangeFilters;
