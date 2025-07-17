import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createParisDate, addMonthsParis, formatParisDate } from '@/utils/timezoneUtils';
import { format, parseISO, addDays, isAfter, isBefore, isToday, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import { isGrayedOut } from '../../../utils/dateUtils';
import { usePlanningView } from '../hooks';
import type { ShiftAssignment } from '../../../types/planning';
import type { User } from '../../../types/users';

// Types d'interface pour le composant
interface DailyPlanningViewProps {
  startDate: Date;
  endDate: Date;
  assignmentsByUser: { userId: string; userName: string; assignments: Record<string, ShiftAssignment> }[];
  selectedUserIds: string[];
  onUserSelect: (userIds: string[]) => void;
  users: User[];
  shiftTypeFilter: string | null;
  onShiftTypeFilterChange: (shiftType: string | null) => void;
  getUserFullName: (userId: string) => string;
  bagPhaseConfig: { phase: 'submission' | 'distribution' | 'completed' };
  handleUserSearch: (searchTerm: string) => void;
}

/**
 * Composant affichant les plannings jour par jour avec tous les médecins
 */
const DailyPlanningView: React.FC<DailyPlanningViewProps> = ({
  startDate,
  endDate,
  assignmentsByUser,
  selectedUserIds,
  onUserSelect,
  users,
  shiftTypeFilter,
  onShiftTypeFilterChange,
  getUserFullName,
  bagPhaseConfig,
  handleUserSearch
}) => {
  // Utiliser le hook de navigation du planning
  const { viewType, navigateNext, navigatePrevious, jumpToDate } = usePlanningView('month', { startDate, endDate });
  
  // État pour le terme de recherche
  const [searchTerm, setSearchTerm] = useState('');
  
  // État pour les périodes de temps (M/AM/S) à afficher
  const [visiblePeriods, setVisiblePeriods] = useState<('M' | 'AM' | 'S')[]>(['M', 'AM', 'S']);
  
  // État pour le mode d'affichage (semaine complète ou jours ouvrés)
  const [viewMode, setViewMode] = useState<'week' | 'workdays'>('workdays');
  
  // État pour le site sélectionné
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  
  // Générer les jours à afficher entre la date de début et la date de fin
  const daysToShow = useMemo(() => {
    const days = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Si on est en mode jours ouvrés, filtrer les weekends
      if (viewMode === 'workdays') {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclure samedi (6) et dimanche (0)
          days.push(new Date(currentDate));
        }
      } else {
        days.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }
    
    return days;
  }, [startDate, endDate, viewMode]);
  
  // État pour les sites visibles
  const [visibleSites, setVisibleSites] = useState<string[]>([]);
  
  // Effet pour initialiser les sites visibles
  useEffect(() => {
    if (availableSites.length > 0 && visibleSites.length === 0) {
      setVisibleSites(availableSites);
    }
  }, [availableSites, visibleSites.length]);
  
  // Fonction pour basculer la visibilité d'un site
  const toggleSiteVisibility = useCallback((site: string) => {
    setVisibleSites(prev => {
      if (prev.includes(site)) {
        return prev.filter(s => s !== site);
      } else {
        return [...prev, site];
      }
    });
  }, []);
  
  // Fonction pour basculer tous les sites
  const toggleAllSites = useCallback(() => {
    if (visibleSites.length === availableSites.length) {
      setVisibleSites([]);
    } else {
      setVisibleSites([...availableSites]);
    }
  }, [availableSites, visibleSites.length]);
  
  // Extraire tous les sites disponibles depuis les assignments
  const availableSites = useMemo(() => {
    const sites = new Set<string>();
    
    assignmentsByUser.forEach(userAssignments => {
      Object.values(userAssignments.assignments).forEach(assignment => {
        if (assignment.site) {
          sites.add(assignment.site);
        }
      });
    });
    
    return Array.from(sites).sort();
  }, [assignmentsByUser]);
  
  // Extraire tous les types de gardes disponibles
  const availableShiftTypes = useMemo(() => {
    const shiftTypes = new Set<string>();
    
    assignmentsByUser.forEach(userAssignments => {
      Object.values(userAssignments.assignments).forEach(assignment => {
        if (assignment.shiftType) {
          shiftTypes.add(assignment.shiftType);
        }
      });
    });
    
    return Array.from(shiftTypes).sort();
  }, [assignmentsByUser]);
  
  // Filtrer les assignments en fonction des filtres
  const filteredAssignments = useMemo(() => {
    let filtered = assignmentsByUser;
    
    // Filtrer par utilisateurs sélectionnés
    filtered = filtered.filter(userAssignment => 
      selectedUserIds.includes(userAssignment.userId)
    );
    
    // Filtrer par type de garde si un filtre est actif
    if (shiftTypeFilter) {
      filtered = filtered.map(userAssignment => {
        const filteredUserAssignments: Record<string, ShiftAssignment> = {};
        
        Object.entries(userAssignment.assignments).forEach(([key, assignment]) => {
          if (assignment.shiftType === shiftTypeFilter) {
            filteredUserAssignments[key] = assignment;
          }
        });
        
        return {
          ...userAssignment,
          assignments: filteredUserAssignments
        };
      });
    }
    
    // Filtrer par site si un site est sélectionné
    if (selectedSite) {
      filtered = filtered.map(userAssignment => {
        const filteredUserAssignments: Record<string, ShiftAssignment> = {};
        
        Object.entries(userAssignment.assignments).forEach(([key, assignment]) => {
          if (assignment.site === selectedSite) {
            filteredUserAssignments[key] = assignment;
          }
        });
        
        return {
          ...userAssignment,
          assignments: filteredUserAssignments
        };
      });
    }
    // Filtrer par sites visibles si aucun site spécifique n'est sélectionné
    else if (visibleSites.length > 0 && visibleSites.length < availableSites.length) {
      filtered = filtered.map(userAssignment => {
        const filteredUserAssignments: Record<string, ShiftAssignment> = {};
        
        Object.entries(userAssignment.assignments).forEach(([key, assignment]) => {
          const site = assignment.site || 'Non spécifié';
          if (visibleSites.includes(site)) {
            filteredUserAssignments[key] = assignment;
          }
        });
        
        return {
          ...userAssignment,
          assignments: filteredUserAssignments
        };
      });
    }
    
    return filtered;
  }, [assignmentsByUser, selectedUserIds, shiftTypeFilter, selectedSite, visibleSites, availableSites.length]);
  
  // Obtenir tous les types de garde pour une journée donnée et un site donné
  const getShiftTypesForDay = useCallback((day: Date, period: 'M' | 'AM' | 'S') => {
    const dayStr = formatParisDate(day, 'yyyy-MM-dd');
    const cellKey = `${dayStr}-${period}`;
    const shiftTypes = new Map<string, { doctors: string[], site: string | undefined }>();
    
    filteredAssignments.forEach(userAssignment => {
      const assignment = userAssignment.assignments[cellKey];
      if (assignment) {
        const shiftType = assignment.shiftType || 'Non spécifié';
        if (!shiftTypes.has(shiftType)) {
          shiftTypes.set(shiftType, { 
            doctors: [userAssignment.userName],
            site: assignment.site
          });
        } else {
          const current = shiftTypes.get(shiftType);
          if (current) {
            current.doctors.push(userAssignment.userName);
          }
        }
      }
    });
    
    return Array.from(shiftTypes.entries()).map(([type, data]) => ({
      type,
      doctors: data.doctors,
      site: data.site
    }));
  }, [filteredAssignments]);
  
  // Gérer la recherche d'utilisateurs
  const handleSearch = useCallback(() => {
    if (searchTerm.trim()) {
      handleUserSearch(searchTerm);
    }
    setSearchTerm('');
  }, [searchTerm, handleUserSearch]);
  
  // Gérer la sélection/désélection de toutes les périodes
  const toggleAllPeriods = useCallback(() => {
    if (visiblePeriods.length === 3) {
      setVisiblePeriods([]);
    } else {
      setVisiblePeriods(['M', 'AM', 'S']);
    }
  }, [visiblePeriods]);
  
  // Gérer la sélection/désélection d'une période spécifique
  const togglePeriod = useCallback((period: 'M' | 'AM' | 'S') => {
    setVisiblePeriods(prev => {
      if (prev.includes(period)) {
        return prev.filter(p => p !== period);
      } else {
        return [...prev, period];
      }
    });
  }, []);
  
  // Aller au jour actuel
  const goToToday = useCallback(() => {
    jumpToDate(createParisDate());
  }, [jumpToDate]);
  
  // Afficher la semaine actuelle
  const goToThisWeek = useCallback(() => {
    const today = createParisDate();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Semaine commence le lundi
    jumpToDate(weekStart);
  }, [jumpToDate]);
  
  // Regrouper les shift types par site
  const shiftTypesBySite = useMemo(() => {
    const sites = new Map<string, Set<string>>();
    
    // Ajouter un site "Non spécifié" pour les gardes sans site
    sites.set('Non spécifié', new Set<string>());
    
    assignmentsByUser.forEach(userAssignment => {
      Object.values(userAssignment.assignments).forEach(assignment => {
        const site = assignment.site || 'Non spécifié';
        const shiftType = assignment.shiftType || 'Non spécifié';
        
        if (!sites.has(site)) {
          sites.set(site, new Set<string>());
        }
        
        sites.get(site)?.add(shiftType);
      });
    });
    
    // Convertir en objet pour faciliter l'utilisation
    const result: Record<string, string[]> = {};
    sites.forEach((shiftTypes, site) => {
      result[site] = Array.from(shiftTypes).sort();
    });
    
    return result;
  }, [assignmentsByUser]);
  
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* En-tête avec contrôles de navigation et de filtrage */}
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
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
          
          <div className="flex space-x-1">
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
            >
              Aujourd'hui
            </button>
            <button
              onClick={goToThisWeek}
              className="px-3 py-1 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
            >
              Cette semaine
            </button>
          </div>
          
          <button
            onClick={navigateNext}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
            aria-label="Période suivante"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="text-gray-700 font-medium ml-2 flex items-center">
            <span className="mr-2">{formatParisDate(startDate, 'MMMM yyyy', { locale: frLocale })}</span>
            <div className="hidden md:flex space-x-1">
              {Array.from({ length: 6 }, (_, i) => {
                const monthDate = addMonthsParis(createParisDate(), i - 3);
                const isCurrentMonth = monthDate.getMonth() === startDate.getMonth() && 
                                      monthDate.getFullYear() === startDate.getFullYear();
                return (
                  <button
                    key={i}
                    onClick={() => jumpToDate(monthDate)}
                    className={`px-2 py-1 text-xs rounded ${
                      isCurrentMonth
                        ? 'bg-blue-100 text-blue-800 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {formatParisDate(monthDate, 'MMM', { locale: frLocale })}
                  </button>
                );
              })}
            </div>
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
          
          {/* Filtres de sites */}
          <div className="relative group">
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-1"
              onClick={() => {}}
            >
              <span>{visibleSites.length === 0 ? 'Aucun site' : visibleSites.length === availableSites.length ? 'Tous les sites' : `${visibleSites.length} site(s)`}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute left-0 mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 p-1 z-20 hidden group-hover:block">
              <div className="p-2">
                <div className="flex items-center justify-between pb-2 mb-2 border-b">
                  <span className="text-sm font-medium">Sites</span>
                  <button 
                    onClick={toggleAllSites}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {visibleSites.length === availableSites.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {availableSites.map(site => (
                    <div key={site} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`site-${site}`}
                        checked={visibleSites.includes(site)}
                        onChange={() => toggleSiteVisibility(site)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`site-${site}`} className="ml-2 text-sm text-gray-700 truncate">
                        {site}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
          
          {/* Sélection du mode d'affichage (semaine complète ou jours ouvrés) */}
          <div className="bg-gray-100 rounded-md p-0.5 flex">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                viewMode === 'week'
                  ? 'bg-white shadow-sm text-gray-800'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Semaine complète
            </button>
            <button
              onClick={() => setViewMode('workdays')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                viewMode === 'workdays'
                  ? 'bg-white shadow-sm text-gray-800'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Jours ouvrés
            </button>
          </div>
          
          {/* Filtres de périodes */}
          <div className="flex items-center space-x-2 ml-1">
            <button
              onClick={toggleAllPeriods}
              className="p-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {visiblePeriods.length === 3 ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            
            <div className="flex bg-gray-100 rounded-md p-0.5">
              <button
                onClick={() => togglePeriod('M')}
                className={`px-2 py-1 text-xs font-medium rounded-md ${
                  visiblePeriods.includes('M')
                    ? 'bg-amber-100 text-amber-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                M
              </button>
              <button
                onClick={() => togglePeriod('AM')}
                className={`px-2 py-1 text-xs font-medium rounded-md ${
                  visiblePeriods.includes('AM')
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                AM
              </button>
              <button
                onClick={() => togglePeriod('S')}
                className={`px-2 py-1 text-xs font-medium rounded-md ${
                  visiblePeriods.includes('S')
                    ? 'bg-violet-100 text-violet-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                S
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tableau principal - vue horizontale avec jours en colonnes */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 sticky left-0 bg-gray-50 z-10">
                Site / Type
              </th>
              {daysToShow.map(day => (
                <th 
                  key={day.toISOString()} 
                  className={`px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase ${
                    isToday(day) 
                      ? 'bg-blue-50' 
                      : isGrayedOut(day) 
                        ? 'bg-gray-100' 
                        : ''
                  }`}
                >
                  <div>{formatParisDate(day, 'd', { locale: frLocale })}</div>
                  <div>{formatParisDate(day, 'EEE', { locale: frLocale }).toUpperCase()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Grouper par site et par type de garde */}
            {Object.entries(shiftTypesBySite)
              // Ne montrer que les sites visibles ou sélectionnés
              .filter(([site, _]) => selectedSite === site || visibleSites.includes(site) || !selectedSite && visibleSites.length === 0)
              .flatMap(([site, shiftTypes]) => 
              // Pour chaque site, afficher une ligne d'en-tête et une ligne par type de garde
              [
                // En-tête de site
                site !== 'Non spécifié' && (
                  <tr key={`site-${site}`} className="bg-gray-50/80">
                    <td 
                      className="px-4 py-2 whitespace-nowrap text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50/80 z-10"
                      colSpan={daysToShow.length + 1}
                    >
                      <div className="flex items-center justify-between">
                        <span>{site}</span>
                        <button 
                          onClick={() => toggleSiteVisibility(site)}
                          className="text-xs text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200"
                          title={visibleSites.includes(site) ? "Masquer ce site" : "Afficher ce site"}
                        >
                          {visibleSites.includes(site) ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
                
                // Ligne par type de garde
                ...shiftTypes.map(shiftType => 
                  // Pour chaque type de garde, créer une ligne pour chaque période (M/AM/S)
                  visiblePeriods.map(period => (
                    <tr 
                      key={`${site}-${shiftType}-${period}`} 
                      className="hover:bg-gray-50/80"
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-sm sticky left-0 bg-white z-10 border-r">
                        <div className="flex items-center">
                          <span 
                            className={`inline-block w-4 h-4 rounded-full mr-2 ${
                              period === 'M' 
                                ? 'bg-amber-100' 
                                : period === 'AM' 
                                  ? 'bg-blue-100' 
                                  : 'bg-violet-100'
                            }`}
                          ></span>
                          <span className="font-medium">{shiftType}</span>
                          <span 
                            className={`ml-1 text-xs ${
                              period === 'M' 
                                ? 'text-amber-700' 
                                : period === 'AM' 
                                  ? 'text-blue-700' 
                                  : 'text-violet-700'
                            }`}
                          >
                            ({period})
                          </span>
                        </div>
                      </td>
                      
                      {/* Cellules pour chaque jour */}
                      {daysToShow.map(day => {
                        const shiftTypesForDay = getShiftTypesForDay(day, period);
                        // Filtrer pour ne montrer que le type de garde actuel pour ce site
                        const shiftsForThisType = shiftTypesForDay.filter(
                          shift => shift.type === shiftType && (shift.site === site || (shift.site === undefined && site === 'Non spécifié'))
                        );
                        
                        return (
                          <td 
                            key={`${day.toISOString()}-${period}`} 
                            className={`px-2 py-1 text-sm border ${
                              isToday(day) 
                                ? 'bg-blue-50/30' 
                                : isGrayedOut(day) 
                                  ? 'bg-gray-50/50' 
                                  : ''
                            } ${
                              period === 'M' 
                                ? 'border-l-amber-200' 
                                : period === 'AM' 
                                  ? 'border-l-blue-200' 
                                  : 'border-l-violet-200'
                            } border-l-2`}
                          >
                            {shiftsForThisType.length > 0 ? (
                              <div>
                                {shiftsForThisType.map((shift, index) => (
                                  <div 
                                    key={index} 
                                    className="flex flex-col items-center text-center py-1"
                                  >
                                    {shift.doctors.map((doctor, idx) => (
                                      <span 
                                        key={idx} 
                                        className={`text-xs font-medium px-2 py-0.5 rounded-md shadow-sm border mb-1 last:mb-0 w-full ${
                                          period === 'M' 
                                            ? 'bg-amber-50 border-amber-100 text-amber-800' 
                                            : period === 'AM' 
                                              ? 'bg-blue-50 border-blue-100 text-blue-800' 
                                              : 'bg-violet-50 border-violet-100 text-violet-800'
                                        }`}
                                      >
                                        {doctor}
                                      </span>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-gray-400 py-1">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )
              ].filter(Boolean) // Filtrer les éléments null/undefined
            )}
            
            {/* Si aucune donnée n'est disponible, afficher un message */}
            {Object.keys(shiftTypesBySite).length === 0 && (
              <tr>
                <td 
                  colSpan={daysToShow.length + 1} 
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Aucune garde à afficher pour la période sélectionnée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Légende au bas du tableau */}
      <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500 border-t">
        <div className="flex flex-wrap justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-amber-100 rounded-full"></span>
              <span>M: Matin</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-blue-100 rounded-full"></span>
              <span>AM: Après-midi</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-violet-100 rounded-full"></span>
              <span>S: Soir</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 border border-blue-300 bg-blue-50 rounded-full"></span>
              <span>Aujourd'hui</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 border border-gray-300 bg-gray-50 rounded-full"></span>
              <span>Week-end/Jour férié</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 flex items-center">
            <span className="mr-2">Sites affichés: {visibleSites.length}/{availableSites.length}</span>
            <button
              onClick={toggleAllSites}
              className="text-blue-600 hover:text-blue-800 text-xs underline"
            >
              {visibleSites.length === availableSites.length ? 'Tout masquer' : 'Tout afficher'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyPlanningView;