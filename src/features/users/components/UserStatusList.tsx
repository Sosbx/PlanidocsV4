import React, { useState } from 'react';
import { Download, Eye, FileText, FolderDown, Bell } from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import { UserExtended } from '../types';
import { UserStatus, UserRole } from '../../auth/types';
import type { User } from '../types';
import { loadCsvPlanningExporter, loadCsvAllExporter, loadPdfAllExporter } from '../../../utils/lazyExporters';
import { getDesiderata } from '../../../lib/firebase/desiderata';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { useAssociation } from '../../../context/association/AssociationContext';
import Toast from '../../../components/Toast';
import { sendReminderEmail, sendBulkReminderEmails } from '../../../lib/firebase/email/sendReminder';

// Fonction d'adaptateur pour convertir UserExtended en User
const adaptUserExtendedToUser = (userExtended: UserExtended, associationId: string): User => {
  // Déterminer les rôles supplémentaires à partir des métadonnées ou d'autres attributs
  // Par défaut, on considère que tous les utilisateurs sont des utilisateurs normaux
  const isCAT = userExtended.metadata?.isCAT === true || false;
  const isPartTime = userExtended.metadata?.isPartTime === true || false;
  const isReplacement = userExtended.metadata?.isReplacement === true || false;
  
  // Déterminer le rôle principal
  const isAdmin = userExtended.role === UserRole.ADMIN;
  const isManager = userExtended.role === UserRole.MANAGER;
  const isUser = userExtended.role === UserRole.USER || !isAdmin && !isManager; // Par défaut, c'est un utilisateur normal
  
  return {
    id: userExtended.id,
    email: userExtended.email || '',
    firstName: userExtended.firstName || '',
    lastName: userExtended.lastName || '',
    login: '',
    password: '',
    roles: {
      isAdmin,
      isManager,
      isUser,
      isPartTime,
      isCAT,
      isReplacement,
      isSuperAdmin: false
    },
    hasValidatedPlanning: userExtended.status === UserStatus.ACTIVE,
    associationId: associationId || 'RD' // Utiliser l'association fournie ou 'RD' par défaut
  };
};

interface GroupedUsers {
  validated: UserExtended[];
  notValidated: UserExtended[];
}

interface UserStatusListProps {
  users: UserExtended[];
  onDownloadPlanning: (userId: string, format: 'pdf') => void;
  onPreviewPlanning: (userId: string) => void;
}

const UserStatusList: React.FC<UserStatusListProps> = ({
  users,
  onDownloadPlanning,
  onPreviewPlanning,
}) => {
  const { config } = usePlanningConfig();
  const { currentAssociation } = useAssociation();
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  const handleSendReminder = async (user: UserExtended) => {
    if (!window.confirm(`Voulez-vous vraiment envoyer un rappel à ${user.firstName} ${user.lastName} ?`)) {
      return;
    }

    // Vérifier que l'utilisateur a une adresse email valide
    if (!user.email) {
      const errorMessage = `Impossible d'envoyer un rappel à ${user.firstName} ${user.lastName} : adresse email manquante`;
      console.error(errorMessage);
      setToast({
        visible: true,
        message: errorMessage,
        type: 'error'
      });
      return;
    }

    // Vérifier que l'adresse email est bien formatée
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      const errorMessage = `Impossible d'envoyer un rappel à ${user.firstName} ${user.lastName} : adresse email invalide (${user.email})`;
      console.error(errorMessage);
      setToast({
        visible: true,
        message: errorMessage,
        type: 'error'
      });
      return;
    }

    console.log(`Tentative d'envoi de rappel à ${user.firstName} ${user.lastName} (${user.email}) avec ID: ${user.id}`);

    try {
      // Utiliser l'association actuelle
      const associationId = currentAssociation;
      console.log(`Envoi du rappel avec l'association: ${associationId}`);
      
      await sendReminderEmail(user.id, config.deadline, associationId);
      const message = `Rappel et notification envoyés à ${user.firstName} ${user.lastName}`;
      console.log(message);
      setToast({
        visible: true,
        message: message,
        type: 'success'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'envoi du rappel';
      console.error('Erreur détaillée lors de l\'envoi du rappel:', {
        error,
        userId: user.id,
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        deadline: config.deadline
      });
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
    
    try {
      // Collecter tous les IDs utilisateurs non validés
      const userIds = groupedUsers.notValidated.map(user => user.id);
      
      // Appeler la fonction d'envoi en masse
      const result = await sendBulkReminderEmails(userIds, config.deadline, currentAssociation);
      
      // Afficher un message de succès avec le détail des envois
      const successCount = result.details?.success || 0;
      const successMessage = `${successCount} rappels envoyés avec succès`;
      const errorCount = result.details?.errors?.length || 0;
      const fullMessage = errorCount > 0 
        ? `${successMessage}, ${errorCount} échecs` 
        : successMessage;
      
      console.log(fullMessage);
      if (result.details?.errors && result.details.errors.length > 0) {
        console.error('Détails des erreurs:', result.details.errors);
      }
      
      setToast({
        visible: true,
        message: fullMessage,
        type: errorCount === 0 ? 'success' : 'error'
      });
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erreur lors de l\'envoi des rappels';
      
      console.error('Erreur lors de l\'envoi groupé:', error);
      setToast({
        visible: true,
        message: errorMessage,
        type: 'error'
      });
    }
  };
  
  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user => {
    // Exclure spécifiquement les comptes de secrétariat
    if (user.email && user.email.toLowerCase().includes('@h24scm.com')) {
      // Exclure les comptes administratifs spécifiques
      if (user.email.toLowerCase().includes('secretariatrd') || 
          user.email.toLowerCase().includes('secretariat') || 
          user.email.toLowerCase().includes('rivegauche')) {
        return false;
      }
    }
    
    // Exclure également les utilisateurs dont le nom ou prénom contient 'secretariat'
    if ((user.firstName && user.firstName.toLowerCase().includes('secretariat')) ||
        (user.lastName && user.lastName.toLowerCase().includes('secretariat'))) {
      return false;
    }

    // Inclure tous les autres utilisateurs, quelle que soit leur rôle
    return true;
  });
  
  // Grouper et trier les utilisateurs filtrés
  const groupedUsers = filteredUsers.reduce<GroupedUsers>(
    (acc, user) => {
      if (user.status === UserStatus.ACTIVE) {
        acc.validated.push(user);
      } else {
        acc.notValidated.push(user);
      }
      return acc;
    },
    { validated: [], notValidated: [] }
  );

  // Trier les deux groupes par ordre alphabétique
  const sortByName = (a: UserExtended, b: UserExtended) => 
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
  
  groupedUsers.validated.sort(sortByName);
  groupedUsers.notValidated.sort(sortByName);

  const handleCSVDownload = async (user: UserExtended) => {
    try {
      setToast({
        visible: true,
        message: 'Préparation du fichier CSV...',
        type: 'success'
      });
      
      console.log(`UserStatusList: Chargement des désidérata pour l'utilisateur ${user.id} de l'association ${currentAssociation}`);
      const desiderata = await getDesiderata(user.id, currentAssociation);
      if (!desiderata?.selections) {
        setToast({
          visible: true,
          message: 'Aucune donnée disponible pour ce planning',
          type: 'error'
        });
        return;
      }

      const exportPlanningToCSV = await loadCsvPlanningExporter();
      await exportPlanningToCSV({
        userName: user.lastName || 'Utilisateur',
        startDate: config.startDate,
        endDate: config.endDate,
        selections: desiderata.selections,
        isDesiderata: true // Activer l'affichage des commentaires
      });
      
      setToast({
        visible: true,
        message: 'Fichier CSV généré avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading CSV:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la génération du fichier CSV',
        type: 'error'
      });
    }
  };

  const handleDownloadAllCSV = async () => {
    try {
      setToast({
        visible: true,
        message: 'Préparation des fichiers CSV...',
        type: 'success'
      });
      
      const desiderataPromises = groupedUsers.validated.map(user => {
        console.log(`UserStatusList (CSV All): Chargement des désidérata pour l'utilisateur ${user.id} de l'association ${currentAssociation}`);
        return getDesiderata(user.id, currentAssociation).then(data => ({ [user.id]: data }));
      });
      
      const desiderataResults = await Promise.all(desiderataPromises);
      const desiderataData = desiderataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      // Filtrer les données null et undefined mais conserver la structure complète (avec commentaires)
      const filteredDesiderataData: Record<string, { selections: Record<string, any> }> = {};
      Object.entries(desiderataData).forEach(([userId, data]) => {
        if (data && data.selections) {
          // Conserver les données telles quelles sans transformation pour préserver les commentaires
          filteredDesiderataData[userId] = { selections: data.selections };
        }
      });

      // Convertir les UserExtended en User
      const adaptedUsers = groupedUsers.validated.map(user => adaptUserExtendedToUser(user, currentAssociation));

      const exportAllPlanningsToZip = await loadCsvAllExporter();
      await exportAllPlanningsToZip(
        adaptedUsers,
        filteredDesiderataData,
        config.startDate,
        config.endDate
      );
      
      setToast({
        visible: true,
        message: 'Archive ZIP des fichiers CSV générée avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading all CSV:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la génération de l\'archive ZIP',
        type: 'error'
      });
    }
  };

  const handleDownloadAllPDF = async () => {
    try {
      setToast({
        visible: true,
        message: 'Préparation des fichiers PDF...',
        type: 'success'
      });
      
      const desiderataPromises = groupedUsers.validated.map(user => {
        console.log(`UserStatusList (PDF All): Chargement des désidérata pour l'utilisateur ${user.id} de l'association ${currentAssociation}`);
        return getDesiderata(user.id, currentAssociation).then(data => ({ [user.id]: data }));
      });
      
      const desiderataResults = await Promise.all(desiderataPromises);
      const desiderataData = desiderataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      // Filtrer les données null et undefined mais conserver la structure complète (avec commentaires)
      const filteredDesiderataData: Record<string, { selections: Record<string, any>; validatedAt?: string }> = {};
      Object.entries(desiderataData).forEach(([userId, data]) => {
        if (data && data.selections) {
          // Conserver les données telles quelles sans transformation pour préserver les commentaires
          filteredDesiderataData[userId] = { 
            selections: data.selections,
            validatedAt: data.validatedAt
          };
          
          // Débogage des données
          console.log(`PDF en masse: ${userId} a ${Object.keys(data.selections).length} sélections`);
          if (Object.keys(data.selections).length > 0) {
            const firstKey = Object.keys(data.selections)[0];
            console.log(`Exemple de donnée: ${firstKey}:`, data.selections[firstKey]);
          }
        }
      });

      // Convertir les UserExtended en User
      const adaptedUsers = groupedUsers.validated.map(user => adaptUserExtendedToUser(user, currentAssociation));

      const exportAllPlanningsToPDFZip = await loadPdfAllExporter();
      await exportAllPlanningsToPDFZip(
        adaptedUsers,
        filteredDesiderataData,
        config.startDate,
        config.endDate
      );
      
      setToast({
        visible: true,
        message: 'Archive ZIP des fichiers PDF générée avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading all PDFs:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la génération de l\'archive ZIP',
        type: 'error'
      });
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      {toast.visible && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          isVisible={toast.visible}
          onClose={() => setToast(prev => ({ ...prev, visible: false }))} 
        />
      )}
      
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Statut des utilisateurs
        </h3>
        <div className="flex space-x-2">
          {groupedUsers.validated.length > 0 && (
            <>
          <button
            onClick={handleDownloadAllPDF}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title="Télécharger tous les PDF"
          >
            <FolderDown className="h-4 w-4 mr-2" />
            Télécharger tous les PDF
          </button>
          <button
            onClick={handleDownloadAllCSV}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            title="Télécharger tous les CSV"
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger tous les CSV
          </button>
            </>
          )}
        </div>
      </div>
      
      {/* Affichage en deux colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Colonne de gauche : Utilisateurs ayant validé */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="bg-green-50 px-4 py-2 border-b">
            <h4 className="text-sm font-medium text-green-800">
              Validés ({groupedUsers.validated.length})
            </h4>
          </div>
          <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
            {groupedUsers.validated.length > 0 ? (
              groupedUsers.validated.map((user) => (
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
              ))
            ) : (
              <div className="px-4 py-6 text-center text-gray-500">
                Aucun utilisateur validé
              </div>
            )}
          </div>
        </div>

        {/* Colonne de droite : Utilisateurs n'ayant pas validé */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="bg-yellow-50 px-4 py-2 border-b">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-yellow-800">
                En attente ({groupedUsers.notValidated.length})
              </h4>
              {groupedUsers.notValidated.length > 0 && (
                <button
                  onClick={handleSendBulkReminders}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-yellow-800 hover:text-yellow-900 hover:bg-yellow-100 rounded-full transition-colors"
                  title="Envoyer un rappel à tous les utilisateurs en attente"
                >
                  <Bell className="h-4 w-4 mr-2 animate-pulse" />
                  Rappeler tous
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
            {groupedUsers.notValidated.length > 0 ? (
              groupedUsers.notValidated.map((user) => (
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
              ))
            ) : (
              <div className="px-4 py-6 text-center text-gray-500">
                Aucun utilisateur en attente
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserStatusList;
