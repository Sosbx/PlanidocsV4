import React from 'react';
import { Filter, Sun, Sunset, Moon } from 'lucide-react';
import DisplayOptionsDropdown from '../../bag/DisplayOptionsDropdown';
import type { BagPhaseConfig } from '../../../types/planning';

interface ExchangeFilterBarProps {
  filterPeriod: 'all' | 'M' | 'AM' | 'S';
  setFilterPeriod: (value: 'all' | 'M' | 'AM' | 'S') => void;
  showOwnShifts: boolean;
  setShowOwnShifts: (value: boolean) => void;
  showMyInterests: boolean;
  setShowMyInterests: (value: boolean) => void;
  showDesiderata: boolean;
  setShowDesiderata: (value: boolean) => void;
  hidePrimaryDesiderata: boolean;
  setHidePrimaryDesiderata: (value: boolean) => void;
  hideSecondaryDesiderata: boolean;
  setHideSecondaryDesiderata: (value: boolean) => void;
  isInteractionDisabled: boolean;
  bagPhaseConfig: BagPhaseConfig;
  className?: string;
}

/**
 * Composant partagé pour le filtrage des échanges
 * Utilisé à la fois dans ShiftExchangePage et DirectExchangePage
 */
const ExchangeFilterBar: React.FC<ExchangeFilterBarProps> = ({
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
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 ${className}`}>
      <div className="flex flex-row items-center justify-between">
        {/* Titre et filtres par période */}
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
              onClick={() => setFilterPeriod('M')}
              className={`flex items-center px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPeriod === 'M'
                  ? 'bg-amber-50 text-amber-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Sun className="h-2.5 w-2.5 mr-0.5" />
              M
            </button>
            <button
              onClick={() => setFilterPeriod('AM')}
              className={`flex items-center px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPeriod === 'AM'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Sunset className="h-2.5 w-2.5 mr-0.5" />
              AM
            </button>
            <button
              onClick={() => setFilterPeriod('S')}
              className={`flex items-center px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPeriod === 'S'
                  ? 'bg-purple-50 text-purple-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Moon className="h-2.5 w-2.5 mr-0.5" />
              S
            </button>
          </div>
        </div>
        
        {/* Menu déroulant d'affichage aligné à droite */}
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
        />
      </div>
    </div>
  );
};

export default ExchangeFilterBar;
