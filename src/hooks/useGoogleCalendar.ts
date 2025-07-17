import { useGoogleCalendarContext } from '../context/googleCalendar/GoogleCalendarContext';

// Hook simplifié qui utilise le contexte
export const useGoogleCalendar = () => {
  return useGoogleCalendarContext();
};