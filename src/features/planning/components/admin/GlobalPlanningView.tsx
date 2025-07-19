import React, { useMemo, useState } from 'react';
import { formatParisDate, parseParisDate } from '@/utils/timezoneUtils';
import { format, eachDayOfInterval, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Archive, Calendar, FileSpreadsheet } from 'lucide-react';
import type { User } from '../../../../types/users';
import type { GeneratedPlanning } from '../../../../types/planning';
import { ExportLogModal } from './ExportLogModal';
import { ExportAstreinteModal } from './ExportAstreinteModal';
import { useToast } from '../../../../hooks/useToast';

interface GlobalPlanningViewProps {
  users: User[];
  plannings: Record<string, Record<string, GeneratedPlanning>>;
  startDate: Date;
  endDate: Date;
  associationId: string;
  onDateChange?: (startDate: Date, endDate: Date) => void;
}

// Liste ordonnée des types de postes (groupés par période puis par ordre alphabétique)
const SHIFT_TYPES_BY_PERIOD = {
  'Matin': ['CM', 'HM', 'MC', 'ML', 'MM', 'RM', 'SM'],
  'Après-midi': ['AC', 'AL', 'CA', 'CT', 'HA', 'NA', 'RA', 'SA'],
  'Soir': ['CS', 'HS', 'NC', 'NL', 'NM', 'NR', 'NZ', 'RS', 'SS']
};

// Liste plate de tous les types de postes dans l'ordre
const SHIFT_TYPES = Object.values(SHIFT_TYPES_BY_PERIOD).flat();

// Couleurs pour les différents types de postes (par période)
// Cohérent avec le reste du site : Matin=amber, Après-midi=blue, Soir=violet
const SHIFT_COLORS: Record<string, string> = {
  // Matin
  'ML': 'bg-amber-100 text-blue-900',
  'MC': 'bg-amber-100 text-blue-900',
  'MM': 'bg-amber-100 text-blue-900',
  'CM': 'bg-amber-100 text-blue-900',
  'HM': 'bg-amber-100 text-blue-900',
  'RM': 'bg-amber-100 text-blue-900',
  'SM': 'bg-amber-100 text-blue-900',
  // Après-midi
  'AC': 'bg-blue-100 text-blue-900',
  'AL': 'bg-blue-100 text-blue-900',
  'CA': 'bg-blue-100 text-blue-900',
  'CT': 'bg-blue-100 text-blue-900',
  'HA': 'bg-blue-100 text-blue-900',
  'NA': 'bg-blue-100 text-blue-900',
  'RA': 'bg-blue-100 text-blue-900',
  'SA': 'bg-blue-100 text-blue-900',
  // Soir
  'CS': 'bg-violet-100 text-violet-800',
  'HS': 'bg-violet-100 text-violet-800',
  'NC': 'bg-violet-100 text-violet-800',
  'NL': 'bg-violet-100 text-violet-800',
  'NM': 'bg-violet-100 text-violet-800',
  'NR': 'bg-violet-100 text-violet-800',
  'NZ': 'bg-violet-100 text-violet-800',
  'RS': 'bg-violet-100 text-violet-800',
  'SS': 'bg-violet-100 text-violet-800',
};

interface ShiftData {
  userId: string;
  userName: string;
  shiftType: string;
  period: string;
}

interface ShiftRow {
  shiftType: string;
  shiftLabel: string;
  data: Record<string, ShiftData | null>;
  // Pour chaque date, stocker combien d'instances de ce type existent
  instanceCounts?: Record<string, number>;
}

const GlobalPlanningView: React.FC<GlobalPlanningViewProps> = ({
  users,
  plannings,
  startDate,
  endDate,
  associationId,
  onDateChange
}) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportAstreinteModal, setShowExportAstreinteModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const { showToast } = useToast();
  
  // Log pour déboguer
  console.log('GlobalPlanningView - associationId:', associationId);
  // Calculer les données groupées par date et type de poste
  const groupedData = useMemo(() => {
    const data: Record<string, Record<string, ShiftData[]>> = {};
    
    // Parcourir tous les plannings des utilisateurs
    Object.entries(plannings).forEach(([periodId, periodPlannings]) => {
      Object.entries(periodPlannings).forEach(([userId, userPlanning]) => {
        const user = users.find(u => u.id === userId);
        if (!user || !userPlanning.assignments) return;
        
        const userName = `${user.lastName} ${user.firstName}`;
        
        // Parcourir toutes les assignments de cet utilisateur
        Object.entries(userPlanning.assignments).forEach(([key, assignment]) => {
          if (!assignment || !assignment.date || !assignment.shiftType) return;
          
          const dateStr = assignment.date;
          const shiftType = assignment.shiftType;
          const period = assignment.type || assignment.period || '';
          
          // Initialiser la structure si nécessaire
          if (!data[dateStr]) {
            data[dateStr] = {};
          }
          if (!data[dateStr][shiftType]) {
            data[dateStr][shiftType] = [];
          }
          
          // Ajouter les données
          data[dateStr][shiftType].push({
            userId,
            userName,
            shiftType,
            period
          });
        });
      });
    });
    
    return data;
  }, [users, plannings]);
  
  // Calculer les lignes du tableau
  const shiftRows = useMemo(() => {
    const rows: ShiftRow[] = [];
    
    // D'abord, déterminer tous les types de postes qui ont des données
    const activeShiftTypes = new Set<string>();
    Object.values(groupedData).forEach(dateData => {
      Object.keys(dateData).forEach(shiftType => {
        if (dateData[shiftType].length > 0) {
          activeShiftTypes.add(shiftType);
        }
      });
    });
    
    // Pour chaque type de poste actif, créer les lignes nécessaires
    SHIFT_TYPES.forEach(shiftType => {
      if (!activeShiftTypes.has(shiftType)) return;
      
      // Collecter toutes les affectations pour ce type sur toute la période
      const allAssignments: { date: string; shifts: ShiftData[] }[] = [];
      const instanceCountsByDate: Record<string, number> = {};
      
      eachDayOfInterval({ start: startDate, end: endDate }).forEach(date => {
        const dateStr = formatParisDate(date, 'yyyy-MM-dd');
        const shiftsForDay = groupedData[dateStr]?.[shiftType] || [];
        if (shiftsForDay.length > 0) {
          allAssignments.push({ date: dateStr, shifts: shiftsForDay });
          instanceCountsByDate[dateStr] = shiftsForDay.length;
        }
      });
      
      // Déterminer le nombre maximum d'instances nécessaires
      const maxInstances = Math.max(...Object.values(instanceCountsByDate), 0);
      
      // Créer les lignes nécessaires
      for (let i = 0; i < maxInstances; i++) {
        const row: ShiftRow = {
          shiftType,
          shiftLabel: shiftType, // On garde toujours le label sans numéro
          data: {},
          instanceCounts: instanceCountsByDate
        };
        
        // Remplir les données pour chaque date
        let hasAnyData = false;
        eachDayOfInterval({ start: startDate, end: endDate }).forEach(date => {
          const dateStr = formatParisDate(date, 'yyyy-MM-dd');
          const shiftsForDay = groupedData[dateStr]?.[shiftType] || [];
          row.data[dateStr] = shiftsForDay[i] || null;
          if (shiftsForDay[i]) hasAnyData = true;
        });
        
        // N'ajouter la ligne que si elle contient au moins une donnée
        if (hasAnyData) {
          rows.push(row);
        }
      }
    });
    
    return rows;
  }, [groupedData, startDate, endDate]);
  
  // Générer la liste des dates
  const dates = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);
  
  // Fonction pour obtenir la couleur de fond d'une cellule
  const getCellColor = (shiftType: string): string => {
    return SHIFT_COLORS[shiftType] || 'bg-gray-50 text-gray-700';
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">Vue globale des plannings</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-600">
                Période du {formatParisDate(startDate, 'dd/MM/yyyy', { locale: fr })} au {formatParisDate(endDate, 'dd/MM/yyyy', { locale: fr })}
              </p>
              <button
                onClick={() => setShowDatePicker(true)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                title="Modifier la période"
              >
                <Calendar className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              title="Exporter l'archive"
            >
              <Archive className="h-4 w-4 mr-1.5" />
              Export Global (.log)
            </button>
            <button
              onClick={() => setShowExportAstreinteModal(true)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              title="Exporter les astreintes"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Export Astreinte (.xlsx)
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Poste
              </th>
              {dates.map((date) => (
                <th
                  key={date.toISOString()}
                  className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    isWeekend(date) ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="normal-case">{formatParisDate(date, 'EEE dd', { locale: fr })}</div>
                  <div className="text-[10px] text-gray-400 italic normal-case">{formatParisDate(date, 'MMM', { locale: fr })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(SHIFT_TYPES_BY_PERIOD).map(([period, shiftTypes]) => {
              const periodRows = shiftRows.filter(row => shiftTypes.includes(row.shiftType));
              if (periodRows.length === 0) return null;
              
              return (
                <React.Fragment key={period}>
                  {/* Ligne de séparation pour la période */}
                  <tr className="bg-gray-100">
                    <td colSpan={dates.length + 1} className="px-4 py-1 text-xs font-semibold text-gray-600 uppercase">
                      {period}
                    </td>
                  </tr>
                  {periodRows.map((row, rowIndex) => {
                    // Déterminer l'index de cette ligne parmi les lignes du même type
                    const sameTypeRows = periodRows.filter(r => r.shiftType === row.shiftType);
                    const rowTypeIndex = sameTypeRows.indexOf(row);
                    
                    return (
                      <tr key={`${row.shiftType}-${rowIndex}`} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">
                          {sameTypeRows.length > 1 ? (
                            <>
                              {row.shiftType}
                              <span className="text-xs text-gray-400">{rowTypeIndex + 1}</span>
                            </>
                          ) : (
                            row.shiftLabel
                          )}
                        </td>
                {dates.map((date) => {
                  const dateStr = formatParisDate(date, 'yyyy-MM-dd');
                  const shiftData = row.data[dateStr];
                  
                  return (
                    <td
                      key={`${row.shiftLabel}-${dateStr}`}
                      className={`px-2 py-2 text-xs text-center ${
                        isWeekend(date) ? 'bg-gray-50' : ''
                      }`}
                    >
                      {shiftData ? (
                        <div
                          className={`px-1 py-0.5 rounded text-xs ${getCellColor(row.shiftType)}`}
                          title={shiftData.userName}
                        >
                          <div className="truncate" style={{ maxWidth: '100px' }}>
                            {(() => {
                              const [lastName, firstName] = shiftData.userName.split(' ');
                              const baseName = `${lastName.toUpperCase()} ${firstName ? firstName.charAt(0).toUpperCase() + '.' : ''}`;
                              
                              // Vérifier s'il y a plusieurs médecins ce jour-là
                              const instanceCount = row.instanceCounts?.[dateStr] || 0;
                              if (instanceCount > 1) {
                                // Trouver l'index de cette instance
                                const dateShifts = groupedData[dateStr]?.[row.shiftType] || [];
                                const instanceIndex = dateShifts.findIndex(s => s.userId === shiftData.userId);
                                return baseName; // Pour l'instant on affiche juste le nom
                              }
                              return baseName;
                            })()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {showExportModal && (
        <ExportLogModal
          associationId={associationId}
          onClose={() => setShowExportModal(false)}
        />
      )}
      
      {showExportAstreinteModal && (
        <ExportAstreinteModal
          associationId={associationId}
          onClose={() => setShowExportAstreinteModal(false)}
        />
      )}
      
      {showDatePicker && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50">
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    Modifier la période d'affichage
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                        Date de début
                      </label>
                      <input
                        type="date"
                        id="start-date"
                        value={formatParisDate(tempStartDate, 'yyyy-MM-dd')}
                        onChange={(e) => setTempStartDate(parseParisDate(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                        Date de fin
                      </label>
                      <input
                        type="date"
                        id="end-date"
                        value={formatParisDate(tempEndDate, 'yyyy-MM-dd')}
                        onChange={(e) => setTempEndDate(parseParisDate(e.target.value))}
                        min={formatParisDate(tempStartDate, 'yyyy-MM-dd')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    onClick={() => {
                      if (onDateChange) {
                        onDateChange(tempStartDate, tempEndDate);
                      }
                      setShowDatePicker(false);
                    }}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                  >
                    Appliquer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempStartDate(startDate);
                      setTempEndDate(endDate);
                      setShowDatePicker(false);
                    }}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalPlanningView;