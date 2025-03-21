import React, { useState } from 'react';
import { Download, Eye, FileText, FolderDown, Bell } from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import { User } from '../../types/users';
import { sendReminderEmail } from '../../lib/firebase/email/sendReminder';
import { exportPlanningToCSV, exportAllPlanningsToZip } from '../../utils/csvExport';
import { exportAllPlanningsToPDFZip } from '../../utils/pdfExport';
import { getDesiderata } from '../../lib/firebase/desiderata';
import { usePlanningConfig } from '../../context/PlanningContext';
import Toast from '../Toast';

interface GroupedUsers {
  validated: User[];
  notValidated: User[];
}

interface UserStatusListProps {
  users: User[];
  onDownloadPlanning: (userId: string, format: 'pdf') => void;
  onPreviewPlanning: (userId: string) => void;
}

const UserStatusList: React.FC<UserStatusListProps> = ({
  users,
  onDownloadPlanning,
  onPreviewPlanning,
}) => {
  const { config } = usePlanningConfig();
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  const handleSendReminder = async (user: User) => {
    if (!window.confirm(`Voulez-vous vraiment envoyer un rappel à ${user.firstName} ${user.lastName} ?`)) {
      return;
    }

    try {
      await sendReminderEmail(user.id, config.deadline);
      const message = `Rappel envoyé à ${user.firstName} ${user.lastName}`;
      console.log(message);
      setToast({
        visible: true,
        message: message,
        type: 'success'
      });
    } catch (error) {
      const errorMessage = 'Erreur lors de l\'envoi du rappel';
      console.error(errorMessage, error);
      setToast({
        visible: true,
        message: errorMessage,
        type: 'error'
      });
    }
  };

  const handleSendBulkReminders = async () => {
    if (!groupedUsers.notValidated.length) return;
    
    if (!window.confirm(`Voulez-vous vraiment envoyer un rappel à tous les utilisateurs en attente (${groupedUsers.notValidated.length} utilisateurs) ?`)) {
      return;
    }
    
    // Notification de début d'envoi
    setToast({
      visible: true,
      message: `Envoi de ${groupedUsers.notValidated.length} rappels en cours...`,
      type: 'success'
    });
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    for (const user of groupedUsers.notValidated) {
      try {
        await sendReminderEmail(user.id, config.deadline);
        successCount++;
      } catch (error) {
        const errorMessage = `Erreur pour ${user.firstName} ${user.lastName}`;
        console.error(errorMessage, error);
        errors.push(errorMessage);
        errorCount++;
      }
    }
    
    // Message de confirmation final
    if (successCount > 0) {
      const message = `${successCount} rappel${successCount > 1 ? 's' : ''} envoyé${successCount > 1 ? 's' : ''} avec succès${
        errorCount > 0 ? ` (${errorCount} échec${errorCount > 1 ? 's' : ''})` : ''
      }`;
      console.log(message);
      if (errors.length > 0) {
        console.error('Détails des erreurs:', errors.join(', '));
      }
      setToast({
        visible: true,
        message: message,
        type: errorCount === 0 ? 'success' : 'error'
      });
    } else {
      const errorMessage = 'Échec de l\'envoi des rappels. Veuillez réessayer.';
      console.error(errorMessage);
      setToast({
        visible: true,
        message: errorMessage,
        type: 'error'
      });
    }
  };
  
  // Grouper et trier les utilisateurs
  const groupedUsers = users.reduce<GroupedUsers>(
    (acc, user) => {
      if (user.hasValidatedPlanning) {
        acc.validated.push(user);
      } else {
        acc.notValidated.push(user);
      }
      return acc;
    },
    { validated: [], notValidated: [] }
  );

  // Trier les deux groupes par ordre alphabétique
  const sortByName = (a: User, b: User) => 
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
  
  groupedUsers.validated.sort(sortByName);
  groupedUsers.notValidated.sort(sortByName);

  const handleCSVDownload = async (user: User) => {
    try {
      const desiderata = await getDesiderata(user.id);
      if (!desiderata?.selections) return;

      await exportPlanningToCSV({
        userName: user.lastName,
        startDate: config.startDate,
        endDate: config.endDate,
        selections: desiderata.selections
      });
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const handleDownloadAllCSV = async () => {
    try {
      const desiderataPromises = groupedUsers.validated.map(user => 
        getDesiderata(user.id).then(data => ({ [user.id]: data }))
      );
      
      const desiderataResults = await Promise.all(desiderataPromises);
      const desiderataData = desiderataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      await exportAllPlanningsToZip(
        groupedUsers.validated,
        desiderataData,
        config.startDate,
        config.endDate
      );
    } catch (error) {
      console.error('Error downloading all CSV:', error);
    }
  };

  const handleDownloadAllPDF = async () => {
    try {
      const desiderataPromises = groupedUsers.validated.map(user => 
        getDesiderata(user.id).then(data => ({ [user.id]: data }))
      );
      
      const desiderataResults = await Promise.all(desiderataPromises);
      const desiderataData = desiderataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      await exportAllPlanningsToPDFZip(
        groupedUsers.validated,
        desiderataData,
        config.startDate,
        config.endDate
      );
    } catch (error) {
      console.error('Error downloading all PDFs:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md mt-8">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">État des réponses</h3>
        <div className="flex gap-2">
          {groupedUsers.validated.length > 0 && (
            <>
              <button
                onClick={handleDownloadAllPDF}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                title="Télécharger tous les PDF"
              >
                <FolderDown className="h-4 w-4 mr-2" />
                Télécharger tous les PDF
              </button>
          <button
            onClick={handleDownloadAllCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title="Télécharger tous les CSV"
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger tous les CSV
          </button>
            </>
          )}
        </div>
      </div>
      
      {/* Utilisateurs ayant validé */}
      {groupedUsers.validated.length > 0 && (
        <div className="bg-green-50 px-4 py-2 border-b">
          <h4 className="text-sm font-medium text-green-800">
            Validés ({groupedUsers.validated.length})
          </h4>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {groupedUsers.validated.map((user) => (
          <div key={user.id} className="px-4 sm:px-6 py-4 bg-green-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <StatusIndicator validated={true} />
                <span className="text-sm font-medium text-gray-900">
                  {user.lastName} {user.firstName}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => onPreviewPlanning(user.id)}
                  className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Aperçu du planning"
                >
                  <Eye className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDownloadPlanning(user.id, 'pdf')}
                  className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Télécharger en PDF"
                >
                  <FileText className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleCSVDownload(user)}
                  className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Télécharger en CSV"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Utilisateurs n'ayant pas validé */}
      {groupedUsers.notValidated.length > 0 && (
        <div className="bg-yellow-50 px-4 py-2 border-b">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-yellow-800">
              En attente ({groupedUsers.notValidated.length})
            </h4>
            <button
              onClick={handleSendBulkReminders}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-yellow-800 hover:text-yellow-900 hover:bg-yellow-100 rounded-full transition-colors"
              title="Envoyer un rappel à tous les utilisateurs en attente"
            >
              <Bell className="h-4 w-4 mr-2 animate-pulse" />
              Rappeler tous
            </button>
          </div>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {groupedUsers.notValidated.map((user) => (
          <div key={user.id} className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <StatusIndicator validated={false} />
                <span className="text-sm font-medium text-gray-900">
                  {user.lastName} {user.firstName}
                </span>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => handleSendReminder(user)}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors"
                  title="Envoyer un rappel par email"
                >
                  <Bell className="h-5 w-5 text-red-800 animate-pulse" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserStatusList;