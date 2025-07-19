// Configuration pour l'API Google Calendar
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Configuration du calendrier dédié PlaniDocs
export const PLANIDOCS_CALENDAR_NAME = 'Gardes-SOS';
export const PLANIDOCS_CALENDAR_DESCRIPTION = 'Calendrier des gardes synchronisées depuis PlaniDocs';
export const PLANIDOCS_CALENDAR_COLOR = '#4285F4'; // Bleu Google

// Configuration des propriétés étendues pour identifier les événements PlaniDocs
export const PLANIDOCS_EVENT_PROPERTIES = {
  source: 'planidocs',
  version: '1.0'
} as const;

// Couleur des événements dans Google Calendar (bleu médical)
export const PLANIDOCS_EVENT_COLOR_ID = '9';