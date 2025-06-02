import { useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/hooks';
import { requestNotificationPermission } from '../../lib/firebase/messaging';
import { saveDeviceToken } from '../../lib/firebase/deviceTokens';

/**
 * Composant qui gère la demande de permission pour les notifications push
 * et l'enregistrement du token FCM lorsque l'utilisateur est connecté.
 */
const NotificationPermissionManager: React.FC = () => {
  const { user } = useAuth();
  const [permissionRequested, setPermissionRequested] = useState<boolean>(() => {
    // Récupérer l'état depuis le localStorage pour persister entre les sessions
    return localStorage.getItem('notification_permission_requested') === 'true';
  });

  useEffect(() => {
    // Si l'utilisateur est connecté et que la permission n'a pas encore été demandée
    if (user && !permissionRequested) {
      const setupPushNotifications = async () => {
        try {
          console.log('Demande de permission pour les notifications push...');
          const token = await requestNotificationPermission();
          
          if (token) {
            console.log('Token FCM obtenu, enregistrement dans Firestore...');
            // Enregistrer le token dans Firestore avec l'ID d'association de l'utilisateur
            await saveDeviceToken(user.id, token, user.associationId);
            console.log('Token FCM enregistré avec succès');
          } else {
            console.log('Aucun token FCM obtenu, les notifications push ne seront pas disponibles');
          }
          
          // Marquer la permission comme demandée pour éviter de redemander à chaque rendu
          setPermissionRequested(true);
          localStorage.setItem('notification_permission_requested', 'true');
        } catch (error) {
          console.error('Erreur lors de la configuration des notifications push:', error);
          // Même en cas d'erreur, on marque comme demandé pour éviter de redemander en boucle
          setPermissionRequested(true);
          localStorage.setItem('notification_permission_requested', 'true');
        }
      };
      
      setupPushNotifications();
    }
  }, [user, permissionRequested]);

  // Ce composant ne rend rien, il gère uniquement la logique
  return null;
};

export default NotificationPermissionManager;
