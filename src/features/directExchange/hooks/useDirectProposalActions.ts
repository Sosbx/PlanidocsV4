import { useCallback, useState } from 'react';
import { useAuth } from '../../../features/auth/hooks';
import { 
  acceptProposal, 
  rejectProposal, 
  proposeMultipleExchange, 
  proposeDirectTake, 
  cancelProposal,
  updateProposal,
  getProposalsForExchange,
  DirectExchangeProposal
} from '../../../lib/firebase/directExchange';
import { ShiftPeriod } from '../../../types/exchange';
import { format } from 'date-fns';
import { standardizePeriod, periodToEnum } from '../../../utils/periodUtils';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';

/**
 * Fonction utilitaire pour convertir les chaînes en valeurs d'enum ShiftPeriod
 */
const stringToPeriod = (periodStr: string): ShiftPeriod => {
  switch (standardizePeriod(periodStr)) {
    case 'M': return ShiftPeriod.MORNING;
    case 'AM': return ShiftPeriod.AFTERNOON;
    case 'S': return ShiftPeriod.EVENING;
    default: return ShiftPeriod.MORNING; // Valeur par défaut
  }
};

/**
 * Type pour les options du hook
 */
type UseDirectProposalActionsOptions = {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onComplete?: () => void;
};

/**
 * Hook pour gérer les actions sur les propositions d'échange
 * Centralise les opérations sur les propositions (accepter, rejeter, etc.)
 */
export const useDirectProposalActions = (
  userProposals: DirectExchangeProposal[],
  userAssignments: Record<string, any> | null,
  options?: UseDirectProposalActionsOptions
) => {
  const { user } = useAuth();
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });
  
  // Fonction pour accepter une proposition
  const handleAcceptProposal = useCallback(async (
    proposalId: string,
    exchange: ExchangeShiftExchange,
    onComplete?: () => void
  ) => {
    try {
      console.log("🔄 Acceptation de la proposition d'échange:", proposalId);
      console.log("📋 Échange associé:", exchange);
      
      // Accepter la proposition - cette fonction déclenchera le TransactionService
      // qui mettra à jour les plannings des médecins dans COLLECTIONS.PLANNINGS
      console.log("🔄 Appel de acceptProposal pour déclencher le TransactionService");
      await acceptProposal(proposalId);
      console.log("✅ Transaction terminée avec succès");
      
      setToast({
        visible: true,
        message: 'Proposition acceptée avec succès',
        type: 'success'
      });
      
      options?.onSuccess?.('Proposition acceptée avec succès');
      onComplete?.();
      options?.onComplete?.();
    } catch (error) {
      console.error('Erreur lors de l\'acceptation de la proposition:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'acceptation de la proposition'}`,
        type: 'error'
      });
      
      options?.onError?.(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  }, [options]);
  
  // Fonction pour rejeter une proposition
  const handleRejectProposal = useCallback(async (
    proposalId: string,
    onComplete?: () => void
  ) => {
    try {
      // Rejeter la proposition
      await rejectProposal(proposalId);
      
      setToast({
        visible: true,
        message: 'Proposition rejetée avec succès',
        type: 'success'
      });
      
      options?.onSuccess?.('Proposition rejetée avec succès');
      onComplete?.();
      options?.onComplete?.();
    } catch (error) {
      console.error('Erreur lors du rejet de la proposition:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue lors du rejet de la proposition'}`,
        type: 'error'
      });
      
      options?.onError?.(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  }, [options]);
  
  // Fonction pour soumettre une proposition d'échange
  const handleProposedExchangeSubmit = useCallback(async (
    exchangeId: string,
    exchange: ExchangeShiftExchange,
    userShiftKeys?: string,
    comment?: string,
    operationType?: string,
    onComplete?: () => void
  ) => {
    if (!user) return;
    
    try {
      console.log('Soumission de proposition:', {
        exchangeId,
        userShiftKeys,
        comment,
        operationType,
        exchange
      });
      
      // Déterminer le type d'opération
      // Si operationType est fourni (nouveau cas d'utilisation), l'utiliser directement
      // Sinon, maintenir la logique existante pour la rétrocompatibilité
      const isExchange = operationType === 'both' || operationType === 'exchange' || !!userShiftKeys;
      const isTake = operationType === 'both' || operationType === 'take' || !userShiftKeys;
      const proposalType = operationType === 'both' ? 'both' : isExchange ? 'exchange' : 'take';
      
      // Vérifier si l'utilisateur a déjà fait une proposition pour cet échange
      const existingProposal = userProposals.find(p => p.targetExchangeId === exchangeId);
      
      console.log('Proposition existante trouvée:', {
        hasExistingProposal: !!existingProposal,
        existingProposalId: existingProposal?.id,
        targetExchangeId: existingProposal?.targetExchangeId
      });
      
      // Préparer les gardes sélectionnées (pour le cas d'un échange)
      let selectedShifts: Array<{date: string, period: ShiftPeriod, shiftType: string, timeSlot: string}> = [];
      
      if (isExchange && userShiftKeys && userAssignments) {
        // Cas d'un échange avec une ou plusieurs gardes
        const selectedKeys = userShiftKeys.split(',');
        console.log('Gardes sélectionnées pour l\'échange:', selectedKeys);
        
        // Récupérer les détails des gardes sélectionnées
        selectedShifts = selectedKeys.map(key => {
          console.log(`Traitement de la garde sélectionnée - Clé: ${key}`);
          const [date, periodRaw] = key.split('-');
          
          // ÉTAPE CRITIQUE : Obtenir les informations de la garde à partir de la clé originale
          const assignment = userAssignments?.[key];
          
          // Obtenir le shiftType et timeSlot à partir de userAssignments
          const shiftType = assignment?.shiftType || '';
          const timeSlot = assignment?.timeSlot || '';
          
          // Pour s'assurer que nous utilisons une période valide dans le backend, 
          // utiliser le timeSlot pour déterminer la période si disponible
          let periodString;
          if (timeSlot) {
            // Logique pour déterminer la période à partir du timeSlot
            if (timeSlot.includes("07:00") || timeSlot.includes("08:00") || timeSlot.includes("09:00")) {
              periodString = 'M'; // Matin
              console.log(`[CORRECTION CRITIQUE] Période déterminée à partir du timeSlot (${timeSlot}): M (Matin)`);
            } else if (timeSlot.includes("13:00") || timeSlot.includes("14:00")) {
              periodString = 'AM'; // Après-midi
              console.log(`[CORRECTION CRITIQUE] Période déterminée à partir du timeSlot (${timeSlot}): AM (Après-midi)`);
            } else if (timeSlot.includes("18:00") || timeSlot.includes("19:00") || timeSlot.includes("20:00") || timeSlot.includes("20:01")) {
              periodString = 'S'; // Soir
              console.log(`[CORRECTION CRITIQUE] Période déterminée à partir du timeSlot (${timeSlot}): S (Soir)`);
            } else {
              // Si on ne peut pas déterminer à partir du timeSlot, utiliser la standardisation classique
              periodString = standardizePeriod(periodRaw);
              console.log(`[FALLBACK] Période standardisée à partir de la valeur brute: ${periodRaw} -> ${periodString}`);
            }
          } else {
            // Si pas de timeSlot, utiliser la standardisation classique
            periodString = standardizePeriod(periodRaw);
            console.log(`Période standardisée pour la garde ${key}: ${periodRaw} -> ${periodString}`);
          }
          
          // Convertir la chaîne de caractères en valeur d'énumération ShiftPeriod
          const period = stringToPeriod(periodString);
          
          // Normaliser le format de date en YYYY-MM-DD
          let formattedDate = date;
          
          try {
            // Si on a la date complète de l'assignation, l'utiliser comme source de vérité
            if (assignment?.date) {
              formattedDate = format(new Date(assignment.date), 'yyyy-MM-dd');
            }
            // Sinon, essayer de formater la date extraite de la clé
            else {
              // Vérifier si c'est déjà au format YYYY-MM-DD
              if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                formattedDate = date;
              } else {
                // Essayer d'extraire le mois et le jour
                const dateParts = date.split('/');
                if (dateParts.length === 3) {
                  // Supposer format JJ/MM/AAAA
                  const [day, month, year] = dateParts;
                  formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                } else {
                  // Dernier recours: parser avec Date()
                  const dateObj = new Date(date);
                  if (!isNaN(dateObj.getTime())) {
                    formattedDate = format(dateObj, 'yyyy-MM-dd');
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Erreur lors du formatage de la date ${date}:`, error);
          }
          
          return {
            date: formattedDate,
            period,
            shiftType,
            timeSlot
          };
        }).filter(shift => shift.shiftType && shift.timeSlot); // Filtrer les gardes invalides
        
        // Vérifier si l'échange proposé est valide
        if (selectedShifts.length === 0) {
          console.warn('Aucune garde valide sélectionnée pour l\'échange');
          
          // Si c'est une mise à jour d'une proposition existante, annuler la proposition
          if (existingProposal?.id) {
            console.log('Annulation de la proposition existante car aucune garde valide sélectionnée');
            await cancelProposal(existingProposal.id);
            
            setToast({
              visible: true,
              message: 'Proposition annulée car aucune garde n\'était sélectionnée',
              type: 'info'
            });
            
            onComplete?.();
            options?.onComplete?.();
            
            return; // Sortir de la fonction ici
          } else {
            // Sinon, lever une erreur comme avant
            throw new Error('Aucune garde valide sélectionnée pour l\'échange');
          }
        }
      }
      
      // Si on a une proposition existante, on la met à jour
      if (existingProposal?.id) {
        try {
          // CORRECTION: Vérifier si l'utilisateur a désélectionné toutes les options
          if (!isTake && !isExchange) {
            console.log('Toutes les options ont été désélectionnées, annulation de la proposition');
            
            // Annuler la proposition existante
            await cancelProposal(existingProposal.id);
            
            setToast({
              visible: true,
              message: 'Proposition annulée avec succès',
              type: 'success'
            });
          }
          // Pour le cas spécial où l'utilisateur veut à la fois reprendre et échanger
          else if (proposalType === 'both') {
            console.log('Mise à jour de proposition pour reprendre ET échanger');
            
            // Vérifier si la proposition actuelle est déjà de type 'both'
            if (existingProposal.proposalType === 'both') {
              console.log('La proposition était déjà de type both, mise à jour simple');
              
              // Mettre à jour la proposition existante pour inclure les deux types d'opérations
              const updatedProposalId = await updateProposal(
                existingProposal.id,
                user.id,
                'both', // Nouveau type spécial pour indiquer les deux opérations
                selectedShifts, // Gardes pour l'échange
                comment || ''
              );
              
              console.log('Proposition combinée mise à jour avec succès, ID:', updatedProposalId);
              
              setToast({
                visible: true,
                message: `Proposition de reprise ET d'échange mise à jour avec succès`,
                type: 'success'
              });
            } else {
              // Si avant c'était 'take' ou 'exchange', mettre à jour directement sans créer une nouvelle proposition
              console.log(`Transition de '${existingProposal.proposalType}' vers 'both'`);
              
              // Mettre à jour directement plutôt que de créer une nouvelle proposition
              const updatedProposalId = await updateProposal(
                existingProposal.id,
                user.id,
                'both',
                selectedShifts,
                comment || ''
              );
              
              console.log('Proposition mise à jour (transition vers both) avec succès, ID:', updatedProposalId);
              
              setToast({
                visible: true,
                message: `Proposition de reprise ET d'échange mise à jour avec succès`,
                type: 'success'
              });
            }
          } else {
            // CORRECTION: Vérifier si le type de proposition a changé
            const previousType = existingProposal.proposalType;
            console.log(`Type de proposition précédent: ${previousType}, nouveau type: ${proposalType}`);
            
            // Si le type a changé de 'both' à 'take' ou 'exchange', utiliser updateProposal directement
            // au lieu de supprimer l'ancienne proposition et d'en créer une nouvelle
            if (previousType === 'both' && (proposalType === 'take' || proposalType === 'exchange')) {
              console.log(`Transition de 'both' vers '${proposalType}' - Mise à jour directe`);
              
              // Mettre à jour directement plutôt que de supprimer et recréer
              const updatedProposalId = await updateProposal(
                existingProposal.id,
                user.id,
                proposalType,
                proposalType === 'exchange' ? selectedShifts : [],
                comment || ''
              );
              
              console.log(`Proposition mise à jour directement avec le nouveau type: ${proposalType}, ID: ${updatedProposalId}`);
              
              setToast({
                visible: true,
                message: proposalType === 'take' 
                  ? 'Proposition de reprise mise à jour avec succès'
                  : `Proposition d'échange de ${selectedShifts.length} garde${selectedShifts.length > 1 ? 's' : ''} mise à jour avec succès`,
                type: 'success'
              });
            } else {
              // Mise à jour standard d'une proposition simple (reprise OU échange)
              const updatedProposalId = await updateProposal(
                existingProposal.id,
                user.id,
                proposalType as 'take' | 'exchange', // On force le type pour la compatibilité
                isExchange ? selectedShifts : [],
                comment || ''
              );
              
              console.log('Proposition mise à jour avec succès, ID:', updatedProposalId);
              
              setToast({
                visible: true,
                message: isExchange 
                  ? `Proposition d'échange de ${selectedShifts.length} garde${selectedShifts.length > 1 ? 's' : ''} mise à jour avec succès`
                  : 'Proposition de reprise mise à jour avec succès',
                type: 'success'
              });
            }
          }
        } catch (error) {
          console.error('Erreur lors de la mise à jour de la proposition:', error);
          throw error;
        }
      } 
      // Sinon, on crée une nouvelle proposition
      else {
        if (proposalType === 'both') {
          try {
            console.log('Création d\'une nouvelle proposition pour reprendre ET échanger');
            
            // Standardiser la période avant de créer la proposition
            const standardizedPeriod = standardizePeriod(exchange.period);
            
            // Utiliser proposeMultipleExchange pour créer une proposition d'échange
            // mais stocker des métadonnées indiquant que c'est une proposition de type "both"
            const proposalId = await proposeMultipleExchange(
              exchangeId,
              user.id,
              selectedShifts,
              comment || ''
            );
            
            console.log('Proposition d\'échange créée avec succès, ID:', proposalId);
            
            // Mettre à jour immédiatement cette proposition pour la marquer comme "both"
            await updateProposal(
              proposalId,
              user.id,
              'both',
              selectedShifts,
              comment || ''
            );
            
            console.log('Proposition mise à jour pour type "both", ID:', proposalId);
            
            setToast({
              visible: true,
              message: `Proposition d'échange ET de reprise envoyée avec succès`,
              type: 'success'
            });
          } catch (error) {
            console.error('Erreur lors de la création de la proposition combinée:', error);
            throw error;
          }
        } 
        else if (isExchange) {
          try {
            // Créer une nouvelle proposition d'échange
            const proposalId = await proposeMultipleExchange(
              exchangeId,
              user.id,
              selectedShifts,
              comment || ''
            );
            
            console.log('Nouvelle proposition d\'échange créée avec succès, ID:', proposalId);
            
            setToast({
              visible: true,
              message: `Proposition d'échange de ${selectedShifts.length} garde${selectedShifts.length > 1 ? 's' : ''} envoyée avec succès`,
              type: 'success'
            });
          } catch (error) {
            console.error('Erreur lors de la proposition d\'échange multiple:', error);
            throw error;
          }
        } else {
          try {
            // Créer une nouvelle proposition de reprise
            // Standardiser la période et la convertir en ShiftPeriod
            const standardizedPeriod = standardizePeriod(exchange.period);
            console.log(`Création d'une reprise avec période standardisée: ${exchange.period} -> ${standardizedPeriod}`);

            const proposalId = await proposeDirectTake(
              exchange.id || '',
              exchange.userId,
              user.id,
              {
                date: exchange.date,
                period: periodToEnum(standardizedPeriod),
                shiftType: exchange.shiftType,
                timeSlot: exchange.timeSlot
              },
              comment || ''
            );
            
            console.log('Nouvelle proposition de reprise créée avec succès, ID:', proposalId);
            
            setToast({
              visible: true,
              message: 'Proposition de reprise envoyée avec succès',
              type: 'success'
            });
          } catch (error) {
            console.error('Erreur lors de la proposition de reprise:', error);
            throw error;
          }
        }
      }
      
      options?.onSuccess?.('Proposition envoyée avec succès');
      onComplete?.();
      options?.onComplete?.();
    } catch (error) {
      console.error('Erreur lors de la soumission de la proposition:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      options?.onError?.(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  }, [user, userAssignments, userProposals, options]);
  
  // Fonction pour annuler une proposition
  const handleCancelProposal = useCallback(async (
    exchangeId: string,
    directExchanges: ExchangeShiftExchange[],
    removeExchange: (id: string, operationType: string) => Promise<void>,
    onComplete?: () => void
  ) => {
    if (!user) return;
    
    try {
      console.log('Annulation de proposition pour échange:', exchangeId);
      
      // Vérifier d'abord si l'utilisateur est le propriétaire de l'échange
      const isOwner = directExchanges.some(exchange => 
        exchange.id === exchangeId && exchange.userId === user.id
      );
      
      if (isOwner) {
        console.log('L\'utilisateur est le propriétaire de l\'échange, suppression complète:', exchangeId);
        
        // Si l'utilisateur est le propriétaire, supprimer l'échange lui-même
        // Trouver l'échange dans notre liste locale pour connaître son type d'opération
        const exchange = directExchanges.find(ex => ex.id === exchangeId);
        
        if (exchange) {
          // Supprimer l'échange
          await removeExchange(exchangeId, exchange.operationType);
          
          setToast({
            visible: true,
            message: 'Proposition annulée avec succès',
            type: 'success'
          });
        } else {
          console.error('Échange non trouvé localement:', exchangeId);
          setToast({
            visible: true,
            message: 'Erreur: Échange non trouvé',
            type: 'error'
          });
        }
      } else {
        // Si l'utilisateur n'est pas le propriétaire, annuler sa proposition pour cet échange
        console.log('L\'utilisateur a fait une proposition pour cet échange, annulation de la proposition');
        
        // Trouver la proposition de l'utilisateur pour cet échange
        const userProposal = userProposals.find(p => p.targetExchangeId === exchangeId);
        
        if (userProposal && userProposal.id) {
          // Annuler la proposition
          await cancelProposal(userProposal.id);
          
          setToast({
            visible: true,
            message: 'Proposition annulée avec succès',
            type: 'success'
          });
        } else {
          console.error('Aucune proposition trouvée pour cet échange');
          setToast({
            visible: true,
            message: 'Erreur: Aucune proposition trouvée pour cet échange',
            type: 'error'
          });
        }
      }
      
      options?.onSuccess?.('Proposition annulée avec succès');
      onComplete?.();
      options?.onComplete?.();
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la proposition:', error);
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      options?.onError?.(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  }, [user, userProposals, options]);
  
  // Fonction pour accepter une garde spécifique dans une proposition d'échange
  const handleAcceptShiftProposal = useCallback(async (
    proposalId: string,
    shiftIndex: number,
    exchange: ExchangeShiftExchange,
    onComplete?: () => void
  ) => {
    try {
      // Récupérer les propositions pour cet échange
      const directProposals = await getProposalsForExchange(exchange.id);
      
      // Trouver la proposition concernée
      const targetProposal = directProposals.find(p => p.id === proposalId);
      if (!targetProposal || !targetProposal.proposedShifts || !targetProposal.proposedShifts[shiftIndex]) {
        console.error('Garde non trouvée dans la proposition');
        throw new Error('Garde non trouvée dans la proposition');
      }
      
      // La garde sélectionnée
      const selectedShift = targetProposal.proposedShifts[shiftIndex];
      
      console.log('Acceptation de la garde spécifique:', {
        proposalId,
        shiftIndex,
        selectedShift
      });
      
      // Convertir la period string en ShiftPeriod pour correspondre au type attendu
      const shiftWithCorrectPeriodType = {
        ...selectedShift,
        period: stringToPeriod(selectedShift.period)
      };
      
      // Stocker temporairement les autres gardes
      const otherShifts = [...targetProposal.proposedShifts];
      otherShifts.splice(shiftIndex, 1);
      
      // Importer les dépendances nécessaires
      const { db } = await import('../../../lib/firebase/config');
      const { doc, collection, runTransaction, serverTimestamp } = await import('firebase/firestore');
      const { DIRECT_EXCHANGE_PROPOSALS } = await import('../../../lib/firebase/directExchange/directProposalOperations');
      
      // Obtenir l'ID du document Firestore
      const proposalDocId = proposalId;
      
      // Créer une transaction pour faire toutes les opérations
      await runTransaction(db, async (transaction) => {
        // 1. Accepter la proposition avec la garde sélectionnée
        const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalDocId);
        
      // Mettre à jour la proposition pour n'inclure que la garde sélectionnée
      // S'assurer que proposalType est défini
      const proposalType = targetProposal.proposalType || 'exchange';
      
      console.log('Mise à jour de la proposition avec les données:', {
        proposedShifts: [shiftWithCorrectPeriodType],
        status: 'accepted',
        proposalType: proposalType,
      });
      
      // Mise à jour manuelle de la proposition pour conserver seulement la garde sélectionnée
      transaction.update(proposalRef, {
        proposedShifts: [shiftWithCorrectPeriodType],
        proposalType: proposalType, // Ajouter le champ proposalType pour éviter undefined
        lastModified: serverTimestamp()
      });
      
      // IMPORTANT: Le statut ne doit PAS être mis à jour ici manuellement
      // Il sera mis à jour via la transaction service dans acceptProposal
      // qui effectuera aussi les transferts de planning
        
        // 2. Si d'autres gardes existent, créer une nouvelle proposition pour elles
        if (otherShifts.length > 0) {
          // Créer une nouvelle proposition pour les autres gardes
          const newProposalRef = doc(collection(db, DIRECT_EXCHANGE_PROPOSALS));
          
          // Convertir toutes les périodes de string à ShiftPeriod
          const normalizedOtherShifts = otherShifts.map(shift => ({
            ...shift,
            period: stringToPeriod(shift.period)
          }));
          
          // S'assurer que targetShift.period est aussi de type ShiftPeriod
          const normalizedTargetShift = {
            ...targetProposal.targetShift,
            period: stringToPeriod(targetProposal.targetShift.period)
          };
          
          // S'assurer que tous les champs requis sont définis
          const proposalType = targetProposal.proposalType || 'exchange';
          const comment = targetProposal.comment || '';
          
          console.log('Création d\'une nouvelle proposition pour les gardes restantes:', {
            targetExchangeId: targetProposal.targetExchangeId,
            targetUserId: targetProposal.targetUserId,
            proposingUserId: targetProposal.proposingUserId,
            proposalType: proposalType,
            comment: comment,
            shiftsCount: normalizedOtherShifts.length
          });
          
          transaction.set(newProposalRef, {
            targetExchangeId: targetProposal.targetExchangeId,
            targetUserId: targetProposal.targetUserId,
            proposingUserId: targetProposal.proposingUserId,
            proposalType: proposalType, // Utiliser la valeur par défaut si undefined
            targetShift: normalizedTargetShift,
            proposedShifts: normalizedOtherShifts,
            comment: comment, // Utiliser une chaîne vide si undefined
            status: 'pending',
            createdAt: serverTimestamp(),
            lastModified: serverTimestamp()
          });
        }
      });
      
      // ÉTAPE CRUCIALE : Appeler acceptProposal pour déclencher la transaction de transfert de planning
      console.log("🔄 Appel de la fonction acceptProposal pour déclencher le TransactionService");
      const { acceptProposal } = await import('../../../lib/firebase/directExchange/directProposalOperations');
      await acceptProposal(proposalId);
      console.log("✅ Fonction acceptProposal exécutée avec succès");
      
      setToast({
        visible: true,
        message: `Garde du ${format(new Date(selectedShift.date), 'dd/MM/yyyy')} (${selectedShift.period}) acceptée avec succès`,
        type: 'success'
      });
      
      options?.onSuccess?.(`Garde acceptée avec succès`);
      onComplete?.();
      options?.onComplete?.();
    } catch (error) {
      console.error('Erreur lors de l\'acceptation de la garde spécifique:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      options?.onError?.(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  }, [options]);
  
  // Fonction pour rejeter une garde spécifique dans une proposition d'échange
  const handleRejectShiftProposal = useCallback(async (
    proposalId: string,
    shiftIndex: number,
    exchange: ExchangeShiftExchange,
    onComplete?: () => void
  ) => {
    try {
      // Récupérer les propositions pour cet échange
      const directProposals = await getProposalsForExchange(exchange.id);
      
      // Trouver la proposition concernée
      const targetProposal = directProposals.find(p => p.id === proposalId);
      if (!targetProposal || !targetProposal.proposedShifts || !targetProposal.proposedShifts[shiftIndex]) {
        console.error('Garde non trouvée dans la proposition');
        throw new Error('Garde non trouvée dans la proposition');
      }
      
      // La garde sélectionnée à rejeter
      const rejectedShift = targetProposal.proposedShifts[shiftIndex];
      
      console.log('Rejet de la garde spécifique:', {
        proposalId,
        shiftIndex,
        rejectedShift
      });
      
      // Stocker les gardes à conserver
            const remainingShifts = [...targetProposal.proposedShifts];
            remainingShifts.splice(shiftIndex, 1);
            
            // Importer les dépendances nécessaires
            const { db } = await import('../../../lib/firebase/config');
            const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            const { DIRECT_EXCHANGE_PROPOSALS } = await import('../../../lib/firebase/directExchange/directProposalOperations');
            
            // Obtenir l'ID du document Firestore
            const proposalDocId = proposalId;
            
            if (remainingShifts.length === 0) {
              // Si c'était la seule garde, rejeter toute la proposition
              await rejectProposal(proposalDocId);
              
              setToast({
                visible: true,
                message: `Garde du ${format(new Date(rejectedShift.date), 'dd/MM/yyyy')} (${rejectedShift.period}) rejetée avec succès`,
                type: 'success'
              });
            } else {
              // Sinon, mettre à jour la proposition pour supprimer uniquement cette garde
              const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalDocId);
              
              // Convertir toutes les périodes de string à ShiftPeriod
              const normalizedRemainingShifts = remainingShifts.map(shift => ({
                ...shift,
                period: stringToPeriod(shift.period)
              }));
              
              await updateDoc(proposalRef, {
                proposedShifts: normalizedRemainingShifts,
                lastModified: serverTimestamp()
              });
              
              setToast({
                visible: true,
                message: `Garde du ${format(new Date(rejectedShift.date), 'dd/MM/yyyy')} (${rejectedShift.period}) rejetée avec succès`,
                type: 'success'
              });
            }
            
            options?.onSuccess?.(`Garde rejetée avec succès`);
            onComplete?.();
            options?.onComplete?.();
          } catch (error) {
            console.error('Erreur lors du rejet de la garde spécifique:', error);
            
            setToast({
              visible: true,
              message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
              type: 'error'
            });
            
            options?.onError?.(error instanceof Error ? error.message : 'Une erreur est survenue');
          }
        }, [options]);
        
        return {
          // État du toast
          toast,
          setToast,
          
          // Actions sur les propositions
          handleAcceptProposal,
          handleRejectProposal,
          handleProposedExchangeSubmit,
          handleCancelProposal,
          handleAcceptShiftProposal,
          handleRejectShiftProposal
        };
      };
