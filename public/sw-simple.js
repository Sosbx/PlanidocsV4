// Service Worker Simple pour Planidocs V4
// Version minimaliste pour éviter les erreurs

const CACHE_NAME = 'planidocs-simple-v1.0.0';

// Installation
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker Simple: Installation');
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker Simple: Activation');
  
  event.waitUntil(
    // Nettoyage des anciens caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('🗑️ Suppression cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      // Prendre le contrôle
      return self.clients.claim();
    })
  );
});

// Interception des requêtes - Version ultra-simple
self.addEventListener('fetch', (event) => {
  // Seulement pour les requêtes GET
  if (event.request.method !== 'GET') {
    return; // Laisser passer les POST, PUT, DELETE sans interception
  }
  
  // Exclure les URLs de développement
  if (event.request.url.includes('_vite') || 
      event.request.url.includes('hot-update') ||
      event.request.url.includes('sockjs-node')) {
    return;
  }
  
  // Stratégie simple : Network First avec fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la réponse est OK, on la retourne
        if (response.status === 200) {
          // Pas de mise en cache pour simplifier
          return response;
        }
        return response;
      })
      .catch(error => {
        console.warn('⚠️ Fetch failed:', event.request.url);
        
        // Pour les documents HTML, fallback vers la page principale
        if (event.request.destination === 'document') {
          return caches.match('/') || new Response('Application offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        }
        
        throw error;
      })
  );
});

console.log('🚀 Service Worker Simple chargé!');