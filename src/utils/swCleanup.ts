/**
 * Utilitaire pour nettoyer les Service Workers problématiques
 */

export const cleanupAndRegisterSimpleServiceWorker = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker non supporté');
    return;
  }

  try {
    console.log('🧹 Nettoyage des Service Workers existants...');
    
    // 1. Désinscrire tous les Service Workers existants
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(registration => {
        console.log('🗑️ Désinscription:', registration.scope);
        return registration.unregister();
      })
    );

    // 2. Vider tous les caches
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => {
        console.log('🗑️ Suppression cache:', cacheName);
        return caches.delete(cacheName);
      })
    );

    console.log('✅ Nettoyage terminé');

    // 3. Attendre un peu puis enregistrer le nouveau SW simple
    setTimeout(async () => {
      try {
        console.log('📦 Enregistrement du Service Worker simple...');
        
        const registration = await navigator.serviceWorker.register('/sw-simple.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        
        console.log('✅ Service Worker simple enregistré:', registration);
        
        // Forcer l'activation
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
      } catch (error) {
        console.error('❌ Erreur enregistrement SW simple:', error);
      }
    }, 1000);

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  }
};

// Auto-exécution en développement
if (process.env.NODE_ENV === 'development') {
  // Exécuter seulement si on détecte des erreurs SW
  const hasSwErrors = sessionStorage.getItem('sw-errors');
  if (hasSwErrors) {
    cleanupAndRegisterSimpleServiceWorker();
    sessionStorage.removeItem('sw-errors');
  }
}