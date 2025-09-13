/**
 * Utilitaire de réinitialisation complète du système de notifications
 * Permet de résoudre les problèmes de "push service error"
 */

import { createParisDate } from './timezoneUtils';

export interface ResetResult {
  success: boolean;
  steps: {
    name: string;
    success: boolean;
    error?: any;
  }[];
  message: string;
}

/**
 * Réinitialise complètement le système de notifications
 * @param userId ID de l'utilisateur (optionnel)
 * @returns Résultat de la réinitialisation
 */
export const resetNotificationSystem = async (userId?: string): Promise<ResetResult> => {
  console.log('🔄 === Début de la réinitialisation du système de notifications ===');
  
  const steps: ResetResult['steps'] = [];
  
  // Étape 1: Désinscrire tous les Service Workers
  try {
    console.log('📦 Étape 1: Désinscription des Service Workers...');
    
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`   ${registrations.length} Service Worker(s) trouvé(s)`);
      
      for (const registration of registrations) {
        console.log(`   Désinscription: ${registration.scope}`);
        await registration.unregister();
      }
      
      steps.push({
        name: 'Désinscription des Service Workers',
        success: true
      });
      console.log('   ✅ Service Workers désinscrits');
    } else {
      throw new Error('Service Workers non supportés');
    }
  } catch (error) {
    console.error('   ❌ Erreur lors de la désinscription:', error);
    steps.push({
      name: 'Désinscription des Service Workers',
      success: false,
      error
    });
  }
  
  // Étape 2: Nettoyer le cache du navigateur
  try {
    console.log('🗑️ Étape 2: Nettoyage du cache...');
    
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log(`   ${cacheNames.length} cache(s) trouvé(s)`);
      
      for (const cacheName of cacheNames) {
        if (cacheName.includes('planidocs') || cacheName.includes('firebase')) {
          console.log(`   Suppression du cache: ${cacheName}`);
          await caches.delete(cacheName);
        }
      }
      
      steps.push({
        name: 'Nettoyage du cache',
        success: true
      });
      console.log('   ✅ Cache nettoyé');
    }
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage du cache:', error);
    steps.push({
      name: 'Nettoyage du cache',
      success: false,
      error
    });
  }
  
  // Étape 3: Nettoyer le localStorage
  try {
    console.log('💾 Étape 3: Nettoyage du localStorage...');
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('fcm_token') || key.includes('notification'))) {
        keysToRemove.push(key);
      }
    }
    
    console.log(`   ${keysToRemove.length} clé(s) à supprimer`);
    keysToRemove.forEach(key => {
      console.log(`   Suppression: ${key}`);
      localStorage.removeItem(key);
    });
    
    steps.push({
      name: 'Nettoyage du localStorage',
      success: true
    });
    console.log('   ✅ localStorage nettoyé');
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage du localStorage:', error);
    steps.push({
      name: 'Nettoyage du localStorage',
      success: false,
      error
    });
  }
  
  // Étape 4: Nettoyer le sessionStorage
  try {
    console.log('💾 Étape 4: Nettoyage du sessionStorage...');
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('session') || key.includes('notification'))) {
        keysToRemove.push(key);
      }
    }
    
    console.log(`   ${keysToRemove.length} clé(s) à supprimer`);
    keysToRemove.forEach(key => {
      console.log(`   Suppression: ${key}`);
      sessionStorage.removeItem(key);
    });
    
    steps.push({
      name: 'Nettoyage du sessionStorage',
      success: true
    });
    console.log('   ✅ sessionStorage nettoyé');
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage du sessionStorage:', error);
    steps.push({
      name: 'Nettoyage du sessionStorage',
      success: false,
      error
    });
  }
  
  // Étape 5: Attendre un peu pour que tout soit bien nettoyé
  console.log('⏳ Étape 5: Attente de 2 secondes...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  steps.push({
    name: 'Attente de nettoyage',
    success: true
  });
  
  // Étape 6: Réenregistrer le Service Worker
  try {
    console.log('📦 Étape 6: Réenregistrement du Service Worker...');
    
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    
    console.log('   Service Worker enregistré, attente de l\'activation...');
    
    // Attendre l'activation
    await navigator.serviceWorker.ready;
    
    // Vérifier si actif
    if (registration.active) {
      steps.push({
        name: 'Réenregistrement du Service Worker',
        success: true
      });
      console.log('   ✅ Service Worker réenregistré et actif');
    } else {
      throw new Error('Service Worker non actif après enregistrement');
    }
  } catch (error) {
    console.error('   ❌ Erreur lors du réenregistrement:', error);
    steps.push({
      name: 'Réenregistrement du Service Worker',
      success: false,
      error
    });
  }
  
  // Générer le résultat final
  const allSuccess = steps.every(step => step.success);
  const message = allSuccess 
    ? '✅ Système de notifications réinitialisé avec succès. Veuillez recharger la page.'
    : '⚠️ Réinitialisation partielle. Certaines étapes ont échoué. Veuillez recharger la page et réessayer.';
  
  console.log('🔄 === Fin de la réinitialisation ===');
  console.log(message);
  
  // Sauvegarder un marqueur de réinitialisation
  localStorage.setItem('notification_reset_timestamp', createParisDate().toISOString());
  
  return {
    success: allSuccess,
    steps,
    message
  };
};

/**
 * Vérifie si une réinitialisation récente a été effectuée
 * @returns true si une réinitialisation a été faite dans les dernières 5 minutes
 */
export const hasRecentReset = (): boolean => {
  const resetTimestamp = localStorage.getItem('notification_reset_timestamp');
  if (!resetTimestamp) return false;
  
  const resetDate = new Date(resetTimestamp);
  const now = createParisDate();
  const diffMinutes = (now.getTime() - resetDate.getTime()) / (1000 * 60);
  
  return diffMinutes < 5;
};

/**
 * Force une mise à jour du Service Worker
 */
export const forceServiceWorkerUpdate = async (): Promise<boolean> => {
  console.log('🔄 Forçage de la mise à jour du Service Worker...');
  
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration) {
      await registration.update();
      console.log('✅ Mise à jour forcée du Service Worker');
      return true;
    } else {
      console.log('❌ Aucun Service Worker trouvé');
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour forcée:', error);
    return false;
  }
};

/**
 * Teste la communication avec le Service Worker
 */
export const testServiceWorkerCommunication = async (): Promise<boolean> => {
  console.log('🧪 Test de communication avec le Service Worker...');
  
  return new Promise((resolve) => {
    if (!navigator.serviceWorker.controller) {
      console.log('❌ Pas de Service Worker controller');
      resolve(false);
      return;
    }
    
    const channel = new MessageChannel();
    
    // Timeout après 3 secondes
    const timeout = setTimeout(() => {
      console.log('❌ Timeout - pas de réponse du Service Worker');
      resolve(false);
    }, 3000);
    
    // Écouter la réponse
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      console.log('✅ Réponse reçue du Service Worker:', event.data);
      resolve(true);
    };
    
    // Envoyer le message
    navigator.serviceWorker.controller.postMessage(
      { type: 'CHECK_SW_STATUS' },
      [channel.port2]
    );
  });
};

// Exposer les fonctions dans la console pour debug
if (typeof window !== 'undefined') {
  (window as any).notificationReset = {
    reset: resetNotificationSystem,
    hasRecentReset,
    forceUpdate: forceServiceWorkerUpdate,
    testCommunication: testServiceWorkerCommunication
  };
  
  console.log('🔧 Utilitaire de réinitialisation des notifications chargé');
  console.log('   Utilisez: notificationReset.reset() pour réinitialiser');
  console.log('   Utilisez: notificationReset.forceUpdate() pour forcer la mise à jour du SW');
  console.log('   Utilisez: notificationReset.testCommunication() pour tester la communication');
}