// Service worker pour Firebase Cloud Messaging
// Version: 1.0.1 - Amélioration du cycle de vie et gestion d'erreurs

// Importer les scripts Firebase
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC59Syrl04sY7E1zmJW_jFs1m5I7rHORB4",
  authDomain: "planego-696d3.firebaseapp.com",
  projectId: "planego-696d3",
  storageBucket: "planego-696d3.appspot.com",
  messagingSenderId: "688748545967",
  appId: "1:688748545967:web:1f241fc72beafe9ed3915a"
};

// Version du Service Worker pour forcer les mises à jour
const SW_VERSION = '1.0.1';
const CACHE_NAME = `planidocs-cache-v${SW_VERSION}`;

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Récupérer une instance de Firebase Messaging
const messaging = firebase.messaging();

// Événement d'installation du Service Worker
self.addEventListener('install', (event) => {
  console.log(`[SW v${SW_VERSION}] Installation en cours...`);
  
  // Forcer l'activation immédiate du nouveau Service Worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`[SW v${SW_VERSION}] Cache créé: ${CACHE_NAME}`);
      // Pré-cacher les ressources essentielles
      return cache.addAll([
        '/',
        '/favicon.ico',
        '/badge-icon.png'
      ]).catch(err => {
        console.warn('[SW] Erreur lors du pré-cache (non critique):', err);
      });
    })
  );
});

// Événement d'activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log(`[SW v${SW_VERSION}] Activation en cours...`);
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('planidocs-cache-')) {
              console.log(`[SW v${SW_VERSION}] Suppression de l'ancien cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Prendre le contrôle immédiatement de tous les clients
      self.clients.claim().then(() => {
        console.log(`[SW v${SW_VERSION}] Contrôle des clients pris avec succès`);
      })
    ]).then(() => {
      console.log(`[SW v${SW_VERSION}] ✅ Service Worker activé et prêt`);
      // Envoyer un message aux clients pour confirmer l'activation
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: SW_VERSION
          });
        });
      });
    })
  );
});

// Gérer les erreurs de fetch
self.addEventListener('fetch', (event) => {
  // Ne pas interférer avec les requêtes Firebase
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }
  
  // Pour les autres requêtes, utiliser la stratégie network-first
  event.respondWith(
    fetch(event.request).catch(() => {
      // En cas d'erreur réseau, essayer le cache
      return caches.match(event.request);
    })
  );
});

// Gérer les messages en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Message reçu en arrière-plan:', payload);
  
  // Extraire les informations de notification
  const notificationTitle = payload.notification?.title || 'Nouvelle notification Planidocs';
  const notificationOptions = {
    body: payload.notification?.body || 'Vous avez reçu une nouvelle notification',
    icon: '/favicon.ico',
    badge: '/badge-icon.png',
    tag: `planidocs-${Date.now()}`,
    requireInteraction: false,
    data: payload.data || {},
    // Ajouter des actions si nécessaire
    actions: [
      {
        action: 'view',
        title: 'Voir'
      },
      {
        action: 'dismiss',
        title: 'Ignorer'
      }
    ]
  };
  
  // Afficher la notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Clic sur notification:', event.action);
  
  // Fermer la notification
  event.notification.close();
  
  // Si l'action est "dismiss", ne rien faire
  if (event.action === 'dismiss') {
    return;
  }
  
  // Récupérer l'URL à ouvrir depuis les données de la notification
  const urlToOpen = event.notification.data?.link || '/';
  
  // Ouvrir l'URL dans une fenêtre existante ou nouvelle
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then((clientList) => {
      // Chercher une fenêtre existante
      for (const client of clientList) {
        if (client.url.includes('localhost') || client.url.includes('planidocs')) {
          // Naviguer vers l'URL et focus
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      
      // Si aucune fenêtre trouvée, en ouvrir une nouvelle
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Gérer les messages du client principal
self.addEventListener('message', (event) => {
  console.log('[SW] Message reçu du client:', event.data);
  
  if (event.data && event.data.type === 'CHECK_SW_STATUS') {
    // Répondre avec le statut du Service Worker
    event.ports[0].postMessage({
      type: 'SW_STATUS',
      version: SW_VERSION,
      state: 'activated'
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Log pour confirmer que le Service Worker est chargé
console.log(`[SW v${SW_VERSION}] Firebase Messaging Service Worker chargé`);