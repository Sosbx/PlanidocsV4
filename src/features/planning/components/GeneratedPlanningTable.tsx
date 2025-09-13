import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { getDaysInMonth, format } from 'date-fns';
import { getMonthsInRange, isGrayedOut } from '../../../utils/dateUtils';
import {
  createDate,
  parseCellKey,
  isPastDate,
  formatDate,
  formatDateAs,
  formatDateCapitalized,
  getMonthYearDisplay,
  normalizeDateString,
  DATE_FORMATS,
  CONTEXT_FORMATS,
  frLocale,
  type Period
} from '../../../utils/dates';
import type { ShiftAssignment, Selections, ShiftReplacement } from '../types';
import type { ShiftExchange } from '../../../types/exchange';
import { getAllDesiderata } from '../../../lib/firebase/desiderata';
import { useBagPhase } from '../../../features/shiftExchange/hooks';
import { usePlanningPeriod } from '../../../context/planning';
import { useAssociation } from '../../../context/association/AssociationContext';
import { addShiftExchange, removeShiftExchange, subscribeToShiftExchanges } from '../../../lib/firebase/exchange';
import { getReplacementsForUser } from '../../../lib/firebase/replacements';
import { CommentModal } from '../../../components/modals';
import { Portal } from '../../../components';
import { ExchangeModal } from '../../../features/directExchange/components';
import { useAuth } from '../../../features/auth/hooks';
import { useDirectExchange, useExchangeModal } from '../../../features/directExchange/hooks';
import { useToastContext } from '../../../context/toast';
import { useFeatureFlags } from '../../../context/featureFlags/FeatureFlagsContext';
import { FEATURES } from '../../../types/featureFlags';
import { Badge } from '../../../components/common';
import { OperationType } from '../../../types/exchange';
import VirtualizedMonthList from '../../../components/VirtualizedMonthList';
import useConsolidatedExchanges from '../../../hooks/useConsolidatedExchanges';
import { getCellBackgroundClass } from '../../../utils/cellColorUtils';
import PlanningGridCell from '../../../components/PlanningGridCell';
import { invalidateAllExchangeDataCache } from '../../../features/directExchange/utils';
import { useReplacements } from '../../../features/shiftExchange/hooks/useReplacements';

// Importer les styles pour les couleurs des opérations
import '../../../styles/OperationColors.css';

interface GeneratedPlanningTableProps {
  startDate: Date;
  endDate: Date;
  assignments: Record<string, ShiftAssignment>;
  userId?: string;
  showDesiderata?: boolean;
  desiderata?: Selections;
  receivedShifts?: Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>;
  isAdminView?: boolean;
  viewMode?: 'multiColumn' | 'singleColumn';
  todayRef?: React.RefObject<HTMLDivElement>;
  isFirstDayOfBagPeriod?: (date: Date) => boolean;
  onLoadPreviousMonth?: () => void;
  onLoadNextMonth?: () => void;
}

const GeneratedPlanningTable: React.FC<GeneratedPlanningTableProps> = ({
  startDate,
  endDate,
  assignments,
  userId,
  showDesiderata = false,
  desiderata: desiderataProps,
  receivedShifts = {},
  isAdminView = false,
  viewMode = 'multiColumn',
  todayRef,
  isFirstDayOfBagPeriod,
  onLoadPreviousMonth,
  onLoadNextMonth
}) => {
  const months = getMonthsInRange(startDate, endDate);
  const { user } = useAuth();
  const { config: bagPhaseConfig } = useBagPhase();
  const { isInCurrentPeriod, allPeriods } = usePlanningPeriod();
  const { currentAssociation } = useAssociation();
  const { featureFlags, isFeatureEnabled } = useFeatureFlags();
  const isDirectExchangeModalEnabled = isFeatureEnabled(FEATURES.DIRECT_EXCHANGE_MODAL);
  const lastViewModeRef = useRef(viewMode);
  
  // Mise à jour du viewMode
  useEffect(() => {
    // Mémoriser le nouveau mode de vue
    if (lastViewModeRef.current !== viewMode) {
      console.log("GeneratedPlanningTable: Changement de viewMode détecté", lastViewModeRef.current, "->", viewMode);
      lastViewModeRef.current = viewMode;
    }
  }, [viewMode]);
  const [selectedCell, setSelectedCell] = useState<{
    key: string;
    position: { x: number; y: number };
    assignment: ShiftAssignment;
  } | null>(null);
  // D'abord obtenir removeExchange depuis useDirectExchange
  const { proposeDirectExchange, proposeDirectCession, proposeDirectReplacement, removeExchange } = useDirectExchange({
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });
  
  // Créer une référence pour refreshDirectExchanges qui sera mise à jour plus tard
  const refreshDirectExchangesRef = useRef<(() => Promise<void>) | null>(null);
  
  // Utiliser le hook unifié pour gérer le modal d'échange
  const {
    selectedCell: selectedDirectExchangeCell,
    setSelectedCell: setSelectedDirectExchangeCell,
    handleSubmit: handleExchangeModalSubmit,
    handleRemove,
    isProcessing
  } = useExchangeModal(user?.id, {
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error'),
    refreshData: async () => {
      // Utiliser la référence qui sera mise à jour
      if (refreshDirectExchangesRef.current) {
        await refreshDirectExchangesRef.current();
      }
    },
    removeExchange
  });
  const [desiderataState, setDesiderataState] = useState<Selections>({});
  // Utiliser les desiderata passés en props s'ils sont fournis, sinon utiliser l'état local
  const desiderata = desiderataProps || desiderataState;
  const [exchanges, setExchanges] = useState<Record<string, ShiftExchange>>({});
  // Ajouter un état pour les échanges directs
  const [directExchanges, setDirectExchanges] = useState<Record<string, ShiftExchange>>({});
  const [replacements, setReplacements] = useState<Record<string, ShiftReplacement>>({});
  const { showToast } = useToastContext();
  
  // Récupérer les IDs des échanges pour les remplacements validés
  const replacementExchangeIds = useMemo(() => {
    const ids = Object.values(replacements)
      .map(r => r.exchangeId)
      .filter(Boolean);
    console.log('GeneratedPlanningTable - replacementExchangeIds extraits:', ids);
    console.log('GeneratedPlanningTable - replacements complets:', replacements);
    return ids;
  }, [replacements]);
  
  // Utiliser le hook pour récupérer les remplacements validés
  const { replacements: assignedReplacements } = useReplacements(replacementExchangeIds);
  
  // Debug: log les remplacements assignés
  useEffect(() => {
    if (Object.keys(assignedReplacements).length > 0) {
      console.log('Remplacements assignés trouvés:', assignedReplacements);
      console.log('Remplacements locaux:', replacements);
    }
  }, [assignedReplacements, replacements]);

  // Fonction pour trouver la date de début de la bourse aux gardes
  const findBagStartDate = useCallback(() => {
    // Chercher la période future (BAG)
    const bagPeriod = allPeriods.find(p => p.status === 'future');
    if (!bagPeriod) {
      console.log("Aucune période BAG (future) trouvée");
      // Par défaut, utiliser la date actuelle si aucune période future n'est trouvée
      return createParisDate();
    }
    
    // Retourner la date de début de la période BAG
    return bagPeriod.startDate;
  }, [allPeriods]);

  // Fonction pour déterminer si un jour est le premier jour d'une période BAG
  const isFirstDayOfBagPeriodInternal = useCallback((date: Date) => {
    // Trouver la période future (BAG)
    const bagPeriod = allPeriods.find(p => p.status === 'future');
    if (!bagPeriod) {
      console.log("Aucune période BAG (future) trouvée");
      return false;
    }
    
    // Vérifier si c'est le premier jour de la période BAG
    const dateStr = normalizeDateString(date);
    const bagStartStr = normalizeDateString(bagPeriod.startDate);
    
    const isBagStart = dateStr === bagStartStr;
    
    // Log pour débogage - uniquement si c'est le premier jour
    if (isBagStart) {
      console.log(`Jour de début de BAG détecté: ${dateStr}`);
    }
    
    return isBagStart;
  }, [allPeriods]);

  // Fonction pour convertir les échanges en un objet avec les clés au format "YYYY-MM-DD-PERIOD"
  const convertExchangesToMap = useCallback((exchanges: ShiftExchange[], filterUserId?: string) => {
    console.log("Conversion des échanges en map. Nombre d'échanges:", exchanges.length, "filterUserId:", filterUserId);
    
    // Log détaillé des échanges à convertir
    exchanges.forEach(exchange => {
      console.log(`Échange à convertir: id=${exchange.id}, date=${exchange.date}, period=${exchange.period}, type=${exchange.exchangeType}, operationTypes=${exchange.operationTypes?.join(',')}, userId=${exchange.userId}`);
    });
    
    const result = exchanges.reduce((acc, exchange) => {
      if (!exchange.date || !exchange.period) {
        console.warn("Échange sans date ou période:", exchange);
        return acc;
      }
      
      // Si filterUserId est fourni, ne garder que les échanges de cet utilisateur
      if (filterUserId && exchange.userId !== filterUserId) {
        return acc;
      }
      
      // Clé unique pour chaque échange
      const key = `${exchange.date}-${exchange.period}`;
      console.log(`Traitement de l'échange avec clé ${key}:`, exchange);
      
      // Vérifier si une entrée existe déjà pour cette clé
      if (acc[key]) {
        console.warn(`Conflit détecté pour la clé ${key}. Deux échanges trouvés:`, {
          existing: acc[key],
          new: exchange
        });
        
        // Privilégier l'échange direct sur l'échange de la bourse aux gardes
        if (exchange.exchangeType === 'direct' && acc[key].exchangeType !== 'direct') {
          console.log(`Remplacement de l'échange de type ${acc[key].exchangeType} par l'échange direct`);
          acc[key] = exchange;
        } else {
          console.log(`Conservation de l'échange existant de type ${acc[key].exchangeType}`); 
        }
      } else {
        // Pas de conflit, ajouter l'échange
        console.log(`Ajout de l'échange avec clé ${key} à la map`);
        acc[key] = exchange;
      }
      
      return acc;
    }, {} as Record<string, ShiftExchange>);
    
    console.log("Résultat de la conversion en map:", Object.keys(result).length, result);
    return result;
  }, []);

  // S'abonner aux changements en temps réel des gardes proposées à l'échange (bourse aux gardes)
  useEffect(() => {
    // S'abonner aux changements en temps réel de la bourse aux gardes
    const unsubscribe = subscribeToShiftExchanges((exchangeItems) => {
      // Cast des échanges au type ShiftExchange de types/exchange.ts
      const typedExchangeItems = exchangeItems as unknown as ShiftExchange[];
      // Filtrer pour ne garder que les échanges de l'utilisateur connecté
      const exchangesMap = convertExchangesToMap(typedExchangeItems, userId || undefined);
      setExchanges(exchangesMap);
    });

    // Se désabonner lorsque le composant est démonté
    return () => {
      unsubscribe();
    };
  }, [convertExchangesToMap, userId]);
  
  // Fonction pour rafraîchir manuellement les échanges directs et remplacements
  const refreshDirectExchanges = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log("Rafraîchissement manuel des échanges directs et remplacements...");
      
      // Récupérer tous les échanges directs
      const { getDirectExchanges } = await import('../../../lib/firebase/directExchange');
      const allDirectExchanges = await getDirectExchanges();
      
      // Filtrer pour ne garder que ceux de l'utilisateur courant
      const userExchanges = allDirectExchanges.filter(ex => ex.userId === user.id);
      console.log("Échanges directs rafraîchis. Trouvés:", userExchanges.length);
      
      // Log détaillé des échanges directs trouvés
      userExchanges.forEach(ex => {
        console.log(`Échange direct: date=${ex.date}, period=${ex.period}, operationTypes=${ex.operationTypes?.join(',')}`, ex);
      });
      
      // Convertir en map
      const directExchangesMap = convertExchangesToMap(userExchanges);
      console.log("Échanges directs convertis en map:", Object.keys(directExchangesMap).length, directExchangesMap);
      setDirectExchanges(directExchangesMap);
      
      // Rafraîchir également les remplacements
      console.log("Rafraîchissement des remplacements...");
      const remplacementsData = await getReplacementsForUser(user.id);
      
      // Convertir les remplacements en un objet avec les clés au format "YYYY-MM-DD-PERIOD"
      const replacementsMap = remplacementsData.reduce((acc, replacement) => {
        acc[`${replacement.date}-${replacement.period}`] = replacement;
        return acc;
      }, {} as Record<string, ShiftReplacement>);
      
      console.log("Remplacements rafraîchis. Trouvés:", remplacementsData.length);
      setReplacements(replacementsMap);
    } catch (error) {
      console.error("Erreur lors du rafraîchissement des échanges et remplacements:", error);
    }
  }, [user, convertExchangesToMap]);
  
  // Mettre à jour la référence
  useEffect(() => {
    refreshDirectExchangesRef.current = refreshDirectExchanges;
  }, [refreshDirectExchanges]);
  
  // S'abonner aux changements en temps réel des échanges directs
  useEffect(() => {
    if (!user) return () => {};
    
    // Rafraîchir immédiatement au chargement
    refreshDirectExchanges();
    
    // Importer la fonction pour s'abonner aux échanges directs
    const subscribeToDirectExchangesForUser = async () => {
      try {
        // Import dynamique pour éviter les dépendances circulaires
        const { subscribeToDirectExchanges } = await import('../../../lib/firebase/directExchange/core');
        
        // S'abonner aux changements en temps réel des échanges directs
        return subscribeToDirectExchanges((directExchangeItems) => {
          console.log("Échanges directs reçus:", directExchangeItems.length);
          
          // Filtrer les échanges pour ne garder que ceux de l'utilisateur courant
          const userExchanges = directExchangeItems.filter(ex => ex.userId === user.id);
          console.log("Échanges directs de l'utilisateur:", userExchanges.length, 
                      "Types d'opération:", userExchanges.map(ex => ({ 
                        id: ex.id, 
                        date: ex.date, 
                        period: ex.period, 
                        opTypes: ex.operationTypes 
                      })));
          
          // Convertir les échanges directs en un objet avec les clés au format "YYYY-MM-DD-PERIOD"
          const directExchangesMap = convertExchangesToMap(userExchanges);
          
          // Mettre à jour l'état
          setDirectExchanges(directExchangesMap);
        });
      } catch (error) {
        console.error("Erreur lors de l'abonnement aux échanges directs:", error);
        return () => {};
      }
    };
    
    // Appeler la fonction asynchrone
    let unsubscribe = () => {};
    subscribeToDirectExchangesForUser().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });
    
    // Se désabonner lorsque le composant est démonté
    return () => {
      unsubscribe();
    };
  }, [user, refreshDirectExchanges, convertExchangesToMap]);

  // Charger les remplacements proposés
  useEffect(() => {
    if (!user) return;

    const loadReplacements = async () => {
      try {
        const data = await getReplacementsForUser(user.id);
        // Convertir les remplacements en un objet avec les clés au format "YYYY-MM-DD-PERIOD"
        const replacementsMap = data.reduce((acc, replacement) => {
          acc[`${replacement.date}-${replacement.period}`] = replacement;
          return acc;
        }, {} as Record<string, ShiftReplacement>);
        setReplacements(replacementsMap);
      } catch (error) {
        console.error('Error loading replacements:', error);
      }
    };

    loadReplacements();
  }, [user]);

  // Fonction pour vérifier si une période spécifique à une date a été importée avec bagEnabled=false
  const isPeriodWithoutBag = useCallback((dateObj: Date) => {
    // Si allPeriods n'est pas disponible ou vide, retourner false
    if (!allPeriods || allPeriods.length === 0) {
      return false;
    }
    
    // Chercher la période couvrant cette date
    const matchingPeriod = allPeriods.find(period => {
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      
      // Vérifier si la date est dans cette période
      return dateObj >= startDate && dateObj <= endDate;
    });
    
    // Si on a trouvé une période, vérifier son statut et sa phase BAG
    if (matchingPeriod) {
      console.log(`Période trouvée pour ${dateObj.toISOString()}: ${matchingPeriod.name}, status=${matchingPeriod.status}, bagPhase=${matchingPeriod.bagPhase}`);
      
      // Une période importée sans BAG aura soit:
      // - status = 'active' (pour les imports directs avec bagEnabled=false)
      // - status quelconque + bagPhase = 'completed'
      return (
        matchingPeriod.status === 'active' || 
        matchingPeriod.bagPhase === 'completed'
      );
    }
    
    return false;
  }, [allPeriods]);

  const handleCellClick = useCallback((event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => {
    if (!assignment) return;
    
    // Extraire la date et la période du cellKey
    const cellData = parseCellKey(cellKey);
    if (!cellData) {
      console.error('Invalid cell key:', cellKey);
      return;
    }
    
    const { date: formattedDate, period } = cellData;
    const dateObj = createDate(formattedDate);
    
    // Vérifier si la date est dans le passé
    const isInPast = isPastDate(dateObj);
    
    // Si la date est dans le passé, désactiver l'interaction
    if (isInPast) {
      showToast('Les gardes passées ne peuvent pas être modifiées.', 'info');
      return;
    }
    
    // Vérifier si la date est dans la période courante
    const isCurrentPeriodDate = isInCurrentPeriod(dateObj);
    
    // Vérifier si la date est après ou égale au début de la bourse aux gardes
    // Si isFirstDayOfBagPeriod n'est pas fourni, considérer que toutes les dates sont après la bourse
    const bagStartDate = findBagStartDate();
    const isAfterBagStart = isFirstDayOfBagPeriod ? dateObj >= bagStartDate : true;
    
    // Vérifier spécifiquement si c'est le premier jour de la BaG
    const isFirstDayOfBag = isFirstDayOfBagPeriod && isFirstDayOfBagPeriod(dateObj);
    
    // Log pour debug
    console.log(`handleCellClick - Date: ${formattedDate}, bagStartDate: ${formatDateAs(bagStartDate, DATE_FORMATS.ISO_DATE)}, dateObj: ${formatDateAs(dateObj, DATE_FORMATS.ISO_DATE)}, isAfterBagStart: ${isAfterBagStart}, isFirstDayOfBag: ${isFirstDayOfBag}`);
    
    // NOUVEAU: Vérifier si cette garde appartient à une période importée sans BAG
    const isInPeriodWithoutBag = isPeriodWithoutBag(dateObj);
    console.log(`Vérification de la période pour ${formattedDate}: isInPeriodWithoutBag=${isInPeriodWithoutBag}`);
    
    // Vérifier si le modal d'échange direct est activé
    const isDirectExchangeModalEnabled = isFeatureEnabled(FEATURES.DIRECT_EXCHANGE_MODAL);
    
    // Si la garde est dans une période importée sans BAG, toujours utiliser l'échange direct
    if (isInPeriodWithoutBag && !isAdminView) {
      console.log(`Garde du ${formattedDate} dans une période importée sans BAG - utilisation de l'échange direct`);
      
      // Vérifier si le modal est activé
      if (!isDirectExchangeModalEnabled) {
        showToast('Les échanges directs ne sont pas disponibles actuellement.', 'info');
        return;
      }
      
      // Forcer un rafraîchissement des données avant d'ouvrir la modale
      refreshDirectExchanges().then(() => {
        // Vérifier si cette garde a déjà des types d'opérations existants
        const existingDirectExchange = Object.values(directExchanges).find(ex => 
          ex.userId === user?.id && 
          ex.date === formattedDate && 
          ex.period === period
        );
        
        // Récupérer les types d'opérations existants
        const operationTypes = existingDirectExchange?.operationTypes || [];
        
        // Vérifier le remplacement
        const existingReplacement = Object.values(replacements).find(rep => 
          rep.originalUserId === user?.id && 
          rep.date === formattedDate && 
          rep.period === period
        );
        
        // Ajouter replacement si applicable
        if (existingReplacement && !operationTypes.includes('replacement')) {
          operationTypes.push('replacement');
        }
        
        // Ouvrir la modale d'échange direct
        setSelectedDirectExchangeCell({
          position: { x: event.clientX, y: event.clientY },
          assignment: {
            ...assignment,
            date: formattedDate,
            period: period as 'M' | 'AM' | 'S'
          },
          operationTypes: operationTypes,
          existingExchange: existingDirectExchange,
          existingExchangeId: existingDirectExchange?.id,
          existingReplacementId: existingReplacement?.id
        });
      });
      
      return;
    }
    
    // En Phase 2 (distribution) - désactiver les interactions pour les utilisateurs
    if (bagPhaseConfig.phase === 'distribution' && !isAdminView) {
      showToast('La répartition des gardes est en cours. Veuillez patienter.', 'info');
      return;
    }
    
    // En Phase 3 (completed) - vérifier si la garde est dans la période courante
    if (bagPhaseConfig.phase === 'completed' && !isAdminView) {
      if (isCurrentPeriodDate) {
        // Vérifier si le modal est activé
        if (!isDirectExchangeModalEnabled) {
          showToast('Les échanges directs ne sont pas disponibles actuellement.', 'info');
          return;
        }
        
        // Forcer un rafraîchissement des données avant d'ouvrir la modale
        refreshDirectExchanges().then(() => {
          // Vérifier si cette garde a déjà des types d'opérations existants
          // Chercher d'abord dans les échanges directs
          const existingDirectExchange = Object.values(directExchanges).find(ex => 
            ex.userId === user?.id && 
            ex.date === formattedDate && 
            ex.period === period
          );
          
          // S'il n'y a pas d'échange direct, chercher dans la bourse aux gardes
          const existingBagExchange = Object.values(exchanges).find(ex => 
            ex.userId === user?.id && 
            ex.date === formattedDate && 
            ex.period === period
          );
          
          // Priorité aux échanges directs
          const existingExchange = existingDirectExchange || existingBagExchange;
          
          console.log("Recherche d'échange existant pour", formattedDate, period, "->", 
            existingExchange ? `Trouvé! ID: ${existingExchange.id}` : "Aucun trouvé");
          
          // Vérifier aussi le remplacement
          const existingReplacement = Object.values(replacements).find(rep => 
            rep.originalUserId === user?.id && 
            rep.date === formattedDate && 
            rep.period === period
          );
          
          // Récupérer les types d'opérations existants
          const operationTypes = existingExchange?.operationTypes || [];
          
          // Ajouter replacement si applicable
          if (existingReplacement && !operationTypes.includes('replacement')) {
            operationTypes.push('replacement');
          }
          
          // Si la garde est dans la période courante, ouvrir le modal d'échange direct
          setSelectedDirectExchangeCell({
            position: { x: event.clientX, y: event.clientY },
            assignment: {
              ...assignment,
              date: formattedDate,
              period: period as 'M' | 'AM' | 'S'
            },
            operationTypes: operationTypes,
            existingExchange: existingExchange,
            existingExchangeId: existingExchange?.id,
            existingReplacementId: existingReplacement?.id
          });
        });
      } else {
        // Si la garde n'est pas dans la période courante, afficher un message
        showToast('La période d\'échange est terminée pour cette garde.', 'info');
      }
      return;
    }
    
    // En Phase 1 (submission)
    if (bagPhaseConfig.phase === 'submission' && !isAdminView) {
      // Pour les dates à partir du début de la bourse aux gardes (incluant le premier jour), ouvrir la modale de la bourse
      if (isAfterBagStart || isFirstDayOfBag) {
        console.log(`Date ${formattedDate} - Ouverture de la modale BaG (isAfterBagStart=${isAfterBagStart}, isFirstDayOfBag=${isFirstDayOfBag})`);
        setSelectedCell({
          key: cellKey,
          position: { x: event.clientX, y: event.clientY },
          assignment: {
            ...assignment,
            date: formattedDate,
            period: period as 'M' | 'AM' | 'S'
          }
        });
      } else {
        // Pour les dates avant le début de la bourse aux gardes, ouvrir la modale d'échange direct
        console.log(`Date ${formattedDate} - Tentative d'ouverture de la modale d'échange direct (avant le début de la BaG)`);
        // Pour les dates avant le début de la bourse aux gardes, ouvrir la modale d'échange direct
        // Vérifier si le modal est activé
        if (!isDirectExchangeModalEnabled) {
          showToast('Les échanges directs ne sont pas disponibles actuellement.', 'info');
          return;
        }
        
        refreshDirectExchanges().then(() => {
          // Vérifier si cette garde a déjà des types d'opérations existants
          const existingDirectExchange = Object.values(directExchanges).find(ex => 
            ex.userId === user?.id && 
            ex.date === formattedDate && 
            ex.period === period
          );
          
          // Récupérer les types d'opérations existants
          const operationTypes = existingDirectExchange?.operationTypes || [];
          
          // Vérifier le remplacement
          const existingReplacement = Object.values(replacements).find(rep => 
            rep.originalUserId === user?.id && 
            rep.date === formattedDate && 
            rep.period === period
          );
          
          // Ajouter replacement si applicable
          if (existingReplacement && !operationTypes.includes('replacement')) {
            operationTypes.push('replacement');
          }
          
          setSelectedDirectExchangeCell({
            position: { x: event.clientX, y: event.clientY },
            assignment: {
              ...assignment,
              date: formattedDate,
              period: period as 'M' | 'AM' | 'S'
            },
            operationTypes: operationTypes,
            existingExchange: existingDirectExchange,
            existingExchangeId: existingDirectExchange?.id,
            existingReplacementId: existingReplacement?.id
          });
        });
      }
      return;
    }
    
    // En mode admin ou autre cas, permettre l'ouverture du modal standard
    setSelectedCell({
      key: cellKey,
      position: { x: event.clientX, y: event.clientY },
      assignment: {
        ...assignment,
        date: formattedDate,
        period: period as 'M' | 'AM' | 'S'
      }
    });
  }, [bagPhaseConfig.phase, isAdminView, isInCurrentPeriod, user, directExchanges, exchanges, replacements, showToast, setSelectedDirectExchangeCell, setSelectedCell, findBagStartDate, isPeriodWithoutBag, isFeatureEnabled, isFirstDayOfBagPeriod, refreshDirectExchanges]);
  
  // La fonction handleDirectExchangeSubmit est maintenant fournie par useExchangeModal sous le nom handleExchangeModalSubmit

  // Charger les desiderata pour affichage en superposition si non fournis en props
  useEffect(() => {
    if (!user || !showDesiderata || desiderataProps) return;

    const loadDesiderata = async () => {
      try {
        console.log("GeneratedPlanningTable: Chargement des désidératas pour l'affichage...");
        
        // Spécifier explicitement includeArchived=true pour s'assurer d'obtenir 
        // à la fois les désidératas archivés et les désidératas actifs
        // Utiliser l'association courante pour récupérer les désidératas depuis la bonne collection
        console.log(`Chargement des désidératas pour l'utilisateur ${user.id} de l'association ${currentAssociation}`);
        const data = await getAllDesiderata(user.id, true, false, currentAssociation);
        if (data?.selections) {
          console.log("GeneratedPlanningTable: Désidératas chargés pour l'affichage:", Object.keys(data.selections).length);
          console.log("GeneratedPlanningTable: Clés des désidératas:", Object.keys(data.selections));
          
          // Vérifier si les désidératas ont le bon format
          const firstKey = Object.keys(data.selections)[0];
          if (firstKey) {
            console.log("GeneratedPlanningTable: Exemple de désidérata:", firstKey, data.selections[firstKey]);
          }
          
          setDesiderataState(data.selections);
        } else {
          console.log("GeneratedPlanningTable: Aucun désidérata trouvé pour l'utilisateur", user.id);
        }
      } catch (error) {
        console.error('Error loading desiderata:', error);
      }
    };

    loadDesiderata();
  }, [user, showDesiderata, desiderataProps, currentAssociation]); // Ajouter currentAssociation comme dépendance pour recharger les desiderata quand l'association change
  
  // Log pour vérifier la plage de dates et les désiderata
  useEffect(() => {
    console.log("GeneratedPlanningTable: Plage de dates:", startDate.toISOString(), "-", endDate.toISOString());
    
    if (showDesiderata) {
      console.log("GeneratedPlanningTable: showDesiderata est activé");
      
      // Vérifier si les désiderata sont fournis en props
      if (desiderataProps) {
        console.log("GeneratedPlanningTable: Désidératas fournis en props:", Object.keys(desiderataProps).length);
        
        // Filtrer les désiderata pour septembre-octobre 2025
        const septOctDesiderata = Object.keys(desiderataProps).filter(key => 
          key.startsWith('2025-09') || key.startsWith('2025-10')
        );
        
        console.log("GeneratedPlanningTable: Désidératas de sept-oct 2025:", septOctDesiderata.length, septOctDesiderata);
      } else if (Object.keys(desiderataState).length > 0) {
        console.log("GeneratedPlanningTable: Désidératas chargés localement:", Object.keys(desiderataState).length);
        
        // Filtrer les désiderata pour septembre-octobre 2025
        const septOctDesiderata = Object.keys(desiderataState).filter(key => 
          key.startsWith('2025-09') || key.startsWith('2025-10')
        );
        
        console.log("GeneratedPlanningTable: Désidératas de sept-oct 2025:", septOctDesiderata.length, septOctDesiderata);
      } else {
        console.log("GeneratedPlanningTable: Aucun désidérata disponible");
      }
    } else {
      console.log("GeneratedPlanningTable: showDesiderata est désactivé");
    }
  }, [startDate, endDate, showDesiderata, desiderataProps, desiderataState]);

  const handleAddToExchange = useCallback(async (comment: string) => {
    if (!user || !selectedCell) return;
    
    // Vérifier si on est en phase de soumission
    if (bagPhaseConfig.phase !== 'submission') {
      showToast(
        bagPhaseConfig.phase === 'distribution' 
          ? 'La répartition des gardes est en cours. Veuillez patienter.' 
          : 'La période d\'échange est terminée.',
        'info'
      );
      setSelectedCell(null);
      return;
    }
    
    const { date, period, shiftType, timeSlot } = selectedCell.assignment;
    
    try {
      // Ajouter à Firebase - la mise à jour de l'état se fera automatiquement via la souscription
      await addShiftExchange({
        userId: user.id || '',
        date,
        period: period as 'M' | 'AM' | 'S',
        shiftType,
        timeSlot,
        comment: comment || '',
        status: 'pending',
        lastModified: createParisDate().toISOString(),
        operationTypes: ['exchange'] // Valeur par défaut pour operationTypes
      });
      
      showToast('Garde ajoutée à la bourse aux gardes', 'success');
    } catch (error) {
      console.error('Error adding to exchange:', error);
      showToast('Erreur lors de l\'ajout à la bourse aux gardes', 'error');
    }
    
    setSelectedCell(null);
  }, [user, selectedCell, bagPhaseConfig.phase, showToast, setSelectedCell]);

  const handleRemoveFromExchange = useCallback(async () => {
    if (!selectedCell || !user) return;
    
    // Vérifier si on est en phase de soumission
    if (bagPhaseConfig.phase !== 'submission') {
      showToast(
        bagPhaseConfig.phase === 'distribution' 
          ? 'La répartition des gardes est en cours. Veuillez patienter.' 
          : 'La période d\'échange est terminée.',
        'info'
      );
      setSelectedCell(null);
      return;
    }
    
    const { date, period } = selectedCell.assignment;
    const key = `${date}-${period}`;
    const exchange = exchanges[key];
    
    if (!exchange) {
      setSelectedCell(null);
      return;
    }
    
    // Vérifier que l'utilisateur est propriétaire de cette garde
    if (exchange.userId !== user.id) {
      showToast('Vous ne pouvez pas retirer une garde qui ne vous appartient pas', 'error');
      setSelectedCell(null);
      return;
    }
    
    // Stocker l'ID de l'échange avant de le supprimer
    const exchangeId = exchange.id;
    
    try {
      // Supprimer de Firebase - la mise à jour de l'état se fera automatiquement via la souscription
      await removeShiftExchange(exchangeId);
      
      // Ne pas dépendre de l'état exchanges après la suppression
      showToast('Garde retirée de la bourse aux gardes', 'success');
    } catch (error) {
      console.error('Error removing from exchange:', error);
      showToast('Erreur lors du retrait de la garde', 'error');
    }
    
    setSelectedCell(null);
  }, [user, selectedCell, bagPhaseConfig.phase, exchanges, showToast, setSelectedCell]);

  const renderMonthTable = (month: Date) => {
    // Créer un tableau de tous les jours du mois
    const days = Array.from(
      { length: getDaysInMonth(month) },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
    );

    // Filtrer les jours pour n'inclure que ceux dans la plage de dates
    const filteredDays = days.filter(date => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const compareStart = new Date(startDate);
      compareStart.setHours(0, 0, 0, 0);
      
      const compareEnd = new Date(endDate);
      compareEnd.setHours(0, 0, 0, 0);
      
      return startOfDay >= compareStart && startOfDay <= compareEnd;
    });

    return (
      <div key={month.getTime()} className="inline-block align-top mr-4 mb-4">
        <table className="border border-gray-200 bg-white">
          <thead>
            <tr>
              <th colSpan={4} className="px-3 py-2 text-xs font-medium text-gray-500 border-b bg-gray-50/70">
                {getMonthYearDisplay(month)}
              </th>
            </tr>
            <tr className="bg-gray-50/70">
              <th className="border px-2 py-1 text-xs font-normal text-gray-500 w-16">Jour</th>
              <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">M</th>
              <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">AM</th>
              <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">S</th>
            </tr>
          </thead>
          <tbody>
            {filteredDays.map(day => {
              const dateStr = normalizeDateString(day);
              const grayedOut = isGrayedOut(day);
              return (
                <tr key={dateStr}>
                  <td className={`border px-2 py-1 text-[11px] ${grayedOut ? 'text-gray-400 bg-gray-50/50' : 'text-gray-500 bg-gray-50/30'}`}>
                    {/* Indicateur pour le début de la période BAG */}
                    {isFirstDayOfBagPeriod && isFirstDayOfBagPeriod(day) && (
                      <div className="absolute right-0 top-0 w-2 h-2 bg-yellow-500 rounded-full" 
                           title="Début de la période Bourse aux Gardes">
                      </div>
                    )}
                    {/* Référence pour le scroll vers la date actuelle - sans bordure visible */}
                    {createParisDate().toDateString() === day.toDateString() && (
                      <div ref={todayRef} className="absolute top-0 left-0 right-0 bottom-0 z-5 pointer-events-none"></div>
                    )}
                    <div className="flex justify-start items-center">
                      <span>{formatDate(day, DATE_FORMATS.DAY_ONLY)}</span>
                      <span className="text-gray-400 text-[10px] ml-1">
                        {formatDateCapitalized(day, 'EEEEEE')}
                      </span>
                    </div>
                  </td>
                  {['M', 'AM', 'S'].map(period => {
                    const cellKey = `${dateStr}-${period}`;
                    const exchange = exchanges[cellKey];
                    const replacement = replacements[cellKey];
                    
                    // Vérifier si la cellule représente une garde reçue via un échange
                    const key = `${dateStr}-${period}`;
                    const receivedShift = receivedShifts[key];
                    
                    // Nouvelle condition pour les permutations : si c'est une permutation,
                    // les deux utilisateurs doivent voir leur garde en vert
                    const isReceivedShift = receivedShift && (
                      receivedShift.newUserId === userId || 
                      (receivedShift.isPermutation && receivedShift.originalUserId === userId)
                    );
                    
                    // Pour afficher différemment les permutations
                    const isReceivedPermutation = isReceivedShift && receivedShift.isPermutation;
                    
                    // Récupérer l'assignment de base ou la garde reçue
                    let cellAssignment = assignments[cellKey];
                    
                    // Si la garde a été donnée via un échange simple (non permutation), ne rien afficher
                    if (receivedShift && receivedShift.originalUserId === userId && !receivedShift.isPermutation && !cellAssignment) {
                      return (
                        <td key={cellKey} className="border px-1 py-1 text-xs text-center"></td>
                      );
                    }
                    
                    // Si aucune garde assignée mais c'est une garde reçue, créer un assignment temporaire
                    if (!cellAssignment && isReceivedShift) {
                      cellAssignment = {
                        type: period as 'M' | 'AM' | 'S',
                        date: dateStr,
                        timeSlot: receivedShift.timeSlot,
                        shiftType: receivedShift.shiftType
                      };
                    }
                    
                    // Variables pour le style
                    const desideratum = showDesiderata ? desiderata[cellKey] : null;
                    const hasProposedGuard = exchange && exchange.userId === userId && !isReceivedShift;
                    const isProposedToReplacements = replacement && replacement.originalUserId === userId;
                    
    // Obtenir les types d'opération à partir de l'échange
    // Prioriser le tableau operationTypes s'il existe
    // Sinon, déterminer les types à partir de operationType
    // IMPORTANT: Ne récupérer les operationTypes que si l'échange appartient à l'utilisateur connecté
    const operationTypes = (exchange && exchange.userId === userId) ? 
      (exchange.operationTypes?.length ? 
        exchange.operationTypes : 
        (exchange.operationType === 'both' ? ['exchange', 'give'] : 
         exchange.operationType ? [exchange.operationType] : [])) 
      : [];
    
                    // Déterminer les combinaisons de types d'opérations
                    const hasExchangeOp = operationTypes.includes('exchange');
                    const hasGiveOp = operationTypes.includes('give');
                    const hasBoth = hasExchangeOp && hasGiveOp;
                    
                    // Styles spécifiques aux gardes reçues
                    const interestedCount = exchange?.interestedUsers?.length || 0;
                    
                    // Déterminer les couleurs de fond pour les échanges directs en phase completed
                    let directExchangeBgClass = '';
                    if (bagPhaseConfig.phase === 'completed') {
                      const key = `${dateStr}-${period}`;
                      const directExchange = directExchanges[key];
                      
                      if (directExchange && directExchange.userId === userId) {
                        const directExchangeOpTypes = directExchange.operationTypes || [];
                        const hasDirectExchangeOp = directExchangeOpTypes.includes('exchange');
                        const hasDirectGiveOp = directExchangeOpTypes.includes('give');
                        const hasDirectReplacementOp = directExchangeOpTypes.includes('replacement');
                        
                        if (hasDirectExchangeOp && hasDirectGiveOp && hasDirectReplacementOp) {
                          directExchangeBgClass = 'bg-amber-50'; // CER
                        } else if (hasDirectExchangeOp && hasDirectGiveOp) {
                          directExchangeBgClass = 'bg-orange-50'; // CE
                        } else if (hasDirectExchangeOp && hasDirectReplacementOp) {
                          directExchangeBgClass = 'bg-lime-50'; // ER
                        } else if (hasDirectGiveOp && hasDirectReplacementOp) {
                          directExchangeBgClass = 'bg-amber-50'; // CR
                        } else if (hasDirectExchangeOp) {
                          directExchangeBgClass = 'bg-green-50'; // E
                        } else if (hasDirectGiveOp) {
                          directExchangeBgClass = 'bg-yellow-50'; // C
                        } else if (hasDirectReplacementOp) {
                          directExchangeBgClass = 'bg-amber-50'; // R
                        }
                      } else if (isProposedToReplacements) {
                        directExchangeBgClass = 'bg-amber-50'; // R
                      }
                    }
                    
                    // Construire les classes de fond
                        // Définir les couleurs en fonction des types d'opérations
                        const getOperationBackgroundClass = () => {
                          // Vérifier d'abord si c'est un échange direct
                          const key = `${dateStr}-${period}`;
                          const directExchange = directExchanges[key];
                          
                          // Log pour débogage
                          if (directExchange && directExchange.userId === userId) {
                            console.log(`Échange direct trouvé pour ${key}:`, directExchange);
                          }
                          
                          // En phase completed, utiliser les couleurs correspondant aux types d'opérations
                          if (bagPhaseConfig.phase === 'completed' && directExchangeBgClass) {
                            console.log(`Utilisation de directExchangeBgClass pour ${key}:`, directExchangeBgClass);
                            return directExchangeBgClass;
                          }
                          
                          // Pour les échanges directs en cours (non completed)
                          if (directExchange && directExchange.userId === userId && !isReceivedShift) {
                            console.log(`Traitement de l'échange direct pour ${key}:`, directExchange.operationTypes);
                            
                            const directExchangeOpTypes = directExchange.operationTypes || [];
                            const hasDirectExchangeOp = directExchangeOpTypes.includes('exchange');
                            const hasDirectGiveOp = directExchangeOpTypes.includes('give');
                            const hasDirectReplacementOp = directExchangeOpTypes.includes('replacement');
                            
                            // Appliquer les classes en fonction des types d'opérations
                            if (hasDirectExchangeOp && hasDirectGiveOp && hasDirectReplacementOp) {
                              return 'bg-amber-100 shadow-sm'; // E + C + R
                            } else if (hasDirectExchangeOp && hasDirectGiveOp) {
                              return 'bg-orange-100 shadow-sm'; // E + C
                            } else if (hasDirectExchangeOp && hasDirectReplacementOp) {
                              return 'bg-lime-100 shadow-sm'; // E + R
                            } else if (hasDirectGiveOp && hasDirectReplacementOp) {
                              return 'bg-amber-100 shadow-sm'; // C + R
                            } else if (hasDirectExchangeOp) {
                              return 'bg-green-100 shadow-sm'; // E
                            } else if (hasDirectGiveOp) {
                              return 'bg-yellow-100 shadow-sm'; // C
                            } else if (hasDirectReplacementOp) {
                              return 'bg-amber-100 shadow-sm'; // R
                            }
                          }
                          
                          // Sinon, pour les gardes proposées dans la bourse aux gardes
                          if (bagPhaseConfig.phase !== 'completed' && (hasProposedGuard || isProposedToReplacements) && !isReceivedShift) {
                            // Vérifier les combinaisons des opérations
                            if (hasExchangeOp && hasGiveOp && isProposedToReplacements) {
                              return 'bg-amber-100 shadow-sm'; // E + C + R
                            } else if (hasExchangeOp && hasGiveOp) {
                              return 'bg-orange-100 shadow-sm'; // E + C
                            } else if (hasExchangeOp && isProposedToReplacements) {
                              return 'bg-lime-100 shadow-sm'; // E + R
                            } else if (hasGiveOp && isProposedToReplacements) {
                              return 'bg-amber-100 shadow-sm'; // C + R
                            } else if (hasExchangeOp) {
                              return 'bg-green-100 shadow-sm'; // E
                            } else if (hasGiveOp) {
                              return 'bg-yellow-100 shadow-sm'; // C
                            } else if (isProposedToReplacements) {
                              return 'bg-amber-100 shadow-sm'; // R
                            }
                          }
                          return '';
                        };
                        
                        // Déterminer les classes en fonction des différentes conditions
                        const classes = [];
                        
                        // Priorité 1: Gardes reçues (doivent toujours être visibles, même en phase 3)
                        if (isReceivedShift && !desideratum?.type) {
                          if (isReceivedPermutation) {
                            classes.push('bg-emerald-100');
                          } else {
                            classes.push('bg-green-100');
                          }
                        }
                        // Priorité 2: Gardes proposées avec couleurs correspondant aux types d'opérations
                        else {
                          const operationBgClass = getOperationBackgroundClass();
                          if (operationBgClass) {
                            classes.push(operationBgClass);
                          }
                          // Priorité 3: Cellule grisée (weekend, jour férié, pont) si pas de garde proposée
                          else if (grayedOut) {
                            // Si c'est un desideratum, appliquer une couleur plus foncée
                            if (showDesiderata && desideratum?.type) {
                              if (desideratum.type === 'primary') {
                                classes.push('bg-red-200');
                              } else {
                                classes.push('bg-blue-200');
                              }
                            } else {
                              // Sinon, appliquer le gris standard
                              classes.push('bg-gray-100');
                            }
                          } 
                          // Priorité 4: Si pas grisé mais a un desideratum
                          else if (showDesiderata && desideratum?.type) {
                            if (desideratum.type === 'primary') {
                              classes.push('bg-red-100');
                            } else {
                              classes.push('bg-blue-100');
                            }
                          }
                        }
                        
                        // Ajouter les classes communes
                        if (cellAssignment) {
                          classes.push('hover:bg-opacity-75');
                        }
                        
                        // Ajouter une classe de transition pour les animations
                        classes.push('cell-transition');
                        
                        const bgClasses = classes.filter(Boolean).join(' ');

                    return (
                      <td
                        key={cellKey}
                        className={`border px-1 py-1 text-xs text-center relative transition-colors ${bgClasses} ${
                          cellAssignment && bagPhaseConfig.phase === 'submission' ? 'cursor-pointer hover:bg-gray-50' : ''
                        } ${
                          showDesiderata && desideratum?.type ? 'z-10' : ''
                        }`}
                        title={cellAssignment ? 
                          `${cellAssignment.shiftType} - ${cellAssignment.timeSlot}${
                          // Info sur les gardes reçues
                          isReceivedShift ? 
                            isReceivedPermutation ? ' (Garde permutée)' : ' (Garde reçue via la bourse)' 
                            : ''
                          }${
                          // Info sur tous les types d'opérations dans un seul message
                          (hasProposedGuard || isProposedToReplacements) ? 
                            ` (Proposée pour: ${[
                              hasExchangeOp ? 'Échange' : '',
                              hasGiveOp ? 'Cession' : '',
                              isProposedToReplacements ? 'Remplaçant' : '',
                            ].filter(Boolean).join(', ')})` 
                            : ''
                          }` 
                          : ''}
                        onClick={(e) => !isAdminView && cellAssignment && handleCellClick(e, cellKey, cellAssignment)}
                      >
                        <div className="relative">
                          <span className={`
                            font-semibold text-[13px] 
                            ${period === 'M' 
                              ? 'text-amber-800' 
                              : period === 'AM' 
                                ? 'text-blue-800' 
                                : 'text-violet-800'
                            }
                            ${hasProposedGuard ? 'drop-shadow-sm' : ''}
                            ${isReceivedShift ? 'drop-shadow-sm' : ''}
                          `}>
                            {cellAssignment?.shiftType || ''}
                          </span>
                          
                          {/* Badges pour les différents types d'opérations */}
                          <div className="absolute -top-1 -right-1 flex space-x-1">
                            {/* Badge pour les intéressés */}
                            {bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount > 0 && !isReceivedShift && (
                              <span className="badge-appear">
                                <Badge type="interested" count={interestedCount} size="sm" />
                              </span>
                            )}
                            
                          {/* Badge pour les types d'opérations - TOUJOURS afficher */}
                          {(() => {
                            // Récupérer tous les types d'opérations applicables pour cette cellule
                            const allOperationTypes: string[] = [];
                            
                            // En phase completed, récupérer les opérations des échanges directs
                            if (bagPhaseConfig.phase === 'completed') {
                              const key = `${dateStr}-${period}`;
                              const directExchange = directExchanges[key];
                              
                              // Si un échange direct existe pour cette cellule et cet utilisateur
                              if (directExchange && directExchange.userId === userId) {
                                // Ajouter tous les types d'opérations de l'échange direct
                                directExchange.operationTypes?.forEach(type => {
                                  if (!allOperationTypes.includes(type)) {
                                    allOperationTypes.push(type);
                                  }
                                });
                              }
                            } else {
                              // Pour les autres phases, récupérer les types d'opérations de l'échange et du remplacement
                              if (hasProposedGuard) {
                                // Si c'est un échange de la bourse aux gardes (type 'bag'), toujours afficher 'exchange'
                                operationTypes.forEach(type => {
                                  if (!allOperationTypes.includes(type)) {
                                    allOperationTypes.push(type);
                                  }
                                });
                              }
                            }
                            
                            // Ajouter le type 'replacement' si applicable
                            if (isProposedToReplacements && !allOperationTypes.includes('replacement')) {
                              allOperationTypes.push('replacement');
                            }
                            
                            // Toujours afficher le badge si au moins un type d'opération est présent
                            if (allOperationTypes.length > 0) {
                              return (
                                <span className="badge-appear absolute top-0 right-0 -mt-1 -mr-1" style={{ zIndex: 40 }}>
                                  <Badge 
                                    type="operation-types" 
                                    size="sm" 
                                    operationTypes={allOperationTypes}
                                  />
                                </span>
                              );
                            }
                            
                            return null;
                          })()}
                          </div>
                          
                          
                          {/* Les gardes proposées sans utilisateurs intéressés n'affichent pas de pastille */}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSingleColumnView = () => (
    <div className="overflow-y-auto overflow-x-hidden whitespace-normal">
      {months.map((month, index) => (
        <div key={month.getTime()} className="mb-8">
          <div className="flex items-center mb-2">
            {/* Bouton flèche minimaliste pour charger les mois antérieurs */}
            {index === 0 && onLoadPreviousMonth && (
              <button 
                onClick={onLoadPreviousMonth}
                className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 mr-2"
                title="Afficher les mois antérieurs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            
            {/* Titre du mois */}
            <h3 className="text-lg font-medium text-gray-700">
              {formatParisDate(month, 'MMMM', { locale: frLocale }).charAt(0).toUpperCase() + formatParisDate(month, 'MMMM', { locale: frLocale }).slice(1) + ' ' + formatParisDate(month, 'yyyy')}
            </h3>
          </div>
          <table className="w-full border border-gray-200 bg-white">
            <thead>
              <tr className="bg-gray-50/70">
                <th className="border px-2 py-1 text-xs font-normal text-gray-500 w-1/4">Jour</th>
                <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-1/4">M</th>
                <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-1/4">AM</th>
                <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-1/4">S</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(
                { length: getDaysInMonth(month) },
                (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
              )
                .filter(date => {
                  const startOfDay = new Date(date);
                  startOfDay.setHours(0, 0, 0, 0);
                  
                  const compareStart = new Date(startDate);
                  compareStart.setHours(0, 0, 0, 0);
                  
                  const compareEnd = new Date(endDate);
                  compareEnd.setHours(0, 0, 0, 0);
                  
                  return startOfDay >= compareStart && startOfDay <= compareEnd;
                })
                .map(day => {
                  const dateStr = normalizeDateString(day);
                  const grayedOut = isGrayedOut(day);
                  // Déterminer si ce jour est le premier jour de la période BAG
                  const isBagPeriodStart = isFirstDayOfBagPeriod && isFirstDayOfBagPeriod(day);
                  
                  return (
<tr 
  key={dateStr}
  className={`${isBagPeriodStart && !(bagPhaseConfig.phase === 'completed' && bagPhaseConfig.isValidated) ? 'relative bg-red-50/30' : ''}`}
>
                      <td className={`border px-2 py-1 text-xs ${grayedOut ? 'text-gray-400 bg-gray-50/50' : 'text-gray-500 bg-gray-50/30'} ${isBagPeriodStart && !(bagPhaseConfig.phase === 'completed' && bagPhaseConfig.isValidated) ? 'border-t-2 border-t-red-400' : ''}`}>
                        {/* Ligne rouge pour marquer le début de la période BAG */}
                        {isFirstDayOfBagPeriod && isFirstDayOfBagPeriod(day) && (
                          <div className="absolute right-0 top-0 w-2 h-2 bg-yellow-500 rounded-full" 
                               title="Début de la période Bourse aux Gardes">
                          </div>
                        )}
                        {/* Référence pour le scroll vers la date actuelle - sans bordure visible */}
                        {createParisDate().toDateString() === day.toDateString() && (
                          <div ref={todayRef} className="absolute top-0 left-0 right-0 bottom-0 z-5 pointer-events-none"></div>
                        )}
                        <div className="flex justify-start items-center">
                          <span>{formatDate(day, DATE_FORMATS.DAY_ONLY)}</span>
                          <span className="text-gray-400 text-[10px] ml-1">
                            {formatDateCapitalized(day, 'EEE')}
                          </span>
                          {isBagPeriodStart && !(bagPhaseConfig.phase === 'completed' && bagPhaseConfig.isValidated) && (
                            <span className="text-red-500/50 text-[10px] ml-auto font-medium">BàG</span>
                          )}
                        </div>
                      </td>
                      {['M', 'AM', 'S'].map(period => {
                        const cellKey = `${dateStr}-${period}`;
                        const exchange = exchanges[cellKey];
                        const directExchange = directExchanges[cellKey];
                        const replacement = replacements[cellKey];
                        
                        // Debug : log du remplacement et de l'exchangeId
                        if (replacement) {
                          console.log(`Remplacement trouvé pour ${cellKey}:`, replacement);
                          console.log(`ExchangeId: ${replacement.exchangeId}`);
                          console.log(`Remplacements assignés disponibles:`, assignedReplacements);
                        }
                        
                        // Récupérer le remplaçant assigné s'il existe
                        const assignedReplacement = replacement?.exchangeId ? assignedReplacements[replacement.exchangeId] : undefined;
                        
                        // Debug : log du résultat
                        if (replacement?.exchangeId) {
                          console.log(`Résultat assignedReplacement pour exchangeId ${replacement.exchangeId}:`, assignedReplacement);
                        }
                        
                        // Vérifier si la cellule représente une garde reçue via un échange
                        const receivedShift = receivedShifts[cellKey];
                        
                        // Vérifier si c'est une garde reçue
                        const isReceivedShift = receivedShift && (
                          receivedShift.newUserId === userId || 
                          (receivedShift.isPermutation && receivedShift.originalUserId === userId)
                        );
                        
                        // Récupérer l'assignment de base ou la garde reçue
                        let cellAssignment = assignments[cellKey];
                        
                        // Si la garde a été donnée via un échange simple (non permutation), ne rien afficher
                        if (receivedShift && receivedShift.originalUserId === userId && !receivedShift.isPermutation && !cellAssignment) {
                          return (
                            <td key={cellKey} className="border px-1 py-1 text-xs text-center"></td>
                          );
                        }
                        
                        // Si aucune garde assignée mais c'est une garde reçue, créer un assignment temporaire
                        if (!cellAssignment && isReceivedShift) {
                          cellAssignment = {
                            type: period as 'M' | 'AM' | 'S',
                            date: dateStr,
                            timeSlot: receivedShift.timeSlot,
                            shiftType: receivedShift.shiftType
                          };
                        }
                        
                        const desideratum = showDesiderata ? desiderata[cellKey] : undefined;
                        
                        // Utiliser PlanningGridCell pour un rendu cohérent
                        return (
                          <PlanningGridCell
                            key={cellKey}
                            cellKey={cellKey}
                            assignment={cellAssignment}
                            exchange={exchange}
                            directExchange={directExchange}
                            replacement={replacement}
                            assignedReplacement={assignedReplacement}
                            desideratum={desideratum}
                            receivedShift={receivedShift}
                            userId={userId}
                            isGrayedOut={grayedOut}
                            period={period as 'M' | 'AM' | 'S'}
                            bagPhaseConfig={bagPhaseConfig}
                            isAdminView={isAdminView}
                            onCellClick={handleCellClick}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  // Utiliser le hook useConsolidatedExchanges pour optimiser les souscriptions
  const consolidatedExchanges = useConsolidatedExchanges();
  
  // État pour suivre si les données sont en cours de chargement
  const [isLoading, setIsLoading] = useState(true);
  
  // Fonction pour forcer un rafraîchissement des données (désactivée)
  const forceRefresh = useCallback(async () => {
    // Fonction désactivée
    console.log("Fonction de rafraîchissement forcé désactivée");
  }, []);
  
  // Écouter l'événement global pour rafraîchir les données
  useEffect(() => {
    const handleDirectExchangeUpdate = () => {
      console.log('Événement directExchangeUpdated reçu dans GeneratedPlanningTable, rafraîchissement...');
      // Invalider le cache et rafraîchir
      invalidateAllExchangeDataCache();
      refreshDirectExchanges();
    };
    
    window.addEventListener('directExchangeUpdated', handleDirectExchangeUpdate);
    
    return () => {
      window.removeEventListener('directExchangeUpdated', handleDirectExchangeUpdate);
    };
  }, [refreshDirectExchanges]);
  
  // Effet pour marquer la fin du chargement initial
  useEffect(() => {
    if (Object.keys(directExchanges).length > 0 || Object.keys(exchanges).length > 0) {
      console.log("Données chargées, fin du chargement initial");
      setIsLoading(false);
    }
  }, [directExchanges, exchanges]);
  
  // Effet pour le changement de vue (sans forçage de rafraîchissement)
  useEffect(() => {
    console.log("Changement de vue détecté:", viewMode);
    // Forçage du rafraîchissement désactivé
  }, [viewMode]);
  
  // Mémoïser les données consolidées pour éviter les re-rendus inutiles
  const consolidatedData = useMemo(() => {
    // Si les données consolidées sont disponibles, les utiliser
    if (!consolidatedExchanges.loading && !consolidatedExchanges.error) {
      console.log("Utilisation des données consolidées");
      return {
        exchanges: consolidatedExchanges.exchanges,
        directExchanges: consolidatedExchanges.directExchanges,
        replacements: consolidatedExchanges.replacements
      };
    }
    
    // Sinon, utiliser les données locales
    console.log("Utilisation des données locales");
    return {
      exchanges,
      directExchanges,
      replacements
    };
  }, [consolidatedExchanges, exchanges, directExchanges, replacements]);

  return (
    <>
      {viewMode === 'multiColumn' ? (
        <div 
          className="overflow-x-auto whitespace-nowrap" 
          style={{ 
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            width: '100%',
            maxWidth: '100%',
            position: 'relative'
          }}
        >
          <VirtualizedMonthList
            startDate={startDate}
            endDate={endDate}
            assignments={assignments}
            exchanges={consolidatedData.exchanges}
            directExchanges={consolidatedData.directExchanges}
            replacements={consolidatedData.replacements}
            desiderata={desiderata}
            receivedShifts={receivedShifts}
            userId={userId}
            isAdminView={isAdminView}
            showDesiderata={showDesiderata}
            bagPhaseConfig={bagPhaseConfig}
            todayRef={todayRef}
            isFirstDayOfBagPeriod={isFirstDayOfBagPeriod}
            onCellClick={handleCellClick}
            height="calc(100vh - 250px)" // Hauteur dynamique optimisée pour petits écrans
            width="100%"
            onLoadPreviousMonth={onLoadPreviousMonth}
            onLoadNextMonth={onLoadNextMonth}
            maxMonths={7} // Limiter à 7 mois maximum
          />
        </div>
      ) : (
        renderSingleColumnView()
      )}

      {selectedCell && (
        <Portal>
          <CommentModal
            isOpen={true}
            onClose={() => setSelectedCell(null)}
            onExchange={!isAdminView ? handleAddToExchange : undefined}
            onRemoveExchange={!isAdminView ? handleRemoveFromExchange : undefined}
            onSave={() => setSelectedCell(null)}
            initialComment=""
            position={selectedCell.position}
            cellKey={selectedCell.key}
            readOnly={isAdminView}
          />
        </Portal>
      )}
      
      {selectedDirectExchangeCell && (
        <Portal>
          <ExchangeModal
            isOpen={true}
            onClose={() => setSelectedDirectExchangeCell(null)}
            onSubmit={handleExchangeModalSubmit}
            onRemove={handleRemove}
            initialComment={selectedDirectExchangeCell.existingExchangeId ? 
              Object.values(exchanges).find(ex => ex.id === selectedDirectExchangeCell.existingExchangeId)?.comment || "" 
              : ""}
            position={selectedDirectExchangeCell.position}
            assignment={selectedDirectExchangeCell.assignment}
            exchangeType="direct"
            showReplacementOption={true}
            operationTypes={selectedDirectExchangeCell.operationTypes}
            existingExchangeId={selectedDirectExchangeCell.existingExchangeId}
            allOptionsSelected={selectedDirectExchangeCell.operationTypes && 
              selectedDirectExchangeCell.operationTypes.length >= 2}
          />
        </Portal>
      )}
    </>
  );
};

export default GeneratedPlanningTable;
