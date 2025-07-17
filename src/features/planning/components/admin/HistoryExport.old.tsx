import React, { useState, useEffect } from 'react';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { exportUserPlanningHistoryToCsv } from '../../../../lib/firebase/planning';
import type { User } from '../../../../types/users';

interface HistoryExportProps {
  users: User[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Composant pour l'export d'historique de planning
 */
const HistoryExport: React.FC<HistoryExportProps> = ({ users, onSuccess, onError }) => {
  const [exportStartDate, setExportStartDate] = useState<Date>(
    new Date(createParisDate().setMonth(createParisDate().getMonth() - 3))
  );
  const [exportEndDate, setExportEndDate] = useState<Date>(createParisDate());
  const [exportUserId, setExportUserId] = useState<string>('');

  // Sélectionner le premier utilisateur par défaut
  useEffect(() => {
    if (users.length > 0 && !exportUserId) {
      const userWithRole = users.find(user => user.roles?.isUser);
      if (userWithRole) {
        setExportUserId(userWithRole.id);
      } else if (users[0]) {
        setExportUserId(users[0].id);
      }
    }
  }, [users, exportUserId]);

  /**
   * Fonction pour exporter l'historique de planning d'un utilisateur
   */
  const handleExportUserHistory = async () => {
    if (!exportUserId) {
      onError('Veuillez sélectionner un utilisateur');
      return;
    }
    
    try {
      onSuccess('Préparation de l\'export CSV...');
      
      // Exporter l'historique
      const csvContent = await exportUserPlanningHistoryToCsv(
        exportUserId,
        exportStartDate,
        exportEndDate
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
      
      onSuccess('Export CSV réussi');
    } catch (error) {
      console.error('Error exporting user history:', error);
      onError('Erreur lors de l\'export CSV');
    }
  };

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
              onChange={(e) => setExportUserId(e.target.value)}
              className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            >
              <option value="">Sélectionner un utilisateur</option>
              {users.filter(user => user.roles?.isUser).map((user) => (
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
              onChange={(e) => setExportStartDate(new Date(e.target.value))}
              className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de fin
            </label>
            <input
              type="date"
              value={formatParisDate(exportEndDate, 'yyyy-MM-dd')}
              onChange={(e) => setExportEndDate(new Date(e.target.value))}
              className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handleExportUserHistory}
            disabled={!exportUserId}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
              exportUserId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
          >
            <span className="h-4 w-4 mr-2">↓</span>
            Exporter en CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryExport;