import React, { useState } from 'react';
import { PlanningContainer } from './';
import { useImportExport } from '../../hooks';
import type { User } from '../../../../types/users';
import type { ShiftAssignment, GeneratedPlanning } from '../../../../types/planning';
import type { ShiftExchange } from '../../../../types/exchange';

interface UserPlanningContainerProps {
  assignments: Record<string, ShiftAssignment>;
  exchanges: Record<string, ShiftExchange>;
  directExchanges: Record<string, ShiftExchange>;
  replacements: Record<string, any>;
  desiderata?: Record<string, { type: 'primary' | 'secondary' | null }>;
  receivedShifts?: Record<string, {
    originalUserId: string;
    newUserId: string;
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>;
  userId: string;
  showDesiderata: boolean;
  onToggleDesiderata: () => void;
  bagPhaseConfig: { phase: 'submission' | 'distribution' | 'completed' };
  isFirstDayOfBagPeriod?: (date: Date) => boolean;
  onCellClick: (event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => void;
  periodId: string;
  users: User[];
  loadExporters?: () => Promise<{
    toPdf: (assignments: Record<string, ShiftAssignment>, userName: string, startDate: Date, endDate: Date) => Promise<void>;
    toCsv: (assignments: Record<string, ShiftAssignment>, userName: string) => Promise<void>;
    allToPdf: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date, endDate: Date) => Promise<void>;
    allToCsv: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date) => Promise<void>;
  }>;
  plannings?: Record<string, Record<string, GeneratedPlanning>>;
  startDate?: Date;
  endDate?: Date;
  children?: React.ReactNode;
}

/**
 * Conteneur pour la page de planning utilisateur
 */
const UserPlanningContainer: React.FC<UserPlanningContainerProps> = ({
  assignments,
  exchanges,
  directExchanges,
  replacements,
  desiderata = {},
  receivedShifts = {},
  userId,
  showDesiderata,
  onToggleDesiderata,
  bagPhaseConfig,
  isFirstDayOfBagPeriod,
  onCellClick,
  periodId,
  users,
  loadExporters,
  plannings,
  startDate,
  endDate,
  children
}) => {
  // État pour les notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Utiliser le hook d'import/export
  const {
    isProcessing,
    handleExportPDF,
    handleExportCSV
  } = useImportExport({
    uploadPeriodId: periodId,
    users,
    onSuccess: (message) => {
      setNotification({ message, type: 'success' });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (message) => {
      setNotification({ message, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    },
    loadExporters,
    plannings,
    startDate,
    endDate
  });

  return (
    <div className="flex flex-col h-full">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleDesiderata()}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title={showDesiderata ? "Masquer les desiderata" : "Afficher les desiderata"}
          >
            {showDesiderata ? "Masquer desiderata" : "Afficher desiderata"}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportPDF(userId)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isProcessing}
          >
            Exporter PDF
          </button>
          <button
            onClick={() => handleExportCSV(userId)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isProcessing}
          >
            Exporter CSV
          </button>
        </div>
      </div>
      
      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-3 rounded-md ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}
      
      {/* Contenu personnalisé */}
      {children}
      
      {/* Conteneur de planning */}
      <PlanningContainer
        assignments={assignments}
        exchanges={exchanges}
        directExchanges={directExchanges}
        replacements={replacements}
        desiderata={desiderata}
        receivedShifts={receivedShifts}
        userId={userId}
        isAdminView={false}
        showDesiderata={showDesiderata}
        bagPhaseConfig={bagPhaseConfig}
        isFirstDayOfBagPeriod={isFirstDayOfBagPeriod}
        onCellClick={onCellClick}
        showPeriodSelector={false}
      />
    </div>
  );
};

export default UserPlanningContainer;
