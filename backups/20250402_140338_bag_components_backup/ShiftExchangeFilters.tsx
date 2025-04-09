import React from 'react';
import { AlertTriangle } from 'lucide-react';
import DisplayOptionsDropdown from './DisplayOptionsDropdown';

interface ShiftExchangeFiltersProps {
  filterPeriod: 'all' | 'M' | 'AM' | 'S';
  setFilterPeriod: (period: 'all' | 'M' | 'AM' | 'S') => void;
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
}

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
  bagPhaseConfig
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        {/* Bloc gauche avec filtres de période */}
        <div className="flex bg-gray-100 rounded-md p-0.5 shrink-0">
          <button 
            onClick={() => setFilterPeriod('all')}
            className={`min-w-[28px] px-1.5 py-0.5 text-xs rounded-md transition-colors ${filterPeriod === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            title="Toutes les périodes"
          >
            Tous
          </button>
          <button 
            onClick={() => setFilterPeriod('M')}
            className={`min-w-[22px] px-1.5 py-0.5 text-xs rounded-md transition-colors ${filterPeriod === 'M' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            title="M (Matin)"
          >
            M
          </button>
          <button 
            onClick={() => setFilterPeriod('AM')}
            className={`min-w-[22px] px-1.5 py-0.5 text-xs rounded-md transition-colors ${filterPeriod === 'AM' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            title="AM (Après-midi)"
          >
            AM
          </button>
          <button 
            onClick={() => setFilterPeriod('S')}
            className={`min-w-[22px] px-1.5 py-0.5 text-xs rounded-md transition-colors ${filterPeriod === 'S' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            title="S (Soir)"
          >
            S
          </button>
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
          />
        </div>
      </div>
    </div>
  );
};

export default ShiftExchangeFilters;