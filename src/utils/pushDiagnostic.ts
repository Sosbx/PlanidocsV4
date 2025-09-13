/**
 * Utilitaire de diagnostic avancé pour les push notifications
 * Teste directement l'API Push du navigateur pour identifier les problèmes
 */

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

/**
 * Teste la configuration Firebase et la connectivité
 */
export const testFirebaseConfig = async (): Promise<DiagnosticResult> => {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyC59Syrl04sY7E1zmJW_jFs1m5I7rHORB4",
      authDomain: "planego-696d3.firebaseapp.com",
      projectId: "planego-696d3",
      storageBucket: "planego-696d3.appspot.com",
      messagingSenderId: "688748545967",
      appId: "1:688748545967:web:1f241fc72beafe9ed3915a"
    };
    
    // Vérifier que toutes les clés sont présentes
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
    const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
    
    if (missingKeys.length > 0) {
      return {
        test: 'Configuration Firebase',
        status: 'error',
        message: `Clés manquantes: ${missingKeys.join(', ')}`,
        details: firebaseConfig
      };
    }
    
    // Vérifier le format du messagingSenderId
    if (!/^\d+$/.test(firebaseConfig.messagingSenderId)) {
      return {
        test: 'Configuration Firebase',
        status: 'error',
        message: 'messagingSenderId invalide (doit être numérique)',
        details: { messagingSenderId: firebaseConfig.messagingSenderId }
      };
    }
    
    return {
      test: 'Configuration Firebase',
      status: 'success',
      message: 'Configuration valide',
      details: {
        projectId: firebaseConfig.projectId,
        messagingSenderId: firebaseConfig.messagingSenderId
      }
    };
  } catch (error) {
    return {
      test: 'Configuration Firebase',
      status: 'error',
      message: 'Erreur lors de la vérification',
      details: error
    };
  }
};

/**
 * Teste directement l'API Push du navigateur
 */
export const testPushAPI = async (): Promise<DiagnosticResult> => {
  try {
    // Vérifier si l'API Push est disponible
    if (!('PushManager' in window)) {
      return {
        test: 'API Push',
        status: 'error',
        message: 'PushManager non disponible dans ce navigateur'
      };
    }
    
    // Vérifier si on peut accéder au Service Worker
    if (!navigator.serviceWorker) {
      return {
        test: 'API Push',
        status: 'error',
        message: 'Service Worker API non disponible'
      };
    }
    
    // Obtenir le Service Worker actif
    const registration = await navigator.serviceWorker.ready;
    
    if (!registration.pushManager) {
      return {
        test: 'API Push',
        status: 'error',
        message: 'PushManager non disponible sur le Service Worker'
      };
    }
    
    // Vérifier la permission
    const permission = await registration.pushManager.permissionState({
      userVisibleOnly: true
    });
    
    return {
      test: 'API Push',
      status: permission === 'granted' ? 'success' : 'warning',
      message: `Permission: ${permission}`,
      details: {
        pushManager: true,
        permissionState: permission
      }
    };
  } catch (error: any) {
    return {
      test: 'API Push',
      status: 'error',
      message: error.message || 'Erreur inconnue',
      details: error
    };
  }
};

/**
 * Teste la création d'une souscription push SANS VAPID
 */
export const testPushSubscriptionWithoutVAPID = async (): Promise<DiagnosticResult> => {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Essayer de créer une souscription sans VAPID
    console.log('🧪 Test de souscription SANS VAPID key...');
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true
      // Pas de applicationServerKey (VAPID)
    });
    
    if (subscription) {
      // Si ça marche, le problème vient de la VAPID key
      await subscription.unsubscribe();
      
      return {
        test: 'Souscription sans VAPID',
        status: 'warning',
        message: 'Fonctionne SANS VAPID - Problème de clé VAPID détecté',
        details: {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime
        }
      };
    }
  } catch (error: any) {
    return {
      test: 'Souscription sans VAPID',
      status: 'error',
      message: `Échec: ${error.message}`,
      details: error
    };
  }
  
  return {
    test: 'Souscription sans VAPID',
    status: 'error',
    message: 'Impossible de créer une souscription'
  };
};

/**
 * Teste la création d'une souscription push AVEC VAPID
 */
export const testPushSubscriptionWithVAPID = async (): Promise<DiagnosticResult> => {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // VAPID key du projet
    const vapidKey = 'BMRQROKtx98URmi7ZrQ35M_kY0WnVm3JcGnR36ljC8V9PhIEAUGjzseCqvhj4Qag7qwMgsyLgWEJYMAY2viymxI';
    
    console.log('🧪 Test de souscription AVEC VAPID key...');
    
    // Convertir la VAPID key en Uint8Array
    const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });
    
    if (subscription) {
      // Succès !
      await subscription.unsubscribe();
      
      return {
        test: 'Souscription avec VAPID',
        status: 'success',
        message: 'Souscription créée avec succès',
        details: {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          vapidKey: vapidKey.substring(0, 20) + '...'
        }
      };
    }
  } catch (error: any) {
    // Analyser l'erreur spécifique
    let errorAnalysis = 'Erreur inconnue';
    
    if (error.message.includes('push service error')) {
      errorAnalysis = 'Service Push non disponible (firewall, réseau, ou service down)';
    } else if (error.message.includes('invalid key')) {
      errorAnalysis = 'Clé VAPID invalide ou mal formatée';
    } else if (error.message.includes('permission')) {
      errorAnalysis = 'Permission refusée';
    }
    
    return {
      test: 'Souscription avec VAPID',
      status: 'error',
      message: errorAnalysis,
      details: {
        errorMessage: error.message,
        errorCode: error.code,
        vapidKey: vapidKey.substring(0, 20) + '...'
      }
    };
  }
  
  return {
    test: 'Souscription avec VAPID',
    status: 'error',
    message: 'Impossible de créer une souscription'
  };
};

/**
 * Teste la connectivité avec les serveurs FCM
 */
export const testFCMConnectivity = async (): Promise<DiagnosticResult> => {
  try {
    // Tester la connectivité avec les endpoints FCM
    const fcmEndpoints = [
      'https://fcmregistrations.googleapis.com',
      'https://fcm.googleapis.com'
    ];
    
    const results = await Promise.allSettled(
      fcmEndpoints.map(endpoint => 
        fetch(endpoint, { 
          method: 'HEAD',
          mode: 'no-cors' // Éviter les erreurs CORS
        })
      )
    );
    
    const allSuccessful = results.every(r => r.status === 'fulfilled');
    
    return {
      test: 'Connectivité FCM',
      status: allSuccessful ? 'success' : 'warning',
      message: allSuccessful ? 'Connexion OK' : 'Certains endpoints non accessibles',
      details: {
        endpoints: fcmEndpoints,
        results: results.map(r => r.status)
      }
    };
  } catch (error) {
    return {
      test: 'Connectivité FCM',
      status: 'error',
      message: 'Impossible de tester la connectivité',
      details: error
    };
  }
};

/**
 * Teste l'environnement du navigateur
 */
export const testBrowserEnvironment = (): DiagnosticResult => {
  const info: any = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    onLine: navigator.onLine,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    hardwareConcurrency: navigator.hardwareConcurrency
  };
  
  // Détecter le navigateur
  let browser = 'Inconnu';
  if (info.userAgent.includes('Chrome')) browser = 'Chrome';
  else if (info.userAgent.includes('Firefox')) browser = 'Firefox';
  else if (info.userAgent.includes('Safari')) browser = 'Safari';
  else if (info.userAgent.includes('Edge')) browser = 'Edge';
  
  // Détecter les problèmes potentiels
  const issues = [];
  if (!info.onLine) issues.push('Hors ligne');
  if (!info.cookieEnabled) issues.push('Cookies désactivés');
  if (info.doNotTrack === '1') issues.push('Do Not Track activé');
  
  return {
    test: 'Environnement navigateur',
    status: issues.length === 0 ? 'success' : 'warning',
    message: `${browser} - ${issues.length === 0 ? 'OK' : issues.join(', ')}`,
    details: info
  };
};

/**
 * Lance un diagnostic complet
 */
export const runCompleteDiagnostic = async (): Promise<DiagnosticResult[]> => {
  console.log('🔍 === DIAGNOSTIC COMPLET DES PUSH NOTIFICATIONS ===');
  
  const results: DiagnosticResult[] = [];
  
  // 1. Environnement navigateur
  results.push(testBrowserEnvironment());
  
  // 2. Configuration Firebase
  results.push(await testFirebaseConfig());
  
  // 3. API Push
  results.push(await testPushAPI());
  
  // 4. Connectivité FCM
  results.push(await testFCMConnectivity());
  
  // 5. Test sans VAPID
  results.push(await testPushSubscriptionWithoutVAPID());
  
  // 6. Test avec VAPID
  results.push(await testPushSubscriptionWithVAPID());
  
  // Afficher les résultats
  console.log('\n📊 RÉSULTATS DU DIAGNOSTIC:');
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : 
                  result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${result.test}: ${result.message}`);
    if (result.details) {
      console.log('   Détails:', result.details);
    }
  });
  
  // Recommandations basées sur les résultats
  console.log('\n💡 RECOMMANDATIONS:');
  
  const vapidError = results.find(r => r.test === 'Souscription avec VAPID' && r.status === 'error');
  const noVapidSuccess = results.find(r => r.test === 'Souscription sans VAPID' && r.status === 'warning');
  
  if (vapidError && noVapidSuccess) {
    console.log('⚠️ Le problème vient de la clé VAPID. Solutions:');
    console.log('   1. Régénérer la clé VAPID dans Firebase Console');
    console.log('   2. Vérifier que la clé correspond au projet Firebase');
  }
  
  if (vapidError && vapidError.message.includes('Service Push non disponible')) {
    console.log('⚠️ Problème de connectivité. Solutions:');
    console.log('   1. Vérifier le firewall/proxy');
    console.log('   2. Essayer sur un autre réseau');
    console.log('   3. Désactiver les extensions du navigateur');
  }
  
  return results;
};

/**
 * Convertit une clé VAPID base64 en Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Exposer dans la console
if (typeof window !== 'undefined') {
  (window as any).pushDiagnostic = {
    run: runCompleteDiagnostic,
    testFirebase: testFirebaseConfig,
    testPush: testPushAPI,
    testWithoutVAPID: testPushSubscriptionWithoutVAPID,
    testWithVAPID: testPushSubscriptionWithVAPID,
    testConnectivity: testFCMConnectivity,
    testBrowser: testBrowserEnvironment
  };
  
  console.log('🔍 Diagnostic Push chargé. Utilisez:');
  console.log('   pushDiagnostic.run() - Diagnostic complet');
  console.log('   pushDiagnostic.testWithVAPID() - Test avec VAPID');
  console.log('   pushDiagnostic.testWithoutVAPID() - Test sans VAPID');
}