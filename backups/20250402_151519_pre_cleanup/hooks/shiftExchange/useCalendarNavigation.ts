import { useState, useEffect, useCallback, useRef } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addDays, subDays, parseISO } from 'date-fns';
import { useSwipeDetection } from '../../hooks/useSwipeDetection';

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

export const useCalendarNavigation = (initialViewMode: ViewMode = 'list'): CalendarNavigationResult => {
  // État de navigation du calendrier - sera initialisé correctement plus tard
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  
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
    setCurrentMonth(prevMonth => subMonths(prevMonth, 1));
  }, []);
  
  const goToNext = useCallback(() => {
    // En mode mois, avancer d'un mois
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
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
      // Mode mois uniquement avec inclusion du dernier jour du mois précédent
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      // Calculer le premier jour à afficher - toujours le dernier jour du mois précédent
      const firstDayToDisplay = subDays(start, 1);
      
      // Calculer le dernier jour à afficher - inclure le premier jour du mois suivant
      const lastDayToDisplay = addDays(end, 1);
      
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
