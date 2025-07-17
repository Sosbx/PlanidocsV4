/**
 * Utilitaires pour gérer le Service Worker
 */

/**
 * Désinscrire tous les Service Workers existants
 */
export const unregisterAllServiceWorkers = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      console.log(`🧹 Désinstallation de ${registrations.length} Service Worker(s)...`);
      
      await Promise.all(
        registrations.map(registration => {
          console.log(`🗑️ Désinstallation de: ${registration.scope}`);
          return registration.unregister();
        })
      );
      
      console.log('✅ Tous les Service Workers ont été désinstallés');
    } catch (error) {
      console.error('❌ Erreur lors de la désinstallation des Service Workers:', error);
    }
  }
};

/**
 * Vider tous les caches
 */
export const clearAllCaches = async (): Promise<void> => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      
      console.log(`🧹 Suppression de ${cacheNames.length} cache(s)...`);
      
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`🗑️ Suppression du cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
      
      console.log('✅ Tous les caches ont été supprimés');
    } catch (error) {
      console.error('❌ Erreur lors de la suppression des caches:', error);
    }
  }
};

/**
 * Nettoyage complet : Service Workers + Caches
 */
export const cleanupServiceWorker = async (): Promise<void> => {
  console.log('🧼 Nettoyage complet du Service Worker...');
  
  await Promise.all([
    unregisterAllServiceWorkers(),
    clearAllCaches()
  ]);
  
  console.log('✅ Nettoyage terminé');
};

export default {
  unregisterAllServiceWorkers,
  clearAllCaches,
  cleanupServiceWorker
};