import { sendDesiderataReminderPushNotification } from '../lib/firebase/pushNotifications';
import { requestNotificationPermission } from '../lib/firebase/messaging';
import { saveDeviceToken } from '../lib/firebase/deviceTokens';
import { createParisDate } from './timezoneUtils';

/**
 * Script de test pour vérifier le système de notifications
 * À exécuter depuis la console du navigateur après connexion
 */
export const testNotificationSystem = async () => {
  console.log('🧪 Début du test du système de notifications');
  
  try {
    // 1. Vérifier le support des notifications
    if (!('Notification' in window)) {
      console.error('❌ Les notifications ne sont pas supportées par ce navigateur');
      return false;
    }
    console.log('✅ Support des notifications détecté');
    
    // 2. Vérifier la permission actuelle
    const currentPermission = Notification.permission;
    console.log(`📋 Permission actuelle: ${currentPermission}`);
    
    // 3. Demander la permission si nécessaire
    if (currentPermission !== 'granted') {
      console.log('🔔 Demande de permission...');
      const token = await requestNotificationPermission();
      
      if (!token) {
        console.error('❌ Permission refusée ou erreur lors de l\'obtention du token');
        return false;
      }
      
      console.log(`✅ Token FCM obtenu: ${token.substring(0, 30)}...`);
      
      // Sauvegarder le token (remplacer USER_ID par l'ID réel)
      const userId = (window as any).currentUserId || 'test-user';
      await saveDeviceToken(userId, token);
      console.log('✅ Token enregistré dans Firestore');
    }
    
    // 4. Tester l'envoi d'une notification locale
    console.log('📨 Test de notification locale...');
    const notification = new Notification('Test Planidocs', {
      body: 'Ceci est une notification de test',
      icon: '/favicon.ico',
      badge: '/badge-icon.png',
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });
    
    notification.onclick = () => {
      console.log('✅ Clic sur la notification détecté');
      window.focus();
      notification.close();
    };
    
    // 5. Tester l'envoi via Firebase (nécessite un utilisateur connecté)
    const currentUser = (window as any).currentUser;
    if (currentUser) {
      console.log('🚀 Test d\'envoi via Firebase...');
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      
      try {
        await sendDesiderataReminderPushNotification(currentUser.id, deadline);
        console.log('✅ Notification push envoyée via Firebase');
      } catch (error) {
        console.error('❌ Erreur lors de l\'envoi via Firebase:', error);
      }
    } else {
      console.warn('⚠️ Aucun utilisateur connecté - impossible de tester l\'envoi Firebase');
    }
    
    console.log('✨ Test terminé avec succès');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur durant le test:', error);
    return false;
  }
};

/**
 * Vérifie l'état actuel du système de notifications
 */
export const checkNotificationStatus = () => {
  const status = {
    browserSupport: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    serviceWorker: 'serviceWorker' in navigator,
    fcmToken: localStorage.getItem('fcm_token'),
    bannierDismissed: localStorage.getItem('notification_banner_dismissed'),
    deniedDismissed: localStorage.getItem('notification_denied_dismissed')
  };
  
  console.table(status);
  
  // Recommandations
  console.log('\n📊 Recommandations:');
  
  if (!status.browserSupport) {
    console.log('❌ Navigateur incompatible - utilisez Chrome, Firefox ou Safari');
  } else if (status.permission === 'denied') {
    console.log('⚠️ Notifications bloquées - débloquez-les dans les paramètres du navigateur');
  } else if (status.permission === 'default') {
    console.log('💡 Notifications non configurées - appelez testNotificationSystem()');
  } else if (!status.fcmToken) {
    console.log('⚠️ Pas de token FCM - reconnectez-vous ou appelez testNotificationSystem()');
  } else {
    console.log('✅ Système de notifications opérationnel');
  }
  
  return status;
};

// Exposer les fonctions globalement pour les tests
if (typeof window !== 'undefined') {
  (window as any).testNotifications = {
    test: testNotificationSystem,
    checkStatus: checkNotificationStatus
  };
  
  console.log('🔧 Fonctions de test disponibles:');
  console.log('- testNotifications.test() : Lance le test complet');
  console.log('- testNotifications.checkStatus() : Vérifie l\'état actuel');
}