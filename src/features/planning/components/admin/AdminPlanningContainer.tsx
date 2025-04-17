import React, { useState } from 'react';
import { PlanningContainer } from '../shared';
import { PlanningToolbar, UserSelector, ImportDropZone } from './';
import { useImportExport } from '../../hooks';
import type { User } from '../../../../types/users';
import type { ShiftAssignment, GeneratedPlanning } from '../../../../types/planning';
import type { ShiftExchange } from '../../../../types/exchange';

interface AdminPlanningContainerProps {
  users: User[];
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  onPreviousUser: () => void;
  onNextUser: () => void;
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
  showDesiderata: boolean;
  onToggleDesiderata: () => void;
  bagPhaseConfig: { phase: 'submission' | 'distribution' | 'completed' };
  isFirstDayOfBagPeriod?: (date: Date) => boolean;
  onCellClick: (event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => void;
  uploadPeriodId: string;
  plannings?: Record<string, Record<string, GeneratedPlanning>>;
  saveGeneratedPlanning?: (userId: string, planning: GeneratedPlanning, periodId: string) => Promise<void>;
  loadExporters?: () => Promise<{
    toPdf: (assignments: Record<string, ShiftAssignment>, userName: string, startDate: Date, endDate: Date) => Promise<void>;
    toCsv: (assignments: Record<string, ShiftAssignment>, userName: string) => Promise<void>;
    allToPdf: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date, endDate: Date) => Promise<void>;
    allToCsv: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date) => Promise<void>;
  }>;
  startDate?: Date;
  endDate?: Date;
  showImportZone?: boolean;
  children?: React.ReactNode;
}

/**
 * Conteneur pour la page d'administration du planning
 */
const AdminPlanningContainer: React.FC<AdminPlanningContainerProps> = ({
  users,
  selectedUserId,
  onUserChange,
  onPreviousUser,
  onNextUser,
  assignments,
  exchanges,
  directExchanges,
  replacements,
  desiderata = {},
  receivedShifts = {},
  showDesiderata,
  onToggleDesiderata,
  bagPhaseConfig,
  isFirstDayOfBagPeriod,
  onCellClick,
  uploadPeriodId,
  plannings,
  saveGeneratedPlanning,
  loadExporters,
  startDate,
  endDate,
  showImportZone = false,
  children
}) => {
  // État pour les notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Forcer le re-rendu lorsque showDesiderata change
  React.useEffect(() => {
    console.log("AdminPlanningContainer: showDesiderata a changé:", showDesiderata);
    // Cet effet ne fait rien, mais force le composant à se re-rendre
    // lorsque showDesiderata change
  }, [showDesiderata]);
  
  // Utiliser le hook d'import/export
  const {
    isProcessing,
    error,
    handleFileUpload,
    handleExportPDF,
    handleExportCSV,
    handleExportAllPDF,
    handleExportAllCSV
  } = useImportExport({
    uploadPeriodId,
    users,
    onSuccess: (message) => {
      setNotification({ message, type: 'success' });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (message) => {
      setNotification({ message, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    },
    saveGeneratedPlanning,
    loadExporters,
    plannings,
    startDate,
    endDate
  });

  return (
    <div className="flex flex-col h-full">
      {/* Sélecteur d'utilisateur */}
      <UserSelector
        users={users}
        selectedUserId={selectedUserId}
        onUserChange={onUserChange}
        onPrevious={onPreviousUser}
        onNext={onNextUser}
        showSearch={true}
      />
      
      {/* Barre d'outils */}
      <PlanningToolbar
        onExportPDF={() => handleExportPDF(selectedUserId)}
        onExportCSV={() => handleExportCSV(selectedUserId)}
        onExportAllPDF={handleExportAllPDF}
        onExportAllCSV={handleExportAllCSV}
        onToggleDesiderata={onToggleDesiderata}
        showDesiderata={showDesiderata}
        isLoading={isProcessing}
      />
      
      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-3 rounded-md ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}
      
      {/* Zone d'import */}
      {showImportZone && (
        <div className="mb-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Importer des plannings</h2>
          <ImportDropZone
            onFilesAccepted={handleFileUpload}
            isProcessing={isProcessing}
            uploadPeriodId={uploadPeriodId}
          />
          {error && (
            <div className="mt-2 text-sm text-red-600">
              {error}
            </div>
          )}
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
        userId={selectedUserId}
        isAdminView={true}
        showDesiderata={showDesiderata}
        bagPhaseConfig={bagPhaseConfig}
        isFirstDayOfBagPeriod={isFirstDayOfBagPeriod}
        onCellClick={onCellClick}
        showPeriodSelector={true}
      />
    </div>
  );
};

export default AdminPlanningContainer;
