import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./config";

// Initialiser Firebase Cloud Messaging
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Fonction pour attendre l'activation complète du service worker
const waitForServiceWorkerActivation = async (registration: ServiceWorkerRegistration): Promise<boolean> => {
  return new Promise((resolve) => {
    const checkState = () => {
      const sw = registration.active || registration.waiting || registration.installing;
      
      if (registration.active) {
        console.log('✅ Service Worker actif et prêt');
        resolve(true);
        return;
      }
      
      if (sw) {
        console.log(`⏳ Service Worker en cours: ${sw.state}`);
        sw.addEventListener('statechange', function onStateChange() {
          console.log(`🔄 Changement d'état du SW: ${sw.state}`);
          if (sw.state === 'activated') {
            sw.removeEventListener('statechange', onStateChange);
            console.log('✅ Service Worker activé après attente');
            resolve(true);
          }
        });
      } else {
        console.warn('⚠️ Aucun Service Worker trouvé');
        resolve(false);
      }
    };
    
    checkState();
  });
};

// Fonction pour enregistrer le service worker avec activation garantie
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    if (!('serviceWorker' in navigator)) {
      console.log('❌ Service Worker non supporté dans ce navigateur');
      return null;
    }

    console.log('🔧 Début de l\'enregistrement du Service Worker...');
    
    // Vérifier si un service worker est déjà enregistré
    const existingRegistration = await navigator.serviceWorker.getRegistration('/');
    
    if (existingRegistration) {
      console.log('🔄 Service Worker déjà enregistré, vérification de l\'état...');
      
      // Attendre l'activation si nécessaire
      const isActive = await waitForServiceWorkerActivation(existingRegistration);
      
      if (isActive) {
        return existingRegistration;
      } else {
        console.log('🔄 Ré-enregistrement du Service Worker...');
        await existingRegistration.unregister();
      }
    }
    
    // Enregistrer le nouveau service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
      updateViaCache: 'none' // Force la mise à jour du SW
    });
    
    console.log('📦 Service Worker enregistré, scope:', registration.scope);
    
    // Attendre l'activation complète
    const isActivated = await waitForServiceWorkerActivation(registration);
    
    if (!isActivated) {
      // Forcer la mise à jour si nécessaire
      await registration.update();
      await waitForServiceWorkerActivation(registration);
    }
    
    // Vérifier une dernière fois
    if (registration.active) {
      console.log('✅ Service Worker complètement actif');
      console.log('   State:', registration.active.state);
      console.log('   Script URL:', registration.active.scriptURL);
      return registration;
    } else {
      console.error('❌ Service Worker non actif après toutes les tentatives');
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
    return null;
  }
};

// Fonction pour obtenir le token FCM avec retry
const getTokenWithRetry = async (
  swRegistration: ServiceWorkerRegistration,
  maxRetries: number = 3
): Promise<string | null> => {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentative ${attempt}/${maxRetries} d'obtention du token FCM...`);
      
      // Vérifier que le SW est toujours actif
      if (!swRegistration.active) {
        console.log('⏳ Attente de l\'activation du Service Worker...');
        await waitForServiceWorkerActivation(swRegistration);
      }
      
      // Petit délai pour s'assurer que tout est prêt
      if (attempt > 1) {
        const delay = attempt * 1000; // Délai progressif
        console.log(`⏱️ Attente de ${delay}ms avant la tentative...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Tenter d'obtenir le token
      const token = await getToken(messaging, {
        vapidKey: "BMRQROKtx98URmi7ZrQ35M_kY0WnVm3JcGnR36ljC8V9PhIEAUGjzseCqvhj4Qag7qwMgsyLgWEJYMAY2viymxI",
        serviceWorkerRegistration: swRegistration
      });
      
      if (token) {
        console.log(`✅ Token FCM obtenu au tentative ${attempt}`);
        return token;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Tentative ${attempt} échouée:`, error.message);
      
      // Si c'est une erreur "no active Service Worker", réessayer
      if (error.message?.includes('no active Service Worker')) {
        console.log('🔄 Réactivation du Service Worker...');
        await swRegistration.update();
        await waitForServiceWorkerActivation(swRegistration);
      }
    }
  }
  
  // Toutes les tentatives ont échoué
  throw lastError || new Error('Impossible d\'obtenir le token FCM après plusieurs tentatives');
};

// Demander la permission et obtenir le token FCM
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    console.log('🔔 === Début de la demande de permission pour les notifications ===');
    
    // Vérifier si le navigateur supporte les notifications
    if (typeof window === 'undefined' || !("Notification" in window) || !messaging) {
      console.log("❌ Ce navigateur ne prend pas en charge les notifications");
      return null;
    }

    // Vérifier le contexte sécurisé (HTTPS ou localhost)
    if (!window.isSecureContext) {
      console.error('❌ Les notifications nécessitent HTTPS ou localhost');
      return null;
    }

    console.log('🔐 Contexte sécurisé confirmé');

    // Enregistrer et activer le service worker
    const swRegistration = await registerServiceWorker();
    if (!swRegistration) {
      console.error('❌ Impossible d\'enregistrer le service worker');
      return null;
    }

    // Demander la permission si nécessaire
    let permission = Notification.permission;
    console.log(`💬 Permission actuelle: ${permission}`);
    
    if (permission === 'default') {
      console.log('🙏 Demande de permission à l\'utilisateur...');
      permission = await Notification.requestPermission();
      console.log(`👤 Réponse de l'utilisateur: ${permission}`);
    }
    
    if (permission !== "granted") {
      console.log("❌ Permission de notification refusée par l'utilisateur");
      return null;
    }
    
    console.log('✅ Permission accordée, obtention du token FCM...');
    
    // Obtenir le token FCM avec retry
    const token = await getTokenWithRetry(swRegistration);
    
    if (token) {
      console.log("✅ === Token FCM obtenu avec succès ===");
      console.log("   Token (extrait):", token.substring(0, 20) + '...');
      return token;
    } else {
      console.log("❌ Impossible d'obtenir le token FCM");
      return null;
    }
  } catch (error: any) {
    console.error("❌ === Erreur lors de la demande de permission ===", error);
    
    // Logs détaillés pour l'erreur
    if (error.code) {
      console.error('🔢 Code d\'erreur:', error.code);
    }
    if (error.message) {
      console.error('💬 Message d\'erreur:', error.message);
    }
    
    // Erreurs spécifiques FCM
    if (error.code === 'messaging/registration-token-not-registered') {
      console.error('🔄 Le token FCM n\'est pas enregistré. Réessayez.');
    } else if (error.code === 'messaging/invalid-vapid-key') {
      console.error('🔑 Clé VAPID invalide. Vérifiez la configuration Firebase.');
    } else if (error.code === 'messaging/permission-blocked') {
      console.error('🚫 Les notifications sont bloquées dans le navigateur.');
    } else if (error.message?.includes('no active Service Worker')) {
      console.error('👷 Service Worker non actif. Rechargez la page.');
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
