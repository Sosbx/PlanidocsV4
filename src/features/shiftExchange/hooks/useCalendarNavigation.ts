import { useState, useEffect, useCallback, useRef } from 'react';
import { createParisDate, startOfMonthParis, endOfMonthParis, addMonthsParis, subMonthsParis } from '@/utils/timezoneUtils';
import { startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addDays, subDays, parseISO } from 'date-fns';
import { useSwipeDetection } from '../../../hooks/useSwipeDetection';

type ViewMode = 'list' | 'calendar';

interface CalendarNavigationResult {
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  calendarViewMode: 'month';
  setCalendarViewMode: (mode: any) => void;
  isMobile: boolean;
  isSmallScreen: boolean;
  calendarContainerRef: React.RefObject<HTMLDivElement>;
  goToPrevious: () => void;
  goToNext: () => void;
  getDaysToDisplay: () => Date[];
  initializeCalendarFromDateString: (dateString: string) => void;
}

/**
 * Hook pour gérer la navigation dans le calendrier de la bourse aux gardes
 * @param initialViewMode Mode d'affichage initial (liste ou calendrier)
 * @returns Fonctions et états pour la navigation dans le calendrier
 */
export const useCalendarNavigation = (initialViewMode: ViewMode = 'list'): CalendarNavigationResult => {
  // État de navigation du calendrier - sera initialisé correctement plus tard
  const [currentMonth, setCurrentMonth] = useState<Date>(() => createParisDate());
  
  // Pour suivre si c'est le premier chargement de données et si le mois a été défini manuellement
  const hasBeenManuallySet = useRef(false);
  
  // États pour le responsive
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(false);
  // Toujours en mode mois
  const [calendarViewMode] = useState<'month'>('month');
  
  // Refs
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  
  // Fonctions de navigation du calendrier - uniquement mode mois
  const goToPrevious = useCallback(() => {
    // En mode mois, reculer d'un mois
    setCurrentMonth(prevMonth => subMonthsParis(prevMonth, 1));
  }, []);
  
  const goToNext = useCallback(() => {
    // En mode mois, avancer d'un mois
    setCurrentMonth(prevMonth => addMonthsParis(prevMonth, 1));
  }, []);
  
  // Utiliser le hook de détection de swipe
  useSwipeDetection(calendarContainerRef, (direction) => {
    if (direction === 'left') {
      goToNext();
    } else if (direction === 'right') {
      goToPrevious();
    }
  }, {
    threshold: 50,  // Réduire le seuil pour faciliter le swipe
    restraint: 150, // Augmenter la tolérance pour les mouvements verticaux
    allowedTime: 500 // Augmenter le temps autorisé pour le swipe
  });
  
  // Fonction pour obtenir les jours à afficher
  const getDaysToDisplay = useCallback(() => {
    try {
      // Mode mois uniquement
      const start = startOfMonthParis(currentMonth);
      const end = endOfMonthParis(currentMonth);
      
      // Ajuster pour commencer par un lundi
      // Calculer le décalage pour démarrer au lundi
      const dayOfWeek = start.getDay(); // 0 = dimanche, 1 = lundi, etc.
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Si dimanche, reculer de 6 jours pour atteindre lundi, sinon décaler pour lundi
      
      // Premier jour = lundi de la semaine où commence le mois
      const firstDayToDisplay = subDays(start, daysToSubtract);
      
      // Calculer le nombre de jours à ajouter pour compléter les semaines entières
      // Obtenir le jour de la semaine du dernier jour du mois (0 = dimanche, 1 = lundi, etc.)
      const lastDayOfWeek = end.getDay();
      // Si c'est un dimanche (0), ne rien ajouter, sinon ajouter pour atteindre dimanche (7 - day)
      const daysToAdd = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
      
      // Dernier jour = dimanche de la semaine où finit le mois
      const lastDayToDisplay = addDays(end, daysToAdd);
      
      // Générer tous les jours à afficher
      const days = eachDayOfInterval({ start: firstDayToDisplay, end: lastDayToDisplay });
      return days;
    } catch (error) {
      console.error("Erreur dans getDaysToDisplay:", error);
      // Fallback à un tableau vide
      return [];
    }
  }, [currentMonth]);

  // useEffect pour détecter la taille de l'écran
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 640); // Mobile: < 640px (sm breakpoint)
      setIsSmallScreen(window.innerWidth < 768); // Small screens: < 768px (md breakpoint)
    };
    
    // Vérifier la taille initiale
    checkScreenSize();
    
    // Écouter les changements de taille d'écran
    window.addEventListener('resize', checkScreenSize);
    
    // Nettoyer l'écouteur au démontage
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Mise à jour de currentMonth lorsqu'une nouvelle date est sélectionnée
  const setCurrentMonthFromDate = (date: Date) => {
    // Marquer que le mois a été défini manuellement pour éviter les réinitialisations
    hasBeenManuallySet.current = true;
    setCurrentMonth(date);
  };

  // Fonction pour initialiser le calendrier à partir d'une date au format string
  const initializeCalendarFromDateString = (dateString: string) => {
    if (!dateString || hasBeenManuallySet.current) return;
    
    try {
      // Convertir la chaîne de date en objet Date
      const date = parseISO(dateString);
      console.log("Initialisation du calendrier à la date:", date);
      
      // Définir le mois courant à partir de cette date
      setCurrentMonth(date);
    } catch (error) {
      console.error("Erreur lors de l'initialisation du calendrier:", error);
    }
  };

  return {
    currentMonth,
    setCurrentMonth: setCurrentMonthFromDate,
    calendarViewMode,
    // Fonction setCalendarViewMode conservée pour compatibilité mais ne fait rien
    setCalendarViewMode: () => {},
    isMobile,
    isSmallScreen,
    calendarContainerRef,
    goToPrevious,
    goToNext,
    getDaysToDisplay,
    // Exposer la fonction d'initialisation
    initializeCalendarFromDateString
  };
};

export default useCalendarNavigation;
