import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./config";

// Initialiser Firebase Cloud Messaging
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Fonction pour enregistrer le service worker
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker non supporté dans ce navigateur');
      return null;
    }

    // Attendre que le service worker soit prêt
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    
    console.log('Service Worker enregistré avec succès:', registration);
    
    // Attendre que le service worker soit actif
    await navigator.serviceWorker.ready;
    console.log('Service Worker est prêt');
    
    return registration;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
    return null;
  }
};

// Demander la permission et obtenir le token FCM
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    // Vérifier si le navigateur supporte les notifications et si nous sommes dans un environnement navigateur
    if (typeof window === 'undefined' || !("Notification" in window) || !messaging) {
      console.log("Ce navigateur ne prend pas en charge les notifications ou nous ne sommes pas dans un environnement navigateur.");
      return null;
    }

    // S'assurer que le service worker est enregistré
    const swRegistration = await registerServiceWorker();
    if (!swRegistration) {
      console.error('Impossible d\'enregistrer le service worker');
      return null;
    }

    // Demander la permission
    const permission = await Notification.requestPermission();
    
    if (permission !== "granted") {
      console.log("Permission de notification refusée.");
      return null;
    }
    
    console.log('Tentative d\'obtention du token FCM...');
    
    // Obtenir le token FCM avec la clé VAPID générée dans la console Firebase
    const token = await getToken(messaging, {
      vapidKey: "BMRQROKtx98URmi7ZrQ35M_kY0WnVm3JcGnR36ljC8V9PhIEAUGjzseCqvhj4Qag7qwMgsyLgWEJYMAY2viymxI",
      serviceWorkerRegistration: swRegistration
    });
    
    if (token) {
      console.log("Token FCM obtenu:", token.substring(0, 20) + '...');
      return token;
    } else {
      console.log("Impossible d'obtenir le token.");
      return null;
    }
  } catch (error: any) {
    console.error("Erreur lors de la demande de permission:", error);
    
    // Logs détaillés pour l'erreur
    if (error.code) {
      console.error('Code d\'erreur:', error.code);
    }
    if (error.message) {
      console.error('Message d\'erreur:', error.message);
    }
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    // Erreurs spécifiques FCM
    if (error.code === 'messaging/registration-token-not-registered') {
      console.error('Le token FCM n\'est pas enregistré. Réessayez.');
    } else if (error.code === 'messaging/invalid-vapid-key') {
      console.error('Clé VAPID invalide.');
    } else if (error.code === 'messaging/permission-blocked') {
      console.error('Les notifications sont bloquées dans le navigateur.');
    }
    
    return null;
  }
};

// Écouter les messages FCM en premier plan
export const onMessageListener = () => {
  if (!messaging) return Promise.resolve(null);
  
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};

// Formater les messages de notification
export const formatNotificationMessage = (type: string, data: any) => {
  switch (type) {
    case 'desiderata_reminder':
      return {
        title: "Rappel : Validation des désiderata",
        body: `N'oubliez pas de valider vos désiderata avant le ${data.deadline}. Votre participation est essentielle pour la création du planning.`
      };
    case 'exchange_proposed':
      return {
        title: "Nouvelle proposition d'échange",
        body: `${data.proposerName} vous propose un échange pour votre garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case 'exchange_accepted':
      return {
        title: "Proposition d'échange acceptée",
        body: `${data.accepterName} a accepté votre proposition d'échange pour la garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case 'give_proposed':
      return {
        title: "Nouvelle proposition de cession",
        body: `${data.proposerName} vous propose de reprendre sa garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case 'give_accepted':
      return {
        title: "Proposition de cession acceptée",
        body: `${data.accepterName} a accepté votre proposition de cession pour la garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case 'replacement_proposed':
      return {
        title: "Nouvelle proposition de remplacement",
        body: `${data.proposerName} vous propose un remplacement pour la garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    default:
      return {
        title: "Nouvelle notification",
        body: "Vous avez reçu une nouvelle notification dans l'application PlaniDocs."
      };
  }
};
