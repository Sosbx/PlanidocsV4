// Service Worker principal pour Planidocs V4
// Gestion du cache, optimisations performance et support offline

const CACHE_VERSION = 'planidocs-v1.2.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Ressources critiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico'
];

// URLs API Firebase à mettre en cache avec stratégie réseau d'abord
const API_PATTERNS = [
  /firestore\.googleapis\.com/,
  /firebase\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/
];

// URLs à exclure du cache
const EXCLUDE_PATTERNS = [
  /chrome-extension/,
  /extension/,
  /_vite/,
  /hot-update/,
  /sockjs-node/,
  /\.hot-update\./
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: Installation en cours...');
  
  event.waitUntil(
    Promise.resolve()
      .then(() => {
        console.log('✅ Service Worker: Installation terminée avec succès');
        // Forcer l'activation immédiate
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Erreur lors de l\'installation', error);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activation en cours...');
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      cleanupOldCaches(),
      // Prendre le contrôle de tous les clients
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker: Activation terminée, contrôle des clients pris');
    })
  );
});

// Nettoyage des anciens caches
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  
  const deletePromises = cacheNames
    .filter(cacheName => !validCaches.includes(cacheName))
    .map(cacheName => {
      console.log(`🗑️ Service Worker: Suppression de l'ancien cache ${cacheName}`);
      return caches.delete(cacheName);
    });
  
  return Promise.all(deletePromises);
}

// Vérifier si une URL doit être exclue du cache
function shouldExcludeFromCache(url) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(url));
}

// Vérifier si une URL est une requête API
function isApiRequest(url) {
  return API_PATTERNS.some(pattern => pattern.test(url));
}

// Stratégie Cache First - pour les ressources statiques
async function cacheFirstStrategy(event) {
  try {
    const cachedResponse = await caches.match(event.request);
    
    if (cachedResponse) {
      // Retourner immédiatement la version en cache
      return cachedResponse;
    }
    
    // Si pas en cache, récupérer du réseau et mettre en cache
    const networkResponse = await fetch(event.request);
    
    if (networkResponse.status === 200 && event.request.method === 'GET') {
      const cache = await caches.open(STATIC_CACHE);
      // Clone la réponse avant de la mettre en cache
      cache.put(event.request, networkResponse.clone()).catch(err => {
        console.warn('⚠️ Cache put failed:', err);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Service Worker: Impossible de récupérer', event.request.url, error);
    
    // Retourner une réponse offline pour les pages HTML
    if (event.request.destination === 'document') {
      return caches.match('/') || new Response('Application offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
    
    throw error;
  }
}

// Stratégie Network First - pour les données dynamiques et API
async function networkFirstStrategy(event) {
  try {
    const networkResponse = await fetch(event.request);
    
    // Mettre à jour le cache avec la nouvelle réponse
    // IMPORTANT: Ne pas cacher les méthodes autres que GET
    if (networkResponse.status === 200 && event.request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      
      // Limiter la taille du cache dynamique
      await limitCacheSize(cache, 50);
      
      // Clone et cache de manière sécurisée
      cache.put(event.request, networkResponse.clone()).catch(err => {
        console.warn('⚠️ Dynamic cache put failed:', err);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Service Worker: Réseau indisponible, utilisation du cache', event.request.url);
    
    // Fallback sur le cache en cas d'échec réseau
    // Seulement pour les requêtes GET
    if (event.request.method === 'GET') {
      const cachedResponse = await caches.match(event.request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Si pas en cache non plus, retourner une erreur appropriée
    if (event.request.destination === 'document') {
      return caches.match('/') || new Response('Application offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
    
    throw error;
  }
}

// Limiter la taille d'un cache
async function limitCacheSize(cache, maxSize) {
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    // Supprimer les plus anciennes entrées
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Ignorer les requêtes non-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Ignorer les URLs à exclure
  if (shouldExcludeFromCache(request.url)) {
    return;
  }
  
  // Les requêtes non-GET doivent passer directement au réseau
  if (request.method !== 'GET') {
    // Pas de cache pour POST, PUT, DELETE, etc.
    event.respondWith(fetch(request));
    return;
  }
  
  // Déterminer la stratégie appropriée pour les requêtes GET uniquement
  let strategy;
  
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image') {
    // Cache first pour les ressources statiques
    strategy = cacheFirstStrategy;
  } else {
    // Network first pour tout le reste (APIs, etc.)
    strategy = networkFirstStrategy;
  }
  
  event.respondWith(strategy(event));
});

// Gestion des messages du client
self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (data && data.type === 'SKIP_WAITING') {
    console.log('📨 Service Worker: Demande de skip waiting reçue');
    self.skipWaiting();
  }
  
  if (data && data.type === 'GET_CACHE_INFO') {
    getCacheInfo().then(info => {
      event.ports[0].postMessage(info);
    });
  }
  
  if (data && data.type === 'CLEAR_CACHE') {
    clearAllCaches().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Obtenir des informations sur le cache
async function getCacheInfo() {
  const cacheNames = await caches.keys();
  const info = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    info[cacheName] = keys.length;
  }
  
  return info;
}

// Vider tous les caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
}

// Gestion des erreurs globales
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker: Erreur globale', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker: Promesse rejetée non gérée', event.reason);
});

console.log('🚀 Service Worker Planidocs V4 chargé et prêt!');