// Configuration pour l'API Google Calendar
// Si vous rencontrez des erreurs 403, vous pouvez avoir besoin d'une API Key

// 1. Aller dans Google Cloud Console
// 2. API et services > Identifiants
// 3. Créer des identifiants > Clé API
// 4. Restreindre la clé à Google Calendar API
// 5. Ajouter votre domaine dans les restrictions

// Décommentez et configurez si nécessaire :
// export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// Dans .env, ajoutez :
// VITE_GOOGLE_API_KEY="votre-cle-api"

// Puis dans googleCalendarService.ts, après l'initialisation :
// if (GOOGLE_API_KEY) {
//   window.gapi.client.setApiKey(GOOGLE_API_KEY);
// }