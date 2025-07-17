import { format } from 'date-fns';
import { formatParisDate } from '@/utils/timezoneUtils';
import { frLocale } from '../../../utils/dateLocale';

/**
 * Exporte le planning au format Excel
 * @param options Options d'exportation
 */
export const exportPlanningToExcel = (options: {
  userName: string;
  startDate: Date;
  endDate: Date;
  selections?: Record<string, any>;
  assignments?: Record<string, any>;
  desiderata?: Record<string, any>;
}) => {
  const { userName, startDate, endDate, selections = {}, assignments = {}, desiderata = {} } = options;
  
  // Afficher un message temporaire
  console.log('Exportation Excel en cours de développement');
  
  // Créer un élément temporaire pour afficher un message à l'utilisateur
  const messageElement = document.createElement('div');
  messageElement.style.position = 'fixed';
  messageElement.style.top = '20px';
  messageElement.style.left = '50%';
  messageElement.style.transform = 'translateX(-50%)';
  messageElement.style.padding = '10px 20px';
  messageElement.style.backgroundColor = 'rgba(16, 185, 129, 0.9)';
  messageElement.style.color = 'white';
  messageElement.style.borderRadius = '4px';
  messageElement.style.zIndex = '9999';
  messageElement.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
  messageElement.textContent = 'Fonctionnalité d\'exportation Excel en cours de développement';
  
  // Ajouter l'élément au DOM
  document.body.appendChild(messageElement);
  
  // Supprimer l'élément après 3 secondes
  setTimeout(() => {
    document.body.removeChild(messageElement);
  }, 3000);
  
  // Log des informations pour le développement
  console.log('Données pour l\'exportation Excel:', {
    userName,
    période: `${formatParisDate(startDate, 'dd/MM/yyyy', { locale: frLocale })} - ${formatParisDate(endDate, 'dd/MM/yyyy', { locale: frLocale })}`,
    nombreSélections: Object.keys(selections).length
  });
};
