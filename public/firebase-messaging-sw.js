// Service worker pour Firebase Cloud Messaging
// Utilisation de la version 10.8.0 pour correspondre à la version de l'app
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialiser l'application Firebase avec les valeurs réelles du projet
firebase.initializeApp({
  apiKey: "AIzaSyC59Syrl04sY7E1zmJW_jFs1m5I7rHORB4",
  authDomain: "planego-696d3.firebaseapp.com",
  projectId: "planego-696d3",
  storageBucket: "planego-696d3.appspot.com",
  messagingSenderId: "688748545967",
  appId: "1:688748545967:web:1f241fc72beafe9ed3915a"
});

// Récupérer une instance de Firebase Messaging
const messaging = firebase.messaging();

// Gérer les messages en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('Message reçu en arrière-plan:', payload);
  
  // Extraire les informations de notification
  const notificationTitle = payload.notification.title || 'Nouvelle notification';
  const notificationOptions = {
    body: payload.notification.body || 'Vous avez reçu une nouvelle notification',
    icon: '/favicon.ico',
    badge: '/badge-icon.png',
    data: payload.data || {}
  };
  
  // Afficher la notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  // Fermer la notification
  event.notification.close();
  
  // Récupérer l'URL à ouvrir depuis les données de la notification
  const urlToOpen = event.notification.data?.link || '/';
  
  // Ouvrir l'URL dans une fenêtre existante si elle est déjà ouverte
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
