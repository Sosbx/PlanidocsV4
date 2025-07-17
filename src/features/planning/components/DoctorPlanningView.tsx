import React, { useState, useCallback, useMemo } from 'react';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { usePlanningView } from '../hooks';
import { LoadingSpinner } from '../../../components/common';
import { isGrayedOut } from '../../../utils/dateUtils';
import type { ShiftAssignment } from '../../../types/planning';
import type { User } from '../../../types/users';
import { format, addDays, isToday } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';

// Import des composants nécessaires au rendu des cellules
import VirtualizedMonthList from '../../../components/VirtualizedMonthList';
import PlanningGridCell from '../../../components/PlanningGridCell';

// Types d'interface pour le composant
interface DoctorPlanningViewProps {
  startDate: Date;
  endDate: Date;
  selectedUserIds: string[];
  onUserSelect: (userIds: string[]) => void;
  users: User[];
  shiftTypeFilter: string | null;
  onShiftTypeFilterChange: (shiftType: string | null) => void;
  getUserFullName: (userId: string) => string;
  bagPhaseConfig: { phase: 'submission' | 'distribution' | 'completed' };
  handleUserSearch: (searchTerm: string) => void;
  getUserAssignments: (userId: string) => Record<string, ShiftAssignment>;
}

/**
 * Composant affichant les plannings par médecin
 */
const DoctorPlanningView: React.FC<DoctorPlanningViewProps> = ({
  startDate,
  endDate,
  selectedUserIds,
  onUserSelect,
  users,
  shiftTypeFilter,
  onShiftTypeFilterChange,
  getUserFullName,
  bagPhaseConfig,
  handleUserSearch,
  getUserAssignments
}) => {
  // Utiliser le hook de navigation du planning
  const { viewType, setViewType, navigateNext, navigatePrevious, jumpToDate } = usePlanningView('month', { startDate, endDate });
  
  // État pour le terme de recherche
  const [searchTerm, setSearchTerm] = useState('');
  
  // État pour le mode d'affichage (calendrier/liste)
  const [displayMode, setDisplayMode] = useState<'calendar' | 'table'>('calendar');
  
  // État pour la vue multiple (côte à côte ou empilée)
  const [multipleView, setMultipleView] = useState<'sideBySide' | 'stacked'>('sideBySide');
  
  // État pour les types de garde disponibles
  const availableShiftTypes = useMemo(() => {
    const shiftTypes = new Set<string>();
    
    // Récupérer tous les types de garde utilisés par les médecins sélectionnés
    selectedUserIds.forEach(userId => {
      const assignments = getUserAssignments(userId);
      Object.values(assignments).forEach(assignment => {
        if (assignment.shiftType) {
          shiftTypes.add(assignment.shiftType);
        }
      });
    });
    
    return Array.from(shiftTypes).sort();
  }, [selectedUserIds, getUserAssignments]);
  
  // Gérer la recherche d'utilisateurs
  const handleSearch = useCallback(() => {
    if (searchTerm.trim()) {
      handleUserSearch(searchTerm);
    }
    setSearchTerm('');
  }, [searchTerm, handleUserSearch]);
  
  // Générer les jours à afficher pour le mode tableau
  const daysToShow = useMemo(() => {
    const days = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    
    return days;
  }, [startDate, endDate]);
  
  // Filtrer les gardes par type de garde
  const getFilteredAssignments = useCallback((userId: string) => {
    const assignments = getUserAssignments(userId);
    
    if (!shiftTypeFilter) return assignments;
    
    // Filtrer les assignments pour ne garder que ceux du type sélectionné
    const filteredAssignments: Record<string, ShiftAssignment> = {};
    
    Object.entries(assignments).forEach(([key, assignment]) => {
      if (assignment.shiftType === shiftTypeFilter) {
        filteredAssignments[key] = assignment;
      }
    });
    
    return filteredAssignments;
  }, [getUserAssignments, shiftTypeFilter]);
  
  // Vérifier si un médecin a une garde à une date et période données
  const hasAssignment = useCallback((userId: string, date: Date, period: 'M' | 'AM' | 'S') => {
    const assignments = getFilteredAssignments(userId);
    const dateStr = formatParisDate(date, 'yyyy-MM-dd');
    const key = `${dateStr}-${period}`;
    
    return assignments[key] !== undefined;
  }, [getFilteredAssignments]);
  
  // Obtenir l'assignation pour un médecin à une date et période données
  const getAssignment = useCallback((userId: string, date: Date, period: 'M' | 'AM' | 'S') => {
    const assignments = getFilteredAssignments(userId);
    const dateStr = formatParisDate(date, 'yyyy-MM-dd');
    const key = `${dateStr}-${period}`;
    
    return assignments[key];
  }, [getFilteredAssignments]);
  
  // Ajouter/Supprimer un médecin de la sélection
  const toggleUserSelection = useCallback((userId: string) => {
    onUserSelect(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter(id => id !== userId)
        : [...selectedUserIds, userId]
    );
  }, [selectedUserIds, onUserSelect]);
  
  // Aller au jour actuel
  const goToToday = useCallback(() => {
    jumpToDate(createParisDate());
  }, [jumpToDate]);
  
  // Rendu du mode calendrier
  const renderCalendarView = () => {
    // Si aucun médecin n'est sélectionné, afficher un message
    if (selectedUserIds.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          Sélectionnez au moins un médecin pour afficher son planning.
        </div>
      );
    }
    
    return (
      <div className={`grid ${
        multipleView === 'sideBySide' 
          ? `grid-cols-1 ${
              selectedUserIds.length === 2 ? 'md:grid-cols-2' : 
              selectedUserIds.length >= 3 ? 'md:grid-cols-3' : ''
            }`
          : 'grid-cols-1'
      } gap-6`}>
        {selectedUserIds.map(userId => (
          <div key={userId} className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-800">{getUserFullName(userId)}</h3>
            </div>
            <div className="p-2">
              <VirtualizedMonthList
                startDate={startDate}
                endDate={endDate}
                assignments={getFilteredAssignments(userId)}
                exchanges={{}}
                directExchanges={{}}
                replacements={{}}
                desiderata={{}}
                receivedShifts={{}}
                userId={userId}
                isAdminView={true}
                showDesiderata={false}
                bagPhaseConfig={bagPhaseConfig}
                height={400}
                width="100%"
              />
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Rendu du mode tableau
  const renderTableView = () => {
    // Si aucun médecin n'est sélectionné, afficher un message
    if (selectedUserIds.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          Sélectionnez au moins un médecin pour afficher son planning.
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              {selectedUserIds.map(userId => (
                <React.Fragment key={userId}>
                  {['M', 'AM', 'S'].map(period => (
                    <th
                      key={`${userId}-${period}`}
                      className={`px-1 py-2 text-center text-xs font-medium border-l ${
                        period === 'M'
                          ? 'bg-amber-50 text-amber-800'
                          : period === 'AM'
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-violet-50 text-violet-800'
                      }`}
                    >
                      <div className="truncate max-w-[90px]">{getUserFullName(userId)}</div>
                      <div className="text-[10px] text-gray-500">{period}</div>
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {daysToShow.map(day => (
              <tr
                key={day.toISOString()}
                className={`${
                  isToday(day) ? 'bg-blue-50/30' : isGrayedOut(day) ? 'bg-gray-50/50' : ''
                } hover:bg-gray-50/80`}
              >
                <td className={`px-4 py-2 whitespace-nowrap text-sm ${
                  isToday(day) ? 'font-semibold text-blue-700' : 'text-gray-600'
                }`}>
                  <div>
                    {formatParisDate(day, 'd MMMM', { locale: frLocale })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatParisDate(day, 'EEEE', { locale: frLocale })}
                  </div>
                </td>
                
                {selectedUserIds.map(userId => (
                  <React.Fragment key={userId}>
                    {(['M', 'AM', 'S'] as const).map(period => {
                      const assignment = getAssignment(userId, day, period);
                      
                      return (
                        <td
                          key={`${userId}-${day.toISOString()}-${period}`}
                          className={`px-2 py-2 text-center text-sm border-l ${
                            period === 'M'
                              ? 'text-amber-800'
                              : period === 'AM'
                                ? 'text-blue-800'
                                : 'text-violet-800'
                          }`}
                        >
                          {assignment ? (
                            <div className="font-medium">
                              {assignment.shiftType}
                              {assignment.timeSlot && (
                                <div className="text-xs text-gray-500">
                                  {assignment.timeSlot}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* En-tête avec contrôles de navigation et de filtrage */}
      <div className="bg-white rounded-lg shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex space-x-2">
          <button
            onClick={navigatePrevious}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
            aria-label="Période précédente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
          >
            Aujourd'hui
          </button>
          
          <button
            onClick={navigateNext}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
            aria-label="Période suivante"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="text-gray-700 font-medium ml-2">
            {formatParisDate(startDate, 'MMMM yyyy', { locale: frLocale })}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Recherche de médecin */}
          <div className="flex max-w-xs">
            <input
              type="text"
              placeholder="Rechercher un médecin..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="px-3 py-1.5 text-sm rounded-l-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[180px]"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-r-md border border-l-0 border-gray-300 hover:bg-blue-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
          
          {/* Filtre par type de garde */}
          <select
            value={shiftTypeFilter || ''}
            onChange={e => onShiftTypeFilterChange(e.target.value || null)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les types de garde</option>
            {availableShiftTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          {/* Sélection du mode d'affichage */}
          <div className="bg-gray-100 rounded-md p-0.5 flex">
            <button
              onClick={() => setDisplayMode('calendar')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                displayMode === 'calendar'
                  ? 'bg-white shadow-sm text-gray-800'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Calendrier
            </button>
            <button
              onClick={() => setDisplayMode('table')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                displayMode === 'table'
                  ? 'bg-white shadow-sm text-gray-800'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Tableau
            </button>
          </div>
          
          {/* Mode de vue multiple (uniquement visible en mode calendrier) */}
          {displayMode === 'calendar' && selectedUserIds.length > 1 && (
            <div className="bg-gray-100 rounded-md p-0.5 flex">
              <button
                onClick={() => setMultipleView('sideBySide')}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  multipleView === 'sideBySide'
                    ? 'bg-white shadow-sm text-gray-800'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Afficher les plannings côte à côte"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </button>
              <button
                onClick={() => setMultipleView('stacked')}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  multipleView === 'stacked'
                    ? 'bg-white shadow-sm text-gray-800'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Empiler les plannings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Type de vue calendrier (uniquement visible en mode calendrier) */}
          {displayMode === 'calendar' && (
            <div className="bg-gray-100 rounded-md p-0.5 flex">
              <button
                onClick={() => setViewType('month')}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  viewType === 'month'
                    ? 'bg-white shadow-sm text-gray-800'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Mois
              </button>
              <button
                onClick={() => setViewType('quadrimester')}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  viewType === 'quadrimester'
                    ? 'bg-white shadow-sm text-gray-800'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                4 mois
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Sélection des médecins */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Médecins sélectionnés ({selectedUserIds.length})</h3>
        <div className="flex flex-wrap gap-2">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => toggleUserSelection(user.id)}
              className={`px-3 py-1.5 text-sm rounded-md ${
                selectedUserIds.includes(user.id)
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {user.lastName} {user.firstName}
              {selectedUserIds.includes(user.id) && (
                <span className="ml-1.5">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Contenu principal */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {displayMode === 'calendar' ? renderCalendarView() : renderTableView()}
      </div>
    </div>
  );
};

export default DoctorPlanningView;