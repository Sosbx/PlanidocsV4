import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { exportUserPlanningHistoryOptimized } from '../../../../lib/firebase/planning/exportOptimized';
import { useAssociation } from '../../../../context/association/AssociationContext';
import type { User } from '../../../../types/users';

interface HistoryExportProps {
  users: User[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Composant optimisé pour l'export d'historique de planning
 */
const HistoryExport: React.FC<HistoryExportProps> = ({ 
  users, 
  onSuccess, 
  onError 
}) => {
  const { currentAssociation } = useAssociation();
  const [exportStartDate, setExportStartDate] = useState<Date>(
    new Date(createParisDate().setMonth(createParisDate().getMonth() - 3))
  );
  const [exportEndDate, setExportEndDate] = useState<Date>(createParisDate());
  const [exportUserId, setExportUserId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Filtrer les utilisateurs avec le rôle isUser (memoizé)
  const eligibleUsers = useMemo(() => 
    users.filter(user => user.roles?.isUser),
    [users]
  );

  // Sélectionner le premier utilisateur par défaut
  useEffect(() => {
    if (eligibleUsers.length > 0 && !exportUserId) {
      setExportUserId(eligibleUsers[0].id);
    }
  }, [eligibleUsers, exportUserId]);

  /**
   * Fonction optimisée pour exporter l'historique
   */
  const handleExportUserHistory = useCallback(async () => {
    if (!exportUserId) {
      onError('Veuillez sélectionner un utilisateur');
      return;
    }
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      onSuccess('Préparation de l\'export CSV...');
      
      // Exporter l'historique avec suivi de progression
      const csvContent = await exportUserPlanningHistoryOptimized(
        exportUserId,
        exportStartDate,
        exportEndDate,
        currentAssociation,
        (percent) => setExportProgress(percent)
      );
      
      // Créer un blob et un lien de téléchargement
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Trouver l'utilisateur pour le nom du fichier
      const user = users.find(u => u.id === exportUserId);
      const fileName = user 
        ? `historique_${user.lastName}_${user.firstName}_${formatParisDate(exportStartDate, 'yyyy-MM-dd')}_${formatParisDate(exportEndDate, 'yyyy-MM-dd')}.csv`
        : `historique_${formatParisDate(exportStartDate, 'yyyy-MM-dd')}_${formatParisDate(exportEndDate, 'yyyy-MM-dd')}.csv`;
      
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Libérer l'URL
      URL.revokeObjectURL(url);
      
      onSuccess('Export CSV réussi');
    } catch (error) {
      console.error('Error exporting user history:', error);
      onError('Erreur lors de l\'export CSV');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [exportUserId, exportStartDate, exportEndDate, currentAssociation, users, onSuccess, onError]);

  // Callbacks memoizés pour les changements de date
  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExportStartDate(new Date(e.target.value));
  }, []);

  const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExportEndDate(new Date(e.target.value));
  }, []);

  const handleUserChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setExportUserId(e.target.value);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Export d'historique de planning</h2>
        <p className="text-sm text-gray-500 mb-4">
          Exportez l'historique de planning d'un utilisateur sur une période donnée. L'export inclut toutes les gardes, y compris les gardes archivées.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Utilisateur
            </label>
            <select
              value={exportUserId}
              onChange={handleUserChange}
              className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              disabled={isExporting}
            >
              <option value="">Sélectionner un utilisateur</option>
              {eligibleUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.lastName} {user.firstName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de début
            </label>
            <input
              type="date"
              value={formatParisDate(exportStartDate, 'yyyy-MM-dd')}
              onChange={handleStartDateChange}
              className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              disabled={isExporting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de fin
            </label>
            <input
              type="date"
              value={formatParisDate(exportEndDate, 'yyyy-MM-dd')}
              onChange={handleEndDateChange}
              className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              disabled={isExporting}
            />
          </div>
        </div>
        
        {/* Barre de progression */}
        {isExporting && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Export en cours...</span>
              <span>{exportProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            onClick={handleExportUserHistory}
            disabled={!exportUserId || isExporting}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
              exportUserId && !isExporting 
                ? 'bg-indigo-600 hover:bg-indigo-700' 
                : 'bg-gray-400 cursor-not-allowed'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Export en cours...
              </>
            ) : (
              <>
                <span className="h-4 w-4 mr-2">↓</span>
                Exporter en CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryExport;