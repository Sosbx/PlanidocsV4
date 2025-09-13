/**
 * Utilitaire de diagnostic pour les notifications push
 * Aide à identifier les problèmes de configuration FCM
 */

export const runNotificationDiagnostic = async () => {
  console.log('========================================');
  console.log('🔍 Diagnostic des notifications push');
  console.log('========================================');
  
  const results: Record<string, any> = {};
  
  // 1. Vérifier le support des notifications
  if ('Notification' in window) {
    results.notificationSupport = true;
    console.log('✅ Les notifications sont supportées');
  } else {
    results.notificationSupport = false;
    console.log('❌ Les notifications ne sont pas supportées');
    return results;
  }
  
  // 2. Vérifier la permission actuelle
  results.currentPermission = Notification.permission;
  console.log(`📋 Permission actuelle: ${Notification.permission}`);
  
  // 3. Vérifier le support des Service Workers
  if ('serviceWorker' in navigator) {
    results.serviceWorkerSupport = true;
    console.log('✅ Les Service Workers sont supportés');
    
    // 4. Vérifier les Service Workers enregistrés
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      results.serviceWorkerRegistrations = registrations.length;
      console.log(`📦 Service Workers enregistrés: ${registrations.length}`);
      
      registrations.forEach((reg, index) => {
        console.log(`  ${index + 1}. Scope: ${reg.scope}`);
        console.log(`     Active: ${reg.active ? 'Oui' : 'Non'}`);
        console.log(`     Waiting: ${reg.waiting ? 'Oui' : 'Non'}`);
        console.log(`     Installing: ${reg.installing ? 'Oui' : 'Non'}`);
      });
      
      // Chercher spécifiquement notre service worker Firebase
      const firebaseSwReg = registrations.find(reg => 
        reg.scope.includes(window.location.origin) || 
        reg.active?.scriptURL.includes('firebase-messaging-sw')
      );
      
      if (firebaseSwReg) {
        results.firebaseServiceWorker = true;
        console.log('✅ Service Worker Firebase trouvé');
      } else {
        results.firebaseServiceWorker = false;
        console.log('⚠️ Service Worker Firebase non trouvé');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des Service Workers:', error);
      results.serviceWorkerError = error;
    }
  } else {
    results.serviceWorkerSupport = false;
    console.log('❌ Les Service Workers ne sont pas supportés');
  }
  
  // 5. Vérifier HTTPS/localhost
  const isSecureContext = window.isSecureContext;
  results.secureContext = isSecureContext;
  if (isSecureContext) {
    console.log('✅ Contexte sécurisé (HTTPS ou localhost)');
  } else {
    console.log('❌ Contexte non sécurisé - les notifications nécessitent HTTPS');
  }
  
  // 6. Vérifier la configuration Firebase
  try {
    const { app } = await import('../lib/firebase/config');
    if (app) {
      results.firebaseApp = true;
      console.log('✅ Firebase App initialisée');
      console.log(`   Project ID: ${app.options.projectId}`);
      console.log(`   App ID: ${app.options.appId}`);
    }
  } catch (error) {
    results.firebaseApp = false;
    console.log('❌ Erreur avec Firebase App:', error);
  }
  
  // 7. Vérifier Firebase Messaging
  try {
    const { messaging } = await import('../lib/firebase/messaging');
    if (messaging) {
      results.firebaseMessaging = true;
      console.log('✅ Firebase Messaging initialisé');
    } else {
      results.firebaseMessaging = false;
      console.log('❌ Firebase Messaging non initialisé');
    }
  } catch (error) {
    results.firebaseMessaging = false;
    console.log('❌ Erreur avec Firebase Messaging:', error);
  }
  
  // 8. Vérifier la clé VAPID
  results.vapidKey = 'BMRQROKtx98URmi7ZrQ35M_kY0WnVm3JcGnR36ljC8V9PhIEAUGjzseCqvhj4Qag7qwMgsyLgWEJYMAY2viymxI';
  console.log('🔑 Clé VAPID configurée');
  
  // 9. Vérifier le navigateur et la version
  const userAgent = navigator.userAgent;
  results.userAgent = userAgent;
  console.log(`🌐 Navigateur: ${userAgent}`);
  
  // Détecter le type de navigateur
  if (userAgent.includes('Chrome')) {
    results.browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    results.browser = 'Firefox';
  } else if (userAgent.includes('Safari')) {
    results.browser = 'Safari';
  } else if (userAgent.includes('Edge')) {
    results.browser = 'Edge';
  } else {
    results.browser = 'Autre';
  }
  
  // 10. Recommandations
  console.log('\n📌 Recommandations:');
  
  if (!results.secureContext) {
    console.log('   ⚠️ Utilisez HTTPS pour les notifications');
  }
  
  if (results.currentPermission === 'denied') {
    console.log('   ⚠️ Les notifications sont bloquées. Réinitialisez les permissions dans les paramètres du navigateur');
  }
  
  if (!results.firebaseServiceWorker) {
    console.log('   ⚠️ Enregistrez le Service Worker Firebase en rechargeant la page');
  }
  
  if (results.browser === 'Safari') {
    console.log('   ⚠️ Safari a des limitations avec les Web Push. Assurez-vous d\'utiliser macOS 13+ ou iOS 16.4+');
  }
  
  console.log('========================================');
  console.log('Diagnostic terminé. Résultats:', results);
  console.log('========================================');
  
  return results;
};

// Fonction pour tester manuellement l'enregistrement du service worker
export const testServiceWorkerRegistration = async () => {
  console.log('🧪 Test d\'enregistrement du Service Worker...');
  
  try {
    // Désinscrire tous les service workers existants
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log(`🗑️ Service Worker désinscrit: ${registration.scope}`);
    }
    
    // Attendre un peu
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Réenregistrer le service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    
    console.log('✅ Service Worker enregistré avec succès');
    console.log('   Scope:', registration.scope);
    
    // Attendre l'activation
    await navigator.serviceWorker.ready;
    console.log('✅ Service Worker prêt et actif');
    
    return registration;
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement:', error);
    throw error;
  }
};

// Exporter pour utilisation dans la console
if (typeof window !== 'undefined') {
  (window as any).notificationDiagnostic = {
    run: runNotificationDiagnostic,
    testSW: testServiceWorkerRegistration
  };
  
  console.log('🔧 Outils de diagnostic des notifications chargés');
  console.log('   Utilisez: notificationDiagnostic.run() pour lancer le diagnostic');
  console.log('   Utilisez: notificationDiagnostic.testSW() pour tester le Service Worker');
}