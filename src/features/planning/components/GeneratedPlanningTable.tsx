import React, { useState, useEffect, useCallback } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getMonthsInRange, isGrayedOut } from '../../../utils/dateUtils';
import type { ShiftAssignment, Selections, ShiftReplacement } from '../types';
import type { ShiftExchange } from '../../../types/exchange';
import { getDesiderata } from '../../../lib/firebase/desiderata';
import { useBagPhase } from '../../../features/shiftExchange/hooks';
import { usePlanningPeriod } from '../../../context/planning';
import { addShiftExchange, removeShiftExchange, subscribeToShiftExchanges } from '../../../lib/firebase/shifts';
import { getReplacementsForUser } from '../../../lib/firebase/replacements';
import { CommentModal } from '../../../components/modals';
import { Portal } from '../../../components';
import { ExchangeModal } from '../../../features/directExchange/components';
import { useAuth } from '../../../features/auth/hooks';
import { useDirectExchange } from '../../../features/directExchange/hooks';
import Toast from '../../../components/common/Toast';
import { Badge } from '../../../components/common';
import { OperationType } from '../../../types/exchange';

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
  isFirstDayOfBagPeriod
}) => {
  const months = getMonthsInRange(startDate, endDate);
  const { user } = useAuth();
  const { config: bagPhaseConfig } = useBagPhase();
  const { isInCurrentPeriod } = usePlanningPeriod();
  const [selectedCell, setSelectedCell] = useState<{
    key: string;
    position: { x: number; y: number };
    assignment: ShiftAssignment;
  } | null>(null);
  const [selectedDirectExchangeCell, setSelectedDirectExchangeCell] = useState<{
    key: string;
    position: { x: number; y: number };
    assignment: ShiftAssignment;
    operationTypes?: OperationType[];
    existingExchangeId?: string;
  } | null>(null);
  const { proposeDirectExchange, proposeDirectCession, proposeDirectReplacement, removeExchange } = useDirectExchange({
    onSuccess: (message) => setToast({ visible: true, message, type: 'success' }),
    onError: (message) => setToast({ visible: true, message, type: 'error' })
  });
  const [desiderataState, setDesiderataState] = useState<Selections>({});
  // Utiliser les desiderata passés en props s'ils sont fournis, sinon utiliser l'état local
  const desiderata = desiderataProps || desiderataState;
  const [exchanges, setExchanges] = useState<Record<string, ShiftExchange>>({});
  // Ajouter un état pour les échanges directs
  const [directExchanges, setDirectExchanges] = useState<Record<string, ShiftExchange>>({});
  const [replacements, setReplacements] = useState<Record<string, ShiftReplacement>>({});
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({ 
    visible: false, 
    message: '', 
    type: 'success' 
  });

  // Fonction pour convertir les échanges en un objet avec les clés au format "YYYY-MM-DD-PERIOD"
  const convertExchangesToMap = useCallback((exchanges: ShiftExchange[]) => {
    return exchanges.reduce((acc, exchange) => {
      if (!exchange.date || !exchange.period) {
        console.warn("Échange sans date ou période:", exchange);
        return acc;
      }
      
      // Clé unique pour chaque échange
      const key = `${exchange.date}-${exchange.period}`;
      
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
        acc[key] = exchange;
      }
      
      return acc;
    }, {} as Record<string, ShiftExchange>);
  }, []);

  // S'abonner aux changements en temps réel des gardes proposées à l'échange (bourse aux gardes)
  useEffect(() => {
    // S'abonner aux changements en temps réel de la bourse aux gardes
    const unsubscribe = subscribeToShiftExchanges((exchangeItems) => {
      // Cast des échanges au type ShiftExchange de types/exchange.ts
      const typedExchangeItems = exchangeItems as unknown as ShiftExchange[];
      const exchangesMap = convertExchangesToMap(typedExchangeItems);
      setExchanges(exchangesMap);
    });

    // Se désabonner lorsque le composant est démonté
    return () => {
      unsubscribe();
    };
  }, [convertExchangesToMap]);
  
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
      
      // Convertir en map
      const directExchangesMap = convertExchangesToMap(userExchanges);
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

  const handleCellClick = useCallback((event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => {
    if (!assignment) return;
    
    // Extraire la date et la période du cellKey
    const [year, month, day, period] = cellKey.split('-');
    const formattedDate = `${year}-${month}-${day}`;
    const dateObj = new Date(`${year}-${month}-${day}`);
    
    // Vérifier si la date est dans la période courante
    const isCurrentPeriodDate = isInCurrentPeriod(dateObj);
    
    // En Phase 2 (distribution) - désactiver les interactions pour les utilisateurs
    if (bagPhaseConfig.phase === 'distribution' && !isAdminView) {
      setToast({
        visible: true,
        message: 'La répartition des gardes est en cours. Veuillez patienter.',
        type: 'info'
      });
      return;
    }
    
    // En Phase 3 (completed) - vérifier si la garde est dans la période courante
    if (bagPhaseConfig.phase === 'completed' && !isAdminView) {
      if (isCurrentPeriodDate) {
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
            key: cellKey,
            position: { x: event.clientX, y: event.clientY },
            assignment: {
              ...assignment,
              date: formattedDate,
              period: period as 'M' | 'AM' | 'S'
            },
            operationTypes: operationTypes,
            existingExchangeId: existingExchange?.id
          });
        });
      } else {
        // Si la garde n'est pas dans la période courante, afficher un message
        setToast({
          visible: true,
          message: 'La période d\'échange est terminée pour cette garde.',
          type: 'info'
        });
      }
      return;
    }
    
    // En Phase 1 (submission) ou en mode admin, permettre l'ouverture du modal
    setSelectedCell({
      key: cellKey,
      position: { x: event.clientX, y: event.clientY },
      assignment: {
        ...assignment,
        date: formattedDate,
        period: period as 'M' | 'AM' | 'S'
      }
    });
  }, [bagPhaseConfig.phase, isAdminView, isInCurrentPeriod, user, directExchanges, exchanges, replacements, setToast, setSelectedDirectExchangeCell, setSelectedCell]);
  
  // Fonction pour gérer la soumission d'un échange direct
  const handleDirectExchangeSubmit = useCallback(async (comment: string, operationTypes: OperationType[]) => {
    if (!user || !selectedDirectExchangeCell) return;
    
    const { assignment, existingExchangeId, operationTypes: selectedOperationTypes } = selectedDirectExchangeCell;
    
    try {
      console.log("Handling exchange submission:", {
        operationTypes,
        existingExchangeId,
        selectedOperationTypes
      });
      
      // Si c'est une suppression (aucune opération sélectionnée), forcer un rafraîchissement des données
      if (operationTypes.length === 0) {
        console.log("Suppression demandée, rafraîchissement préalable des données...");
        await refreshDirectExchanges();
      }
      
      // Vérifier aussi le remplacement existant après le rafraîchissement si nécessaire
      const existingReplacement = Object.values(replacements).find(rep => 
        rep.originalUserId === user?.id && 
        rep.date === assignment.date && 
        rep.period === (assignment.period || assignment.type)
      );
      
      // Utiliser la fonction unifiée submitDirectExchange
      const { submitDirectExchange } = await import('../../../lib/firebase/directExchange');
      
      // Trouver l'échange existant pour obtenir operationType et d'autres infos
      // Chercher dans les deux collections d'échanges (directs et bourse aux gardes)
      let existingExchange: ShiftExchange | undefined;
      
      if (existingExchangeId) {
        // D'abord chercher dans les échanges directs
        existingExchange = Object.values(directExchanges).find(ex => ex.id === existingExchangeId);
        
        // Si pas trouvé, chercher dans la bourse aux gardes
        if (!existingExchange) {
          existingExchange = Object.values(exchanges).find(ex => ex.id === existingExchangeId);
        }
        
        // Si toujours pas trouvé, essayer de retrouver un échange par date/période
        if (!existingExchange) {
          console.log("Échange non trouvé par ID. Recherche par date/période...");
          
          // Chercher par date et période
          existingExchange = Object.values(directExchanges).find(ex => 
            ex.userId === user.id && 
            ex.date === assignment.date && 
            ex.period === (assignment.period || assignment.type)
          ) || Object.values(exchanges).find(ex => 
            ex.userId === user.id && 
            ex.date === assignment.date && 
            ex.period === (assignment.period || assignment.type)
          );
          
          if (existingExchange) {
            console.log("Échange trouvé par date/période:", existingExchange.id);
          }
        }
      }
      
      // Log pour le debugging
      console.log("Utilisation de l'échange existant:", existingExchange ? existingExchange.id : "aucun");
      
      // Préparer les données pour la fonction unifiée
      // Utiliser uniquement operationTypes comme source de vérité
      const exchangeData = {
        // Utiliser l'ID de l'échange trouvé s'il existe
        exchangeId: existingExchange?.id || existingExchangeId,
        userId: user.id,
        date: assignment.date,
        period: assignment.period || assignment.type,
        shiftType: assignment.shiftType,
        timeSlot: assignment.timeSlot,
        comment: comment || '',
        // Utiliser les operationTypes de l'échange existant comme source unique de vérité
        operationTypes: existingExchange?.operationTypes || selectedOperationTypes || [],
        // Ajouter l'ID du remplacement existant s'il y en a un
        existingReplacementId: existingReplacement?.id
      };
      
      // Invalider les caches avant de soumettre pour éviter les problèmes de synchronisation
      try {
        const { FirestoreCacheUtils } = await import('../../../utils/cacheUtils');
        FirestoreCacheUtils.invalidate('direct_exchanges_all');
        console.log("Cache des échanges directs invalidé avant soumission");
      } catch (error) {
        console.error("Erreur lors de l'invalidation du cache:", error);
      }
      
      // Appeler la fonction unifiée
      await submitDirectExchange(
        exchangeData,
        operationTypes,
        {
          removeExchange: removeExchange,
          onSuccess: (message) => {
            setToast({
              visible: true,
              message: message,
              type: 'success'
            });
          },
          onError: (message) => {
            setToast({
              visible: true,
              message: message,
              type: 'error'
            });
          },
          onComplete: async () => {
            console.log("Traitement terminé, rafraîchissement des données...");
            
            // Attendre un court délai pour s'assurer que Firebase a terminé ses opérations
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Rafraîchir les données immédiatement
            await refreshDirectExchanges();
            
            // Après le rafraîchissement, on évalue s'il faut fermer la modale ou la mettre à jour
            // Une vérification supplémentaire spécifique pour les remplacements
            try {
              const remplacementsData = await getReplacementsForUser(user.id);
              const replacementsMap = remplacementsData.reduce((acc, replacement) => {
                acc[`${replacement.date}-${replacement.period}`] = replacement;
                return acc;
              }, {} as Record<string, ShiftReplacement>);
              setReplacements(replacementsMap);
              console.log("Remplacements rafraîchis après mise à jour. Trouvés:", remplacementsData.length);
            } catch (error) {
              console.error("Erreur lors du rafraîchissement des remplacements:", error);
            }
            
            // Fermer la modale dans tous les cas après une soumission réussie
            setSelectedDirectExchangeCell(null);
            
            // Message de confirmation que les modifications ont été appliquées
            setToast({
              visible: true,
              message: operationTypes.length === 0 
                ? "Propositions retirées avec succès" 
                : "Propositions mises à jour avec succès",
              type: "success"
            });
          }
        }
      );
      
      // La gestion du remplacement est maintenant intégrée dans submitDirectExchange
    } catch (error) {
      console.error('Error handling direct exchange:', error);
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      setSelectedDirectExchangeCell(null);
    }
  }, [user, selectedDirectExchangeCell, directExchanges, exchanges, replacements, removeExchange, refreshDirectExchanges]);

  // Charger les desiderata pour affichage en superposition si non fournis en props
  useEffect(() => {
    if (!user || !showDesiderata || desiderataProps) return;

    const loadDesiderata = async () => {
      try {
        const data = await getDesiderata(user.id);
        if (data?.selections) {
          setDesiderataState(data.selections);
        }
      } catch (error) {
        console.error('Error loading desiderata:', error);
      }
    };

    loadDesiderata();
  }, [user, showDesiderata, desiderataProps]);

  const handleAddToExchange = useCallback(async (comment: string) => {
    if (!user || !selectedCell) return;
    
    // Vérifier si on est en phase de soumission
    if (bagPhaseConfig.phase !== 'submission') {
      setToast({
        visible: true,
        message: bagPhaseConfig.phase === 'distribution' 
          ? 'La répartition des gardes est en cours. Veuillez patienter.' 
          : 'La période d\'échange est terminée.',
        type: 'info'
      });
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
        lastModified: new Date().toISOString(),
        operationTypes: ['exchange'] // Valeur par défaut pour operationTypes
      });
      
      setToast({
        visible: true,
        message: 'Garde ajoutée à la bourse aux gardes',
        type: 'success'
      });
    } catch (error) {
      console.error('Error adding to exchange:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'ajout à la bourse aux gardes',
        type: 'error'
      });
    }
    
    setSelectedCell(null);
  }, [user, selectedCell, bagPhaseConfig.phase, setToast, setSelectedCell]);

  const handleRemoveFromExchange = useCallback(async () => {
    if (!selectedCell || !user) return;
    
    // Vérifier si on est en phase de soumission
    if (bagPhaseConfig.phase !== 'submission') {
      setToast({
        visible: true,
        message: bagPhaseConfig.phase === 'distribution' 
          ? 'La répartition des gardes est en cours. Veuillez patienter.' 
          : 'La période d\'échange est terminée.',
        type: 'info'
      });
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
      setToast({
        visible: true,
        message: 'Vous ne pouvez pas retirer une garde qui ne vous appartient pas',
        type: 'error'
      });
      setSelectedCell(null);
      return;
    }
    
    // Stocker l'ID de l'échange avant de le supprimer
    const exchangeId = exchange.id;
    
    try {
      // Supprimer de Firebase - la mise à jour de l'état se fera automatiquement via la souscription
      await removeShiftExchange(exchangeId);
      
      // Ne pas dépendre de l'état exchanges après la suppression
      setToast({
        visible: true,
        message: 'Garde retirée de la bourse aux gardes',
        type: 'success'
      });
    } catch (error) {
      console.error('Error removing from exchange:', error);
      setToast({
        visible: true,
        message: 'Erreur lors du retrait de la garde',
        type: 'error'
      });
    }
    
    setSelectedCell(null);
  }, [user, selectedCell, bagPhaseConfig.phase, exchanges, setToast, setSelectedCell]);

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
                {format(month, 'MMMM', { locale: fr }).charAt(0).toUpperCase() + format(month, 'MMMM', { locale: fr }).slice(1) + ' ' + format(month, 'yyyy')}
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
              const dateStr = format(day, 'yyyy-MM-dd');
              const grayedOut = isGrayedOut(day);
              return (
                <tr key={dateStr}>
                  <td className={`border px-2 py-1 text-[11px] ${grayedOut ? 'text-gray-400 bg-gray-50/50' : 'text-gray-500 bg-gray-50/30'}`}>
                    {/* Ligne rouge pour marquer le début de la période BAG */}
                    {isFirstDayOfBagPeriod && isFirstDayOfBagPeriod(day) && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 z-10" 
                           title="Début de la période Bourse aux Gardes">
                      </div>
                    )}
                    {/* Référence pour le scroll vers la date actuelle */}
                    {new Date().toDateString() === day.toDateString() && (
                      <div ref={todayRef} className="absolute top-0 left-0 right-0 bottom-0 border-2 border-indigo-500 z-5 pointer-events-none"></div>
                    )}
                    <div className="flex justify-start items-center">
                      <span>{format(day, 'd', { locale: fr })}</span>
                      <span className="text-gray-400 text-[10px] ml-1">
                        {format(day, 'EEEEEE', { locale: fr }).charAt(0).toUpperCase() + format(day, 'EEEEEE', { locale: fr }).slice(1).toLowerCase()}
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
    const operationTypes = exchange?.operationTypes?.length ? 
      exchange.operationTypes : 
      (exchange?.operationType === 'both' ? ['exchange', 'give'] : 
       exchange?.operationType ? [exchange.operationType] : []);
    
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
                    const bgClasses = [
                      // En phase completed, utiliser les couleurs des échanges directs
                      directExchangeBgClass,
                      // Afficher les couleurs des desiderata indépendamment de la phase
                      showDesiderata && desideratum?.type ? 
                        desideratum.type === 'primary' ? 
                          grayedOut ? 'bg-red-200' : 'bg-red-100'
                          : grayedOut ? 'bg-blue-200' : 'bg-blue-100'
                        : '',
                      !desideratum?.type && grayedOut ? 'bg-gray-100' : '',
                      !desideratum?.type && isReceivedShift && bagPhaseConfig.phase !== 'completed' ? 
                        isReceivedPermutation ? 'bg-emerald-100' : 'bg-green-100' 
                        : '',
                      // Fond basé sur le(s) type(s) d'opération
                      bagPhaseConfig.phase !== 'completed' && hasProposedGuard && !isReceivedShift ? 
                        hasBoth ? 'bg-purple-100 shadow-sm' :
                        hasExchangeOp ? 'bg-yellow-100 shadow-sm' :
                        hasGiveOp ? 'bg-blue-100 shadow-sm' : ''
                        : '',
                      // Ne plus afficher le fond ambre pour les gardes proposées aux remplaçants
                      cellAssignment ? 'hover:bg-opacity-75' : '',
                      // Ajouter une classe de transition pour les animations
                      'cell-transition'
                    ].filter(Boolean).join(' ');

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
                          <div className="absolute -top-2 -right-2 flex space-x-1">
                            {/* Badge pour les intéressés */}
                            {bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount > 0 && !isReceivedShift && (
                              <span className="badge-appear">
                                <Badge type="interested" count={interestedCount} size="sm" />
                              </span>
                            )}
                            
                          {/* Badge pour les types d'opérations */}
                          {(() => {
                            // En phase completed, on veut afficher tous les types d'opérations des échanges directs
                            if (bagPhaseConfig.phase === 'completed') {
                              // Vérifier si cette cellule a un échange direct
                              const key = `${dateStr}-${period}`;
                              const directExchange = directExchanges[key];
                              
                              // Si un échange direct existe pour cette cellule et cet utilisateur
                              if (directExchange && directExchange.userId === userId) {
                                return (
                                  <span className="badge-appear absolute top-0 right-0 mt-1 mr-1" style={{ zIndex: 40 }}>
                                    <Badge 
                                      type="operation-types" 
                                      size="sm" 
                                      operationTypes={directExchange.operationTypes || []}
                                    />
                                  </span>
                                );
                              }
                              
                              // Sinon, afficher uniquement le badge de remplacement si applicable
                              if (isProposedToReplacements) {
                                return (
                                  <span className="badge-appear absolute top-0 right-0 mt-1 mr-1" style={{ zIndex: 40 }}>
                                    <Badge 
                                      type="operation-types" 
                                      size="sm" 
                                      operationTypes={['replacement']}
                                    />
                                  </span>
                                );
                              }
                              
                              return null;
                            }
                            
                            // Pour les autres phases, conserver le comportement existant
                            if ((hasProposedGuard || isProposedToReplacements) && operationTypes.length + (isProposedToReplacements ? 1 : 0) > 0) {
                              return (
                                <span className="badge-appear absolute top-0 right-0 -mt-1 -mr-1" style={{ zIndex: 40 }}>
                                  <Badge 
                                    type="operation-types" 
                                    size="sm" 
                                    operationTypes={[
                                      ...(hasProposedGuard ? operationTypes : []),
                                      ...(isProposedToReplacements ? ['replacement'] : [])
                                    ]}
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
      {months.map((month) => (
        <div key={month.getTime()} className="mb-8">
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {format(month, 'MMMM', { locale: fr }).charAt(0).toUpperCase() + format(month, 'MMMM', { locale: fr }).slice(1) + ' ' + format(month, 'yyyy')}
          </h3>
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
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const grayedOut = isGrayedOut(day);
                  return (
                    <tr key={dateStr}>
                      <td className={`border px-2 py-1 text-xs ${grayedOut ? 'text-gray-400 bg-gray-50/50' : 'text-gray-500 bg-gray-50/30'}`}>
                        {/* Ligne rouge pour marquer le début de la période BAG */}
                        {isFirstDayOfBagPeriod && isFirstDayOfBagPeriod(day) && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 z-10" 
                               title="Début de la période Bourse aux Gardes">
                          </div>
                        )}
                        {/* Référence pour le scroll vers la date actuelle */}
                        {new Date().toDateString() === day.toDateString() && (
                          <div ref={todayRef} className="absolute top-0 left-0 right-0 bottom-0 border-2 border-indigo-500 z-5 pointer-events-none"></div>
                        )}
                        <div className="flex justify-start items-center">
                          <span>{format(day, 'd', { locale: fr })}</span>
                          <span className="text-gray-400 text-[10px] ml-1">
                            {format(day, 'EEEE', { locale: fr }).substring(0, 1).toUpperCase() + format(day, 'EEEE', { locale: fr }).substring(1, 3).toLowerCase()}
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
                        
                        const isReceivedShift = receivedShift && (
                          receivedShift.newUserId === userId || 
                          (receivedShift.isPermutation && receivedShift.originalUserId === userId)
                        );
                        
                        const isReceivedPermutation = isReceivedShift && receivedShift.isPermutation;
                        
                        let cellAssignment = assignments[cellKey];
                        
                        if (receivedShift && receivedShift.originalUserId === userId && !receivedShift.isPermutation && !cellAssignment) {
                          return (
                            <td key={cellKey} className="border px-1 py-1 text-xs text-center"></td>
                          );
                        }
                        
                        if (!cellAssignment && isReceivedShift) {
                          cellAssignment = {
                            type: period as 'M' | 'AM' | 'S',
                            date: dateStr,
                            timeSlot: receivedShift.timeSlot,
                            shiftType: receivedShift.shiftType
                          };
                        }
                        
                        const desideratum = showDesiderata ? desiderata[cellKey] : null;
                        const hasProposedGuard = exchange && exchange.userId === userId && !isReceivedShift;
                        const isProposedToReplacements = replacement && replacement.originalUserId === userId;
                        
                        // Obtenir les types d'opération à partir de l'échange
                        // Prioriser le tableau operationTypes s'il existe
                        // Sinon, déterminer les types à partir de operationType
                        const operationTypes = exchange?.operationTypes?.length ? 
                          exchange.operationTypes : 
                          (exchange?.operationType === 'both' ? ['exchange', 'give'] : 
                           exchange?.operationType ? [exchange.operationType] : []);
                        
                        // Déterminer les combinaisons de types d'opérations
                        const hasExchangeOp = operationTypes.includes('exchange');
                        const hasGiveOp = operationTypes.includes('give');
                        const hasBoth = hasExchangeOp && hasGiveOp;
                        
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
                        
                        const bgClasses = [
                          // En phase completed, utiliser les couleurs des échanges directs
                          directExchangeBgClass,
                          // Afficher les couleurs des desiderata indépendamment de la phase
                          showDesiderata && desideratum?.type ? 
                            desideratum.type === 'primary' ? 
                              grayedOut ? 'bg-red-200' : 'bg-red-100'
                              : grayedOut ? 'bg-blue-200' : 'bg-blue-100'
                            : '',
                          !desideratum?.type && grayedOut ? 'bg-gray-100' : '',
                          !desideratum?.type && isReceivedShift && bagPhaseConfig.phase !== 'completed' ? 
                            isReceivedPermutation ? 'bg-emerald-100' : 'bg-green-100' 
                            : '',
                          // Ne pas afficher le fond jaune pour les gardes proposées en phase completed
                          bagPhaseConfig.phase !== 'completed' && hasProposedGuard && !isReceivedShift ? 'bg-yellow-100' : '',
                          // Ne plus afficher le fond ambre pour les gardes proposées aux remplaçants
                          cellAssignment ? 'hover:bg-opacity-75' : ''
                        ].filter(Boolean).join(' ');

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
                              // Info sur les types d'opérations - à implémenter ici aussi
                              hasProposedGuard ? 
                                ` (Proposée pour: ${[
                                  hasExchangeOp ? 'Échange' : '',
                                  hasGiveOp ? 'Cession' : '',
                                ].filter(Boolean).join(', ')})` 
                                : ''
                              }${
                              // Info sur le remplacement
                              isProposedToReplacements ? ' (Proposée aux remplaçants)' : ''
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
                              <div className="absolute -top-2 -right-2 flex space-x-1">
                                {/* Badge pour les intéressés */}
                                {bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount > 0 && !isReceivedShift && (
                                  <span className="badge-appear">
                                    <Badge type="interested" count={interestedCount} size="sm" />
                                  </span>
                                )}
                                
                              {/* Badge pour les types d'opérations */}
                              {(() => {
                                // En phase completed, on veut afficher tous les types d'opérations des échanges directs
                                if (bagPhaseConfig.phase === 'completed') {
                                  // Vérifier si cette cellule a un échange direct
                                  const key = `${dateStr}-${period}`;
                                  const directExchange = directExchanges[key];
                                  
                                  // Si un échange direct existe pour cette cellule et cet utilisateur
                                  if (directExchange && directExchange.userId === userId) {
                                    return (
                                      <span className="badge-appear absolute top-0 right-0 mt-1 mr-1" style={{ zIndex: 40 }}>
                                        <Badge 
                                          type="operation-types" 
                                          size="sm" 
                                          operationTypes={directExchange.operationTypes || []}
                                        />
                                      </span>
                                    );
                                  }
                                  
                                  // Sinon, afficher uniquement le badge de remplacement si applicable
                                  if (isProposedToReplacements) {
                                    return (
                                      <span className="badge-appear absolute top-0 right-0 mt-1 mr-1" style={{ zIndex: 40 }}>
                                        <Badge 
                                          type="operation-types" 
                                          size="sm" 
                                          operationTypes={['replacement']}
                                        />
                                      </span>
                                    );
                                  }
                                  
                                  return null;
                                }
                                
                                // Pour les autres phases, conserver le comportement existant
                                if ((hasProposedGuard || isProposedToReplacements) && operationTypes.length + (isProposedToReplacements ? 1 : 0) > 0) {
                                  return (
                                    <span className="badge-appear absolute top-0 right-0 -mt-1 -mr-1" style={{ zIndex: 40 }}>
                                      <Badge 
                                        type="operation-types" 
                                        size="sm" 
                                        operationTypes={[
                                          ...(hasProposedGuard ? operationTypes : []),
                                          ...(isProposedToReplacements ? ['replacement'] : [])
                                        ]}
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
      ))}
    </div>
  );

  return (
    <>
      {viewMode === 'multiColumn' ? (
        <div className="overflow-x-auto whitespace-nowrap">
          {months.map(renderMonthTable)}
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
            onSubmit={handleDirectExchangeSubmit}
  onRemove={() => {
    // Cette fonction supprime à la fois l'échange et le remplacement s'ils existent
    console.log("Suppression complète de l'échange et du remplacement");
    
    // Utiliser handleDirectExchangeSubmit avec une liste vide d'opérations
    // pour que submitDirectExchange supprime tout
    // Ne pas fermer la modale immédiatement pour permettre la suppression complète
    handleDirectExchangeSubmit('', []);
    
    // Le toast et la fermeture de la modale seront gérés par le callback onComplete dans handleDirectExchangeSubmit
  }}
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

      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </>
  );
};

export default GeneratedPlanningTable;
