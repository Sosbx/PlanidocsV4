import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  AlertCircle, 
  Key, 
  Bell, 
  Stethoscope, 
  PanelLeft, 
  PanelRight, 
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useAuth } from '../features/auth/hooks';
import { resetPassword } from '../features/auth/utils/session';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { NotificationType } from '../lib/firebase/notifications';

// Type pour les paramètres de notification
interface NotificationSettings {
  inApp: boolean;
  email: boolean;
  types: {
    [key in NotificationType]?: boolean;
  };
}

// Type pour les paramètres de remplacement
interface ReplacementSettings {
  equipment: {
    oxygenBottle: boolean;
    ecg: boolean;
    tpeSunmi: boolean;
    tpePersonal: boolean;
    vitalCardReaderStellar: boolean;
    vitalCardReaderNonStellar: boolean;
  };
  equipmentLocation: string;
  retrocessionPercentage: number;
  additionalComments: string;
}

const ProfilePage: React.FC = () => {
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  // Définition de l'onglet actif (l'onglet 'appearance' a été supprimé)
  const [activeTab, setActiveTab] = useState('profile');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Redirection si l'onglet actif est 'appearance' (qui a été supprimé)
  useEffect(() => {
    if (activeTab === 'appearance') {
      setActiveTab('profile');
    }
  }, [activeTab]);

  // États pour les paramètres de notification
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    inApp: true,
    email: true,
    types: {
      exchange_proposed: true,
      exchange_accepted: true,
      exchange_rejected: true,
      exchange_updated: true,
      exchange_cancelled: true,
      give_proposed: true,
      give_accepted: true,
      give_rejected: true,
      give_updated: true,
      give_cancelled: true,
      replacement_proposed: true,
      replacement_accepted: true,
      replacement_rejected: true,
      replacement_updated: true,
      replacement_cancelled: true,
      proposal_updated: true,
      proposal_accepted: true,
      proposal_rejected: true,
      proposal_cancelled: true,
      interested_user: true,
      system: true,
      info: true,
      warning: true,
      error: true
    }
  });
  
  // États pour les paramètres de remplacement
  const [replacementSettings, setReplacementSettings] = useState<ReplacementSettings>({
    equipment: {
      oxygenBottle: false,
      ecg: false,
      tpeSunmi: false,
      tpePersonal: false,
      vitalCardReaderStellar: false,
      vitalCardReaderNonStellar: false
    },
    equipmentLocation: '',
    retrocessionPercentage: 80,
    additionalComments: ''
  });
  
  // Chargement des paramètres depuis le stockage ou la base de données
  useEffect(() => {
    if (user) {
      // Chargement des paramètres de notification
      const savedNotificationSettings = localStorage.getItem(`notification_settings_${user.id}`);
      if (savedNotificationSettings) {
        try {
          setNotificationSettings(JSON.parse(savedNotificationSettings));
        } catch (e) {
          console.error('Error parsing notification settings:', e);
        }
      }
      
      // Chargement des paramètres de remplacement
      const savedReplacementSettings = localStorage.getItem(`replacement_settings_${user.id}`);
      if (savedReplacementSettings) {
        try {
          setReplacementSettings(JSON.parse(savedReplacementSettings));
        } catch (e) {
          console.error('Error parsing replacement settings:', e);
        }
      }
    }
  }, [user]);
  
  // Déterminer si l'utilisateur est administrateur (avec vérification de sécurité)
  const isAdministrator = useMemo(() => {
    return user?.roles?.isAdmin || user?.roles?.isSuperAdmin || false;
  }, [user]);
  
  // Redirection pour les utilisateurs non-administrateurs qui tentent d'accéder aux onglets réservés
  useEffect(() => {
    if (user && !isAdministrator && (activeTab === 'notifications' || activeTab === 'replacement')) {
      setActiveTab('profile');
    }
  }, [activeTab, isAdministrator, user]);
  
  if (loading || !user) {
    return <LoadingSpinner />;
  }
  
  const handleResetPassword = async () => {
    if (!user) return;
    setIsResettingPassword(true);
    setError(null);
    setSuccess(null);

    try {
      await resetPassword(user.login);
      setSuccess('Un email de réinitialisation a été envoyé à votre adresse email');
    } catch (err) {
      setError('Erreur lors de l\'envoi de l\'email de réinitialisation');
      console.error('Error resetting password:', err);
    } finally {
      setIsResettingPassword(false);
    }
  };
  
  // Gestionnaire pour les changements dans les paramètres de notification
  const handleNotificationSettingChange = (setting: string, value: boolean) => {
    if (setting === 'inApp' || setting === 'email') {
      setNotificationSettings(prev => ({
        ...prev,
        [setting]: value
      }));
    } else {
      setNotificationSettings(prev => ({
        ...prev,
        types: {
          ...prev.types,
          [setting]: value
        }
      }));
    }
  };
  
  // Gestionnaire pour les changements dans les paramètres d'équipement de remplacement
  const handleEquipmentChange = (equipment: string, value: boolean) => {
    setReplacementSettings(prev => ({
      ...prev,
      equipment: {
        ...prev.equipment,
        [equipment]: value
      }
    }));
  };
  
  // Gestionnaire pour les changements de pourcentage de rétrocession
  const handleRetrocessionChange = (value: number) => {
    setReplacementSettings(prev => ({
      ...prev,
      retrocessionPercentage: value
    }));
  };
  
  // Sauvegarde des paramètres de notification
  const saveNotificationSettings = () => {
    if (user) {
      localStorage.setItem(`notification_settings_${user.id}`, JSON.stringify(notificationSettings));
      setSuccess('Paramètres de notification enregistrés avec succès');
      
      // Ici, vous pourriez également sauvegarder les paramètres dans Firestore
      
      setTimeout(() => setSuccess(null), 3000);
    }
  };
  
  // Sauvegarde des paramètres de remplacement
  const saveReplacementSettings = () => {
    if (user) {
      localStorage.setItem(`replacement_settings_${user.id}`, JSON.stringify(replacementSettings));
      setSuccess('Paramètres de remplacement enregistrés avec succès');
      
      // Ici, vous pourriez également sauvegarder les paramètres dans Firestore
      
      setTimeout(() => setSuccess(null), 3000);
    }
  };
  
  // Fonction pour tout activer/désactiver dans les notifications
  const toggleAllNotifications = (value: boolean) => {
    setNotificationSettings(prev => {
      const updatedTypes = Object.keys(prev.types).reduce((acc, key) => {
        acc[key as NotificationType] = value;
        return acc;
      }, {} as {[key in NotificationType]?: boolean});
      
      return {
        ...prev,
        types: updatedTypes
      };
    });
  };
  
  // Fonction pour tout activer/désactiver dans les équipements
  const toggleAllEquipment = (value: boolean) => {
    setReplacementSettings(prev => ({
      ...prev,
      equipment: {
        oxygenBottle: value,
        ecg: value,
        tpeSunmi: value,
        tpePersonal: value,
        vitalCardReaderStellar: value,
        vitalCardReaderNonStellar: value
      }
    }));
  };
  
  // Rendu de l'onglet Profil
  const renderProfileTab = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Informations personnelles</h2>
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col space-y-2">
            <div className="flex flex-col md:flex-row gap-2 items-center">
              <div className="bg-indigo-600 text-white rounded-full h-12 w-12 flex items-center justify-center font-semibold text-lg">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="flex flex-col md:ml-3">
                <h3 className="text-lg font-medium text-gray-800">{user.firstName} {user.lastName}</h3>
                <p className="text-sm text-gray-600">{user.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(user.roles).map(([role, isActive]) => {
                    if (!isActive) return null;
                    
                    const roleName = role === 'isAdmin' ? 'Administrateur' : 
                                    role === 'isUser' ? 'Associé' : 
                                    role === 'isManager' ? 'Gérant' : 
                                    role === 'isPartTime' ? 'Mi-temps' : 
                                    role === 'isCAT' ? 'CAT' :
                                    role === 'isReplacement' ? 'Remplaçant' : 
                                    role.replace('is', '');
                    
                    const bgColor = role === 'isAdmin' ? 'bg-purple-100 text-purple-800' : 
                                   role === 'isUser' ? 'bg-blue-100 text-blue-800' : 
                                   role === 'isManager' ? 'bg-green-100 text-green-800' : 
                                   role === 'isPartTime' ? 'bg-orange-100 text-orange-800' : 
                                   role === 'isCAT' ? 'bg-amber-100 text-amber-800' :
                                   role === 'isReplacement' ? 'bg-rose-100 text-rose-800' : 
                                   'bg-gray-100 text-gray-800';
                    
                    return (
                      <div key={role} className={`rounded-full px-3 py-1 ${bgColor} text-xs font-medium text-center`}>
                        {roleName}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Identifiant
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  readOnly
                  value={user.login}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed select-none"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Sécurité</h3>
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-base font-medium text-gray-800">Mot de passe</h4>
              <p className="text-sm text-gray-600">Vous pouvez réinitialiser votre mot de passe en recevant un lien par email</p>
            </div>
            <button
              onClick={handleResetPassword}
              disabled={isResettingPassword}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              {isResettingPassword ? 'Envoi...' : 'Réinitialiser'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Rendu de l'onglet Notifications
  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Paramètres de notification</h2>
      
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-blue-700 rounded-md mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Bell className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm">
              Personnalisez les notifications que vous souhaitez recevoir et comment vous souhaitez les recevoir.
            </p>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="flex flex-col space-y-1">
          <h3 className="text-lg font-medium text-gray-800">Canaux de notification</h3>
          <p className="text-sm text-gray-600 mb-2">Choisissez comment vous souhaitez recevoir vos notifications</p>
          
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                id="inApp"
                type="checkbox"
                checked={notificationSettings.inApp}
                onChange={(e) => handleNotificationSettingChange('inApp', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="inApp" className="ml-2 block text-sm text-gray-700">
                Notifications dans l'application
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="email"
                type="checkbox"
                checked={notificationSettings.email}
                onChange={(e) => handleNotificationSettingChange('email', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="email" className="ml-2 block text-sm text-gray-700">
                Notifications par email
              </label>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col space-y-1">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-800">Types de notification</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => toggleAllNotifications(true)}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Tout activer
              </button>
              <button
                onClick={() => toggleAllNotifications(false)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
              >
                <XCircle className="h-3 w-3" />
                Tout désactiver
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-2">Sélectionnez les types de notifications que vous souhaitez recevoir</p>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <h4 className="text-md font-medium text-gray-800 mb-2">Échanges</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center">
                  <input
                    id="exchange_proposed"
                    type="checkbox"
                    checked={notificationSettings.types.exchange_proposed || false}
                    onChange={(e) => handleNotificationSettingChange('exchange_proposed', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="exchange_proposed" className="ml-2 block text-sm text-gray-700">
                    Propositions d'échange
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exchange_accepted"
                    type="checkbox"
                    checked={notificationSettings.types.exchange_accepted || false}
                    onChange={(e) => handleNotificationSettingChange('exchange_accepted', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="exchange_accepted" className="ml-2 block text-sm text-gray-700">
                    Échanges acceptés
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exchange_rejected"
                    type="checkbox"
                    checked={notificationSettings.types.exchange_rejected || false}
                    onChange={(e) => handleNotificationSettingChange('exchange_rejected', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="exchange_rejected" className="ml-2 block text-sm text-gray-700">
                    Échanges refusés
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exchange_updated"
                    type="checkbox"
                    checked={notificationSettings.types.exchange_updated || false}
                    onChange={(e) => handleNotificationSettingChange('exchange_updated', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="exchange_updated" className="ml-2 block text-sm text-gray-700">
                    Échanges mis à jour
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="exchange_cancelled"
                    type="checkbox"
                    checked={notificationSettings.types.exchange_cancelled || false}
                    onChange={(e) => handleNotificationSettingChange('exchange_cancelled', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="exchange_cancelled" className="ml-2 block text-sm text-gray-700">
                    Échanges annulés
                  </label>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-md">
              <h4 className="text-md font-medium text-gray-800 mb-2">Cessions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center">
                  <input
                    id="give_proposed"
                    type="checkbox"
                    checked={notificationSettings.types.give_proposed || false}
                    onChange={(e) => handleNotificationSettingChange('give_proposed', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="give_proposed" className="ml-2 block text-sm text-gray-700">
                    Propositions de cession
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="give_accepted"
                    type="checkbox"
                    checked={notificationSettings.types.give_accepted || false}
                    onChange={(e) => handleNotificationSettingChange('give_accepted', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="give_accepted" className="ml-2 block text-sm text-gray-700">
                    Cessions acceptées
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="give_rejected"
                    type="checkbox"
                    checked={notificationSettings.types.give_rejected || false}
                    onChange={(e) => handleNotificationSettingChange('give_rejected', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="give_rejected" className="ml-2 block text-sm text-gray-700">
                    Cessions refusées
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="give_updated"
                    type="checkbox"
                    checked={notificationSettings.types.give_updated || false}
                    onChange={(e) => handleNotificationSettingChange('give_updated', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="give_updated" className="ml-2 block text-sm text-gray-700">
                    Cessions mises à jour
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="give_cancelled"
                    type="checkbox"
                    checked={notificationSettings.types.give_cancelled || false}
                    onChange={(e) => handleNotificationSettingChange('give_cancelled', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="give_cancelled" className="ml-2 block text-sm text-gray-700">
                    Cessions annulées
                  </label>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-md">
              <h4 className="text-md font-medium text-gray-800 mb-2">Remplacements</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center">
                  <input
                    id="replacement_proposed"
                    type="checkbox"
                    checked={notificationSettings.types.replacement_proposed || false}
                    onChange={(e) => handleNotificationSettingChange('replacement_proposed', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="replacement_proposed" className="ml-2 block text-sm text-gray-700">
                    Propositions de remplacement
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="replacement_accepted"
                    type="checkbox"
                    checked={notificationSettings.types.replacement_accepted || false}
                    onChange={(e) => handleNotificationSettingChange('replacement_accepted', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="replacement_accepted" className="ml-2 block text-sm text-gray-700">
                    Remplacements acceptés
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="replacement_rejected"
                    type="checkbox"
                    checked={notificationSettings.types.replacement_rejected || false}
                    onChange={(e) => handleNotificationSettingChange('replacement_rejected', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="replacement_rejected" className="ml-2 block text-sm text-gray-700">
                    Remplacements refusés
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="replacement_updated"
                    type="checkbox"
                    checked={notificationSettings.types.replacement_updated || false}
                    onChange={(e) => handleNotificationSettingChange('replacement_updated', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="replacement_updated" className="ml-2 block text-sm text-gray-700">
                    Remplacements mis à jour
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="replacement_cancelled"
                    type="checkbox"
                    checked={notificationSettings.types.replacement_cancelled || false}
                    onChange={(e) => handleNotificationSettingChange('replacement_cancelled', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="replacement_cancelled" className="ml-2 block text-sm text-gray-700">
                    Remplacements annulés
                  </label>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-md">
              <h4 className="text-md font-medium text-gray-800 mb-2">Autres notifications</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center">
                  <input
                    id="interested_user"
                    type="checkbox"
                    checked={notificationSettings.types.interested_user || false}
                    onChange={(e) => handleNotificationSettingChange('interested_user', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="interested_user" className="ml-2 block text-sm text-gray-700">
                    Utilisateurs intéressés
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="system"
                    type="checkbox"
                    checked={notificationSettings.types.system || false}
                    onChange={(e) => handleNotificationSettingChange('system', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="system" className="ml-2 block text-sm text-gray-700">
                    Notifications système
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="info"
                    type="checkbox"
                    checked={notificationSettings.types.info || false}
                    onChange={(e) => handleNotificationSettingChange('info', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="info" className="ml-2 block text-sm text-gray-700">
                    Informations
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="warning"
                    type="checkbox"
                    checked={notificationSettings.types.warning || false}
                    onChange={(e) => handleNotificationSettingChange('warning', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="warning" className="ml-2 block text-sm text-gray-700">
                    Avertissements
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="error"
                    type="checkbox"
                    checked={notificationSettings.types.error || false}
                    onChange={(e) => handleNotificationSettingChange('error', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="error" className="ml-2 block text-sm text-gray-700">
                    Erreurs
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveNotificationSettings}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Enregistrer les paramètres
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Rendu de l'onglet Remplacement (accessible uniquement pour les administrateurs)
  const renderReplacementTab = () => {
    if (!isAdministrator) {
      return (
        <div className="p-6 bg-yellow-50 rounded-md">
          <h3 className="text-lg font-medium text-yellow-800">Accès limité</h3>
          <p className="mt-2 text-sm text-yellow-700">
            Les paramètres de remplacement sont uniquement accessibles aux administrateurs.
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Paramètres de remplacement</h2>
        
        <div className="bg-green-50 border-l-4 border-green-400 p-4 text-green-700 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Stethoscope className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm">
                Configurez les équipements et conditions que vous proposez aux remplaçants.
                Ces informations seront visibles par les remplaçants lorsqu'ils consultent vos gardes.
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-800">Équipement disponible</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleAllEquipment(true)}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Tout activer
                </button>
                <button
                  onClick={() => toggleAllEquipment(false)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                >
                  <XCircle className="h-3 w-3" />
                  Tout désactiver
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">Sélectionnez les équipements que vous mettez à disposition des remplaçants</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md">
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-white">
                <input
                  id="oxygenBottle"
                  type="checkbox"
                  checked={replacementSettings.equipment.oxygenBottle}
                  onChange={(e) => handleEquipmentChange('oxygenBottle', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="oxygenBottle" className="ml-2 block text-sm text-gray-700 font-medium">
                  Bouteille d'oxygène
                </label>
              </div>
              
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-white">
                <input
                  id="ecg"
                  type="checkbox"
                  checked={replacementSettings.equipment.ecg}
                  onChange={(e) => handleEquipmentChange('ecg', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="ecg" className="ml-2 block text-sm text-gray-700 font-medium">
                  ECG
                </label>
              </div>
              
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-white">
                <input
                  id="tpeSunmi"
                  type="checkbox"
                  checked={replacementSettings.equipment.tpeSunmi}
                  onChange={(e) => handleEquipmentChange('tpeSunmi', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="tpeSunmi" className="ml-2 block text-sm text-gray-700 font-medium">
                  TPE: Sunmi Commu
                </label>
              </div>
              
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-white">
                <input
                  id="tpePersonal"
                  type="checkbox"
                  checked={replacementSettings.equipment.tpePersonal}
                  onChange={(e) => handleEquipmentChange('tpePersonal', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="tpePersonal" className="ml-2 block text-sm text-gray-700 font-medium">
                  TPE personnel
                </label>
              </div>
              
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-white">
                <input
                  id="vitalCardReaderStellar"
                  type="checkbox"
                  checked={replacementSettings.equipment.vitalCardReaderStellar}
                  onChange={(e) => handleEquipmentChange('vitalCardReaderStellar', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="vitalCardReaderStellar" className="ml-2 block text-sm text-gray-700 font-medium">
                  Lecteur carte vitale: Stellaire
                </label>
              </div>
              
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-white">
                <input
                  id="vitalCardReaderNonStellar"
                  type="checkbox"
                  checked={replacementSettings.equipment.vitalCardReaderNonStellar}
                  onChange={(e) => handleEquipmentChange('vitalCardReaderNonStellar', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="vitalCardReaderNonStellar" className="ml-2 block text-sm text-gray-700 font-medium">
                  Lecteur carte vitale: Non stellaire
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-3">
            <h3 className="text-lg font-medium text-gray-800">Lieu de récupération du matériel</h3>
            <p className="text-sm text-gray-600">Indiquez où le remplaçant peut récupérer le matériel</p>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <textarea
                id="equipmentLocation"
                value={replacementSettings.equipmentLocation}
                onChange={(e) => setReplacementSettings(prev => ({ ...prev, equipmentLocation: e.target.value }))}
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Par exemple : Au cabinet médical, à l'accueil de la clinique, etc."
              />
            </div>
          </div>
          
          <div className="flex flex-col space-y-3">
            <h3 className="text-lg font-medium text-gray-800">Pourcentage de rétrocession</h3>
            <p className="text-sm text-gray-600">Définissez le pourcentage que vous rétrocédez au remplaçant</p>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={replacementSettings.retrocessionPercentage}
                  onChange={(e) => handleRetrocessionChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="w-12 text-center bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-medium">
                  {replacementSettings.retrocessionPercentage}%
                </div>
              </div>
              
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-3">
            <h3 className="text-lg font-medium text-gray-800">Commentaires additionnels</h3>
            <p className="text-sm text-gray-600">Ajoutez des informations supplémentaires pour les remplaçants</p>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <textarea
                id="additionalComments"
                value={replacementSettings.additionalComments}
                onChange={(e) => setReplacementSettings(prev => ({ ...prev, additionalComments: e.target.value }))}
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Informations supplémentaires, consignes spécifiques, etc."
              />
            </div>
          </div>
          
          <div className="pt-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveReplacementSettings}
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Enregistrer les paramètres
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Rendu de l'onglet actif en fonction de la sélection
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'notifications':
        // Vérifier si l'utilisateur a le droit d'accéder à cet onglet
        return isAdministrator ? renderNotificationsTab() : renderProfileTab();
      case 'replacement':
        // Vérifier si l'utilisateur a le droit d'accéder à cet onglet
        return isAdministrator ? renderReplacementTab() : renderProfileTab();
      default:
        return renderProfileTab();
    }
  };

  return (
    <div className="min-h-screen flex flex-row">
      {/* Sidebar latérale - toujours visible sur desktop, contrôlable sur mobile */}
      <div className={`w-64 h-screen bg-white shadow-lg fixed left-0 top-0 transform transition-transform duration-300 ease-in-out z-30 ${
        sidebarCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'
      }`}>
        <div className="p-4 bg-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Mon Profil</h2>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded-full hover:bg-indigo-500 md:hidden"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white rounded-full h-10 w-10 flex items-center justify-center font-semibold">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div>
              <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>
        </div>
        
        <nav className="p-4">
          <div className="space-y-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'profile' 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <User className="h-5 w-5 mr-3" />
              Profil
            </button>
            
            {isAdministrator && (
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'notifications' 
                    ? 'bg-indigo-100 text-indigo-800' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Bell className="h-5 w-5 mr-3" />
                Notifications
              </button>
            )}
            
            {isAdministrator && (
              <button
                onClick={() => setActiveTab('replacement')}
                className={`w-full flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'replacement' 
                    ? 'bg-indigo-100 text-indigo-800' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Stethoscope className="h-5 w-5 mr-3" />
                Remplacements
              </button>
            )}
            

          </div>
        </nav>
      </div>
      
      {/* Overlay pour fermer la sidebar sur mobile */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Contenu principal avec décalage pour la sidebar */}
      <div className={`flex-1 transition-all duration-300 ${
        sidebarCollapsed ? 'md:ml-64' : 'ml-0 md:ml-64'
      }`}>
        <div className="p-4 md:px-8 md:py-6">
          {/* Bouton toggle pour mobile */}
          <div className="flex justify-between items-center mb-6 md:hidden">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 bg-indigo-100 rounded-full"
            >
              {sidebarCollapsed ? <PanelRight className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </button>
            <h1 className="text-xl font-bold text-gray-900">Mon Profil</h1>
          </div>
          
          {/* Messages d'erreur et de succès */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Contenu de l'onglet actif */}
          <div className="bg-white shadow-md rounded-lg p-6">
            {renderActiveTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;