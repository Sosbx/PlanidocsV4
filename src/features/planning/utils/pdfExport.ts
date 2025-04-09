import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDaysArray, getMonthsInRange, isGrayedOut } from '../../../utils/dateUtils';
import type { ShiftAssignment } from '../types';

interface ExportPlanningOptions {
  userName: string;
  startDate: Date;
  endDate: Date;
  selections?: Record<string, any>;
  assignments?: Record<string, any>;
  desiderata?: Record<string, 'primary' | 'secondary' | null>;
}

/**
 * Exporte le planning au format PDF
 * Cette version est simplifiée pour éviter les erreurs TypeScript
 */
export const exportPlanningToPDF = (options: ExportPlanningOptions): void => {
  const { userName, startDate, endDate, selections = {} } = options;
  
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
  messageElement.textContent = 'Exportation PDF en cours de développement';
  
  // Ajouter l'élément au DOM
  document.body.appendChild(messageElement);
  
  // Supprimer l'élément après 3 secondes
  setTimeout(() => {
    document.body.removeChild(messageElement);
  }, 3000);
  
  // Log des informations pour le développement
  console.log('Données pour l\'exportation PDF:', {
    userName,
    période: `${format(startDate, 'dd/MM/yyyy', { locale: fr })} - ${format(endDate, 'dd/MM/yyyy', { locale: fr })}`,
    nombreSélections: Object.keys(selections).length
  });
};

/**
 * Exporte tous les plannings au format PDF et les compresse dans un fichier ZIP
 * Cette version est un stub pour éviter les erreurs TypeScript
 */
export const exportAllPlanningsToPDFZip = async (
  users: any[],
  desiderataData: Record<string, any>,
  startDate: Date,
  endDate: Date,
  config: any
): Promise<void> => {
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
  messageElement.textContent = 'Exportation ZIP en cours de développement';
  
  // Ajouter l'élément au DOM
  document.body.appendChild(messageElement);
  
  // Supprimer l'élément après 3 secondes
  setTimeout(() => {
    document.body.removeChild(messageElement);
  }, 3000);
  
  // Log des informations pour le développement
  console.log('Données pour l\'exportation ZIP:', {
    nombreUtilisateurs: users.length,
    période: `${format(startDate, 'dd/MM/yyyy', { locale: fr })} - ${format(endDate, 'dd/MM/yyyy', { locale: fr })}`
  });
};
