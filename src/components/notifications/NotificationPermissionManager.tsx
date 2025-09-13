import React, { useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/hooks';
import { requestNotificationPermission } from '../../lib/firebase/messaging';
import { saveDeviceToken, removeDeviceToken } from '../../lib/firebase/deviceTokens';

interface NotificationStatus {
  permission: NotificationPermission | 'unsupported';
  token: string | null;
  error: string | null;
  loading: boolean;
}

/**
 * Composant qui gère la demande de permission pour les notifications push
 * et l'enregistrement du token FCM lorsque l'utilisateur est connecté.
 */
const NotificationPermissionManager: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<NotificationStatus>({
    permission: 'default',
    token: null,
    error: null,
    loading: false
  });
  const [showBanner, setShowBanner] = useState<boolean>(false);
  
  // Détection mobile et PWA
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;
  
  // DÉSACTIVER pour desktop
  const isDesktop = !isMobile;
  
  // Si desktop, ne rien faire
  if (isDesktop) {
    return null;
  }

  // Nettoyer les données si changement d'utilisateur
  useEffect(() => {
    if (user) {
      const lastUserId = localStorage.getItem('last_user_id');
      if (lastUserId && lastUserId !== user.id) {
        // Nouvel utilisateur détecté, nettoyer les anciennes données
        console.log('Changement d\'utilisateur détecté, nettoyage des données de notification');
        localStorage.removeItem('fcm_token');
        localStorage.removeItem('notification_banner_dismissed');
        localStorage.removeItem('notification_denied_dismissed');
        localStorage.removeItem('notification_permission_requested');
      }
      localStorage.setItem('last_user_id', user.id);
    }
  }, [user]);
  
  // Vérifier le support des notifications
  useEffect(() => {
    if (!('Notification' in window)) {
      setStatus(prev => ({ ...prev, permission: 'unsupported' }));
      return;
    }
    
    // Vérifier la permission actuelle
    const currentPermission = Notification.permission;
    setStatus(prev => ({ ...prev, permission: currentPermission }));
    
    // Récupérer le token stocké pour cet utilisateur
    const userTokenKey = `fcm_token_${user?.id}`;
    const storedToken = user ? localStorage.getItem(userTokenKey) : null;
    if (storedToken) {
      setStatus(prev => ({ ...prev, token: storedToken }));
    }
    
    // Afficher la bannière UNIQUEMENT sur mobile si:
    // 1. L'utilisateur est connecté
    // 2. Pas de token enregistré
    // 3. Permissions pas encore refusées
    // 4. C'est un mobile (vérifié plus haut)
    if (user && !storedToken && currentPermission !== 'denied' && isMobile) {
      console.log('🔔 Notifications non activées pour', user.firstName, user.lastName);
      console.log('   Affichage de la bannière d\'activation...');
      setShowBanner(true);
    } else if (user && storedToken && isMobile) {
      console.log('✅ Notifications déjà activées pour', user.firstName, user.lastName);
    } else if (!isMobile) {
      console.log('💻 Desktop - notifications désactivées');
    }
  }, [user]);
  
  // Fonction pour demander la permission
  const requestPermission = async () => {
    if (!user) return;
    
    setStatus(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('Demande de permission pour les notifications push...');
      const token = await requestNotificationPermission();
      
      if (token) {
        console.log('🎆 Token FCM obtenu:', token.substring(0, 20) + '...');
        
        // Enregistrer le token dans Firestore
        await saveDeviceToken(user.id, token, user.associationId);
        
        // Sauvegarder localement avec l'ID utilisateur
        const userTokenKey = `fcm_token_${user.id}`;
        localStorage.setItem(userTokenKey, token);
        // Garder aussi en global pour compatibilité
        localStorage.setItem('fcm_token', token);
        
        setStatus(prev => ({
          ...prev,
          token,
          permission: 'granted',
          loading: false
        }));
        
        setShowBanner(false);
        console.log('✅ Notifications push activées avec succès pour', user.firstName, user.lastName);
        
        // Notification de confirmation
        new Notification('Notifications activées ✅', {
          body: `Les notifications sont maintenant activées pour ${user.firstName} ${user.lastName}. Vous recevrez les rappels et alertes importantes.`,
          icon: '/favicon.ico',
          badge: '/badge-icon.png'
        });
      } else {
        // Permission refusée ou erreur
        const permission = Notification.permission;
        setStatus(prev => ({
          ...prev,
          permission,
          loading: false,
          error: permission === 'denied' 
            ? 'Vous avez refusé les notifications. Activez-les dans les paramètres du navigateur.'
            : 'Impossible d\'activer les notifications'
        }));
        
        if (permission === 'denied') {
          const bannerKey = `notification_banner_dismissed_${user.id}`;
          localStorage.setItem(bannerKey, 'true');
          setShowBanner(false);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la configuration des notifications:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: 'Erreur lors de l\'activation des notifications'
      }));
    }
  };
  
  // Fonction pour désactiver les notifications
  const disableNotifications = async () => {
    if (!user || !status.token) return;
    
    try {
      await removeDeviceToken(user.id, status.token);
      localStorage.removeItem('fcm_token');
      setStatus(prev => ({ ...prev, token: null }));
      console.log('Token FCM supprimé');
    } catch (error) {
      console.error('Erreur lors de la suppression du token:', error);
    }
  };
  
  // Fonction pour fermer la bannière (temporairement)
  const dismissBanner = () => {
    // Ne pas sauvegarder le dismiss de façon permanente
    // La bannière réapparaîtra à la prochaine connexion si pas de token
    console.log('⏰ Rappel reporté - les notifications ne sont pas activées');
    setShowBanner(false);
  };
  
  // Obtenir les instructions spécifiques au mobile
  const getMobileInstructions = () => {
    if (isIOS && !isPWA) {
      return "Sur iOS, installez d'abord l'app : Appuyez sur le bouton Partager puis 'Sur l'écran d'accueil'";
    }
    if (isIOS && isPWA) {
      return "Autorisez les notifications dans Réglages → Notifications → Planidocs";
    }
    if (isMobile) {
      return "Autorisez les notifications dans les paramètres de votre navigateur";
    }
    return null;
  };

  // Afficher une bannière si nécessaire
  if (showBanner && status.permission === 'default') {
    return (
      <div className="fixed bottom-4 right-4 max-w-md bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
        <div className="flex items-start space-x-3">
          <Bell className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">
              🔔 Activer les notifications importantes
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Important :</strong> Recevez des rappels pour vos désiderata et soyez alerté des échanges de gardes.
            </p>
            {isMobile && (
              <p className="text-xs text-blue-600 mt-2 font-medium">
                {getMobileInstructions()}
              </p>
            )}
            <div className="mt-3 flex space-x-2">
              <button
                onClick={requestPermission}
                disabled={status.loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
              >
                {status.loading ? 'Activation...' : '✅ Activer maintenant'}
              </button>
              <button
                onClick={dismissBanner}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
              >
                🕒 Rappeler plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Afficher une alerte si les notifications sont bloquées
  const deniedKey = user ? `notification_denied_dismissed_${user.id}` : 'notification_denied_dismissed';
  if (status.permission === 'denied' && !localStorage.getItem(deniedKey)) {
    return (
      <div className="fixed top-16 right-4 max-w-md bg-yellow-50 border border-yellow-200 rounded-lg p-4 z-40">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800">
              Les notifications sont bloquées. Pour les activer, cliquez sur l'icône à gauche de l'URL dans la barre d'adresse.
            </p>
          </div>
          <button
            onClick={() => {
              if (user) {
                const deniedKey = `notification_denied_dismissed_${user.id}`;
                localStorage.setItem(deniedKey, 'true');
              }
              setStatus(prev => ({ ...prev, permission: 'denied' }));
            }}
            className="text-yellow-600 hover:text-yellow-800"
          >
            ×
          </button>
        </div>
      </div>
    );
  }
  
  return null;
};

export default NotificationPermissionManager;
