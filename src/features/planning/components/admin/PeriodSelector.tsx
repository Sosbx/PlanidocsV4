import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ViewType, DateRange } from '../../types/viewTypes';

interface PeriodSelectorProps {
  onViewChange: (view: ViewType) => void;
  onRangeChange: (startDate: Date, endDate: Date) => void;
  onMonthsToShowChange: (months: number) => void;
  currentView: ViewType;
  currentRange: DateRange;
  currentMonthsToShow: number;
}

/**
 * Composant pour sélectionner la période de visualisation du planning
 */
const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  onViewChange,
  onRangeChange,
  onMonthsToShowChange,
  currentView,
  currentRange,
  currentMonthsToShow
}) => {
  // État local pour le nombre de mois personnalisé
  const [customMonths, setCustomMonths] = useState<number>(currentMonthsToShow);
  // État local pour les dates personnalisées
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(currentRange.startDate, 'yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    format(currentRange.endDate, 'yyyy-MM-dd')
  );

  /**
   * Gère le changement de type de vue
   */
  const handleViewChange = (view: ViewType) => {
    onViewChange(view);
  };

  /**
   * Gère le changement du nombre de mois personnalisé
   */
  const handleCustomMonthsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 24) {
      setCustomMonths(value);
    }
  };

  /**
   * Applique le nombre de mois personnalisé
   */
  const applyCustomMonths = () => {
    onMonthsToShowChange(customMonths);
  };

  /**
   * Gère le changement de date de début personnalisée
   */
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomStartDate(e.target.value);
  };

  /**
   * Gère le changement de date de fin personnalisée
   */
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomEndDate(e.target.value);
  };

  /**
   * Applique la plage de dates personnalisée
   */
  const applyCustomRange = () => {
    const startDate = new Date(customStartDate);
    const endDate = new Date(customEndDate);
    
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
      onRangeChange(startDate, endDate);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <h2 className="text-sm font-medium text-gray-700">Période :</h2>
        
        {/* Boutons de vue prédéfinis */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleViewChange('month')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              currentView === 'month'
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mois
          </button>
          <button
            onClick={() => handleViewChange('quadrimester')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              currentView === 'quadrimester'
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            4 mois
          </button>
          <button
            onClick={() => handleViewChange('semester')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              currentView === 'semester'
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semestre
          </button>
          <button
            onClick={() => handleViewChange('year')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              currentView === 'year'
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Année
          </button>
          <button
            onClick={() => handleViewChange('custom')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              currentView === 'custom'
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Personnalisé
          </button>
        </div>
      </div>
      
      {/* Options pour la vue personnalisée */}
      {currentView === 'custom' && (
        <div className="mt-3 p-3 bg-gray-50 rounded-md">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <h3 className="text-xs font-medium text-gray-700 mb-2">Par nombre de mois :</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={customMonths}
                  onChange={handleCustomMonthsChange}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
                <span className="text-xs text-gray-600">mois</span>
                <button
                  onClick={applyCustomMonths}
                  className="ml-2 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Appliquer
                </button>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-xs font-medium text-gray-700 mb-2">Par plage de dates :</h3>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Début :</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={handleStartDateChange}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Fin :</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={handleEndDateChange}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <button
                  onClick={applyCustomRange}
                  className="mt-4 sm:mt-0 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Affichage de la période actuelle */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-600">
          <span className="font-medium">Période actuelle :</span>{' '}
          {format(currentRange.startDate, 'dd MMMM yyyy', { locale: fr })} - {format(currentRange.endDate, 'dd MMMM yyyy', { locale: fr })}
        </div>
        
        <div className="text-xs text-gray-600">
          <span className="font-medium">Mois affichés :</span> {currentMonthsToShow}
        </div>
      </div>
    </div>
  );
};

export default PeriodSelector;
