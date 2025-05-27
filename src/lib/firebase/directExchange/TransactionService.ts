
/**
 * TransactionService.ts
 * 
 * Service centralisé pour les opérations transactionnelles sur les échanges directs
 * Assure l'atomicité des opérations critiques et la cohérence des données
 * Gère la synchronisation entre les différents systèmes d'échange (direct et bourse aux gardes)
 * 
 * Version 1.2.0 - Implémentation de la gestion atomique des opérations avec résolution de conflits
 * Développé par Claude pour Planidocs
 */

import { db } from '../config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  runTransaction, 
  Transaction, 
  serverTimestamp, 
  Timestamp,
  DocumentReference,
  addDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { COLLECTIONS } from './types';
import { ShiftExchange, ShiftPeriod, OperationType } from '../../../types/exchange';
import { normalizePeriod } from '../../../utils/dateUtils';
import { lockExchangeForOperation, unlockExchange, syncExchangeSystems } from '../atomicOperations';
import { checkShiftConflict, checkReplacementConflict, ConflictType } from './ConflictService';
import { 
  addNotification, 
  NotificationType, 
  NotificationIconType,
  createExchangeUpdatedNotification 
} from '../notifications';
import { v4 as uuidv4 } from 'uuid';

// Interface pour les données de création d'échange
export interface ExchangeCreationData {
  userId: string;
  date: string;
  period: string | ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  comment?: string;
  operationTypes: OperationType[];
}

// Interface pour les données de proposition
export interface ProposalData {
  exchangeId: string;
  proposingUserId: string;
  targetUserId: string;
  proposalType: 'take' | 'exchange' | 'both' | 'replacement' | 'take_replacement' | 'exchange_replacement';
  proposedShifts?: Array<{
    date: string;
    period: string | ShiftPeriod;
    shiftType: string;
    timeSlot: string;
  }>;
  comment?: string;
}

/**
 * Crée un échange direct dans une transaction
 * Gère automatiquement les synchronisations avec la bourse aux gardes
 * 
 * @param exchangeData Données de l'échange
 * @returns Résultat de l'opération avec l'ID de l'échange créé
 */
export const createExchangeTransaction = async (
  exchangeData: ExchangeCreationData
) => {
  try {
    // Normaliser la période
    const normalizedPeriod = normalizePeriod(exchangeData.period);
    
    // Vérifier les conflits avant de commencer
    const conflictCheck = await checkShiftConflict({
      userId: exchangeData.userId,
      date: exchangeData.date,
      period: normalizedPeriod
    });
    
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        error: conflictCheck.message,
        conflictType: conflictCheck.conflictType
      };
    }
    
    return await runTransaction(db, async (transaction) => {
      // Verrouiller la garde pour l'opération
      const lockResult = await lockExchangeForOperation(transaction, {
        userId: exchangeData.userId,
        date: exchangeData.date,
        period: normalizedPeriod,
        operation: 'exchange'
      });
      
      if (!lockResult.locked) {
        return {
          success: false,
          error: lockResult.error || "Impossible de verrouiller la garde pour l'échange"
        };
      }
      
      // Créer l'échange
      const exchangeRef = doc(collection(db, COLLECTIONS.DIRECT_EXCHANGES));
      
      // Données de l'échange
      const exchangeDoc = {
        id: exchangeRef.id,
        userId: exchangeData.userId,
        date: exchangeData.date,
        period: normalizedPeriod,
        shiftType: exchangeData.shiftType,
        timeSlot: exchangeData.timeSlot,
        comment: exchangeData.comment || "",
        operationTypes: exchangeData.operationTypes,
        status: 'pending',
        hasProposals: false,
        exchangeType: 'direct', // Pour distinguer des échanges de la bourse aux gardes
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      };
      
      // Écrire dans Firestore
      transaction.set(exchangeRef, exchangeDoc);
      
      // Synchroniser avec la bourse aux gardes
      // Si la garde existe déjà dans la BAG, la marquer comme indisponible
      if (lockResult.bagExchangeRef) {
        transaction.update(lockResult.bagExchangeRef, {
          unavailable: true,
          lastModified: serverTimestamp()
        });
      }
      
      // Déverrouiller la garde
      if (lockResult.exchangeDoc && lockResult.exchangeDoc.ref) {
        unlockExchange(transaction, lockResult.exchangeDoc.ref, lockResult.bagExchangeRef);
      }
      
      return {
        success: true,
        exchangeId: exchangeRef.id,
        exchange: exchangeDoc
      };
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'échange:", error);
    return {
      success: false,
      error: `Erreur lors de la création: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Soumet une proposition pour un échange direct existant
 * 
 * @param proposalData Données de la proposition
 * @returns Résultat de l'opération
 */
export const createProposalTransaction = async (
  proposalData: ProposalData
) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Verrouiller l'échange cible
      const lockResult = await lockExchangeForOperation(transaction, {
        exchangeId: proposalData.exchangeId,
        userId: proposalData.proposingUserId,
        date: "", // Pas nécessaire car on a l'ID
        period: "", // Pas nécessaire car on a l'ID
        operation: 'take'
      });
      
      if (!lockResult.locked) {
        return {
          success: false,
          error: lockResult.error || "Impossible de verrouiller l'échange pour la proposition"
        };
      }
      
      if (!lockResult.exchangeDoc) {
        return {
          success: false,
          error: "L'échange ciblé n'existe pas"
        };
      }
      
      const targetExchange = lockResult.exchangeDoc;
      
      // 2. Vérifier que l'échange est toujours disponible
      if (targetExchange.status !== 'pending') {
        return {
          success: false,
          error: "L'échange n'est plus disponible"
        };
      }
      
      // 3. Vérifier qu'un utilisateur ne propose pas sur son propre échange
      if (targetExchange.userId === proposalData.proposingUserId) {
        return {
          success: false,
          error: "Vous ne pouvez pas faire une proposition sur votre propre échange"
        };
      }
      
      // 4. Créer la proposition
      const proposalRef = doc(collection(db, COLLECTIONS.DIRECT_PROPOSALS));
      
      // Préparer les données de la proposition
      const proposalDoc = {
        id: proposalRef.id,
        targetExchangeId: proposalData.exchangeId,
        targetUserId: targetExchange.userId,
        proposingUserId: proposalData.proposingUserId,
        proposalType: proposalData.proposalType,
        targetShift: {
          date: targetExchange.date,
          period: targetExchange.period,
          shiftType: targetExchange.shiftType,
          timeSlot: targetExchange.timeSlot
        },
        proposedShifts: proposalData.proposedShifts || [],
        comment: proposalData.comment || "",
        status: 'pending',
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      };
      
      // Écrire la proposition
      transaction.set(proposalRef, proposalDoc);
      
      // 5. Mettre à jour l'échange pour indiquer qu'il a des propositions
      const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, proposalData.exchangeId);
      transaction.update(exchangeRef, {
        hasProposals: true,
        lastModified: serverTimestamp()
      });
      
      // 6. Créer une notification pour le propriétaire de l'échange
      const notificationRef = doc(collection(db, 'notifications'));
      const notificationData = {
        id: notificationRef.id,
        userId: targetExchange.userId,
        type: NotificationType.DIRECT_EXCHANGE_PROPOSAL,
        title: "Nouvelle proposition d'échange",
        message: `Un médecin a fait une proposition sur votre garde du ${targetExchange.date}`,
        read: false,
        data: {
          exchangeId: proposalData.exchangeId,
          proposalId: proposalRef.id,
          date: targetExchange.date,
          period: targetExchange.period
        },
        createdAt: serverTimestamp()
      };
      
      transaction.set(notificationRef, notificationData);
      
      // 7. Déverrouiller l'échange
      unlockExchange(transaction, exchangeRef, lockResult.bagExchangeRef);
      
      return {
        success: true,
        proposalId: proposalRef.id,
        proposal: proposalDoc
      };
    });
  } catch (error) {
    console.error("Erreur lors de la création de la proposition:", error);
    return {
      success: false,
      error: `Erreur lors de la création de la proposition: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Accepte une proposition d'échange direct et met à jour tous les systèmes
 * 
 * @param proposalId ID de la proposition
 * @param userId ID de l'utilisateur qui accepte
 * @param updatePlanning Si true, met à jour les plannings automatiquement (par défaut)
 * @param sendNotification Si true, envoie des notifications automatiquement (par défaut)
 * @returns Résultat de l'opération
 */
export const acceptProposalTransaction = async (
  proposalId: string,
  userId: string,
  updatePlanning = true,
  sendNotification = true
) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // ÉTAPE 1: EFFECTUER TOUTES LES LECTURES D'ABORD
      
      // 1. Récupérer la proposition
      const proposalRef = doc(db, COLLECTIONS.DIRECT_PROPOSALS, proposalId);
      const proposalDoc = await transaction.get(proposalRef);
      
      if (!proposalDoc.exists()) {
        return {
          success: false,
          error: "La proposition n'existe pas"
        };
      }
      
      const proposal = proposalDoc.data();
      
      // Déterminer le type de proposition s'il n'est pas défini
      if (!proposal.proposalType) {
        console.log(`PROPOSITION: proposalType manquant pour la proposition ${proposalId}, détermination automatique...`);
        if (proposal.proposedShifts && proposal.proposedShifts.length > 0) {
          console.log(`PROPOSITION: proposedShifts présent avec ${proposal.proposedShifts.length} gardes, considéré comme un échange`);
          proposal.proposalType = 'exchange';
        } else {
          console.log("PROPOSITION: Aucun proposedShifts, considéré comme une cession");
          proposal.proposalType = 'take';
        }
      }
      
      // 2. Vérifier que l'utilisateur est bien le propriétaire de l'échange
      if (proposal.targetUserId !== userId) {
        return {
          success: false,
          error: "Vous n'êtes pas autorisé à accepter cette proposition"
        };
      }
      
      // 3. Vérifier que la proposition est toujours en attente
      if (proposal.status !== 'pending') {
        return {
          success: false,
          error: "Cette proposition n'est plus disponible"
        };
      }
      
      // 4. Récupérer l'échange
      const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, proposal.targetExchangeId);
      const exchangeDoc = await transaction.get(exchangeRef);
      
      if (!exchangeDoc.exists()) {
        return {
          success: false,
          error: "L'échange associé n'existe plus"
        };
      }
      
      const exchange = exchangeDoc.data();
      
      // 5. Récupérer les plannings des utilisateurs concernés si demandé
      let sourcePlanningDoc = null;
      let targetPlanningDoc = null;
      
      if (updatePlanning) {
        console.log(`PLANNINGS: Récupération des plannings dans la collection ${COLLECTIONS.PLANNINGS}`);
        
        // Récupérer le planning de l'utilisateur source (qui cède la garde)
        const sourcePlanningRef = doc(db, COLLECTIONS.PLANNINGS, exchange.userId);
        console.log(`PLANNINGS: Récupération du planning source pour l'utilisateur ${exchange.userId}`);
        sourcePlanningDoc = await transaction.get(sourcePlanningRef);
        
        if (!sourcePlanningDoc.exists()) {
          console.warn(`PLANNINGS: Le planning de l'utilisateur source ${exchange.userId} n'existe pas`);
          // Continuer quand même, on le créera si nécessaire
        } else {
          console.log(`PLANNINGS: Planning source trouvé pour l'utilisateur ${exchange.userId}`);
        }
        
        // Récupérer le planning de l'utilisateur cible (qui reprend la garde)
        const targetPlanningRef = doc(db, COLLECTIONS.PLANNINGS, proposal.proposingUserId);
        console.log(`PLANNINGS: Récupération du planning cible pour l'utilisateur ${proposal.proposingUserId}`);
        targetPlanningDoc = await transaction.get(targetPlanningRef);
        
        if (!targetPlanningDoc.exists()) {
          console.log(`PLANNINGS: Le planning de l'utilisateur cible ${proposal.proposingUserId} n'existe pas - il sera créé`);
        } else {
          console.log(`PLANNINGS: Planning cible trouvé pour l'utilisateur ${proposal.proposingUserId}`);
        }
        // Le planning cible peut ne pas exister, on le créera si nécessaire
      }
      
      // ÉTAPE 2: EFFECTUER TOUTES LES ÉCRITURES APRÈS AVOIR FAIT TOUTES LES LECTURES
      
      // 1. Mettre à jour la proposition
      transaction.update(proposalRef, {
        status: 'accepted',
        lastModified: serverTimestamp()
      });
      
      // 2. Mettre à jour l'échange
      transaction.update(exchangeRef, {
        status: 'validated',
        acceptedProposalId: proposalId,
        lastModified: serverTimestamp()
      });
      
      // 3. Mettre à jour les plannings si demandé
      if (updatePlanning) {
        if (proposal.proposalType === 'take' || proposal.proposalType === 'take_replacement') {
          // Pour une prise simple (cession) ou un remplacement
          
          // Créer les données d'assignation pour l'utilisateur cible
          const assignmentData = {
            date: exchange.date,
            period: exchange.period,
            shiftType: exchange.shiftType,
            timeSlot: exchange.timeSlot,
            userId: proposal.proposingUserId
          };
          
          // Récupérer les références des plannings pour éviter les répétitions
          const targetPlanningRef = doc(db, COLLECTIONS.PLANNINGS, proposal.proposingUserId);
          const sourcePlanningRef = doc(db, COLLECTIONS.PLANNINGS, exchange.userId);
          
          console.log(`TRACE TRANSFERT: Transfert de garde de ${exchange.userId} vers ${proposal.proposingUserId}`);
          console.log(`TRACE TRANSFERT: Date: ${exchange.date}, Période: ${exchange.period}`);
          console.log(`TRACE TRANSFERT: Utilisation de la collection ${COLLECTIONS.PLANNINGS} pour les mises à jour`);
          
          // Mettre à jour le planning cible - Ajouter la garde au médecin qui la reprend
          if (targetPlanningDoc && targetPlanningDoc.exists()) {
            const targetPlanningData = targetPlanningDoc.data();
            
            // Vérifier si la garde existe déjà dans le planning cible pour éviter les doublons
            let alreadyExists = false;
            
            // Vérifier dans toutes les périodes du planning
            if (targetPlanningData.periods) {
              for (const periodId in targetPlanningData.periods) {
                const periodData = targetPlanningData.periods[periodId];
                if (periodData && periodData.assignments) {
                  const assignmentKey = `${exchange.date}-${exchange.period}`;
                  if (periodData.assignments[assignmentKey]) {
                    alreadyExists = true;
                    break;
                  }
                }
              }
            }
            
            if (!alreadyExists) {
              console.log(`TRACE TRANSFERT: Ajout de la garde dans le planning du médecin ${proposal.proposingUserId}`);
              
              // Utiliser la période "current" par défaut
              const periodId = "current";
              
              // Mettre à jour le document avec la nouvelle assignation
              transaction.update(targetPlanningRef, {
                [`periods.${periodId}.assignments.${exchange.date}-${exchange.period}`]: assignmentData,
                lastUpdated: serverTimestamp()
              });
            } else {
              console.log(`TRACE TRANSFERT: La garde existe déjà dans le planning de ${proposal.proposingUserId} - Mise à jour ignorée`);
            }
          } else {
            // Créer un nouveau planning pour le médecin qui prend la garde
            console.log(`TRACE TRANSFERT: Création d'un nouveau planning pour ${proposal.proposingUserId}`);
            
            // Utiliser la période "current" par défaut
            const periodId = "current";
            
            transaction.set(targetPlanningRef, {
              periods: {
                [periodId]: {
                  assignments: {
                    [`${exchange.date}-${exchange.period}`]: assignmentData
                  },
                  uploadedAt: serverTimestamp(),
                  isArchived: false
                }
              },
              lastUpdated: serverTimestamp()
            });
          }
          
          // Retirer la garde du planning source - Enlever la garde au médecin qui la cède
          if (sourcePlanningDoc && sourcePlanningDoc.exists()) {
            const sourcePlanningData = sourcePlanningDoc.data();
            
            // Chercher la garde dans toutes les périodes
            let guardFound = false;
            
            if (sourcePlanningData.periods) {
              for (const periodId in sourcePlanningData.periods) {
                const periodData = sourcePlanningData.periods[periodId];
                if (periodData && periodData.assignments) {
                  const assignmentKey = `${exchange.date}-${exchange.period}`;
                  
                  if (periodData.assignments[assignmentKey]) {
                    console.log(`TRACE TRANSFERT: Suppression de la garde ${assignmentKey} du planning du médecin ${exchange.userId} dans la période ${periodId}`);
                    
                    // Supprimer l'assignation en utilisant deleteField()
                    const { deleteField } = await import('firebase/firestore');
                    
                    transaction.update(sourcePlanningRef, {
                      [`periods.${periodId}.assignments.${assignmentKey}`]: deleteField(),
                      lastUpdated: serverTimestamp()
                    });
                    
                    guardFound = true;
                    break;
                  }
                }
              }
            }
            
            if (!guardFound) {
              console.log(`TRACE TRANSFERT: Aucune assignation trouvée pour la date ${exchange.date}-${exchange.period} dans le planning de ${exchange.userId}`);
            }
          } else {
            console.log(`TRACE TRANSFERT: Le planning source pour ${exchange.userId} n'existe pas`);
          }
          } else if (proposal.proposalType.includes('exchange')) {
          // Pour un échange, mettre à jour les deux plannings
          if (!proposal.proposedShifts || proposal.proposedShifts.length === 0) {
            console.warn("Aucune garde proposée en échange");
            console.error("ERREUR CRITIQUE: La proposition est de type échange mais ne contient aucune garde proposée");
            return {
              success: false,
              error: "Erreur critique: proposition d'échange sans garde proposée"
            };
          } else {
            // Prendre la première garde proposée
            const targetShift = proposal.proposedShifts[0];
            console.log("ÉCHANGE DÉTAILLÉ - Garde proposée:", JSON.stringify(targetShift));
            
            console.log(`ÉCHANGE: Début de l'échange entre la garde ${exchange.date}/${exchange.period} et ${targetShift.date}/${targetShift.period}`);
            console.log(`ÉCHANGE: Médecin A (qui a créé l'échange): ${exchange.userId}, Médecin B (qui a proposé): ${proposal.proposingUserId}`);
            
            // Récupérer les références des plannings pour éviter les répétitions
            const sourcePlanningRef = doc(db, COLLECTIONS.PLANNINGS, exchange.userId);
            const targetPlanningRef = doc(db, COLLECTIONS.PLANNINGS, proposal.proposingUserId);
            
            console.log(`ÉCHANGE: Utilisation de la collection ${COLLECTIONS.PLANNINGS} pour les mises à jour`);
            
            // Standardiser les périodes pour s'assurer qu'elles sont au bon format
            const sourceStandardizedPeriod = normalizePeriod(exchange.period);
            const targetStandardizedPeriod = normalizePeriod(targetShift.period);
            
            console.log(`ÉCHANGE: Périodes standardisées - Source: ${exchange.period} -> ${sourceStandardizedPeriod}, Cible: ${targetShift.period} -> ${targetStandardizedPeriod}`);
            
            // Vérifier si les périodes sont valides après standardisation
            if (sourceStandardizedPeriod !== 'M' && sourceStandardizedPeriod !== 'AM' && sourceStandardizedPeriod !== 'S') {
              console.error(`ERREUR CRITIQUE: Période standardisée source invalide: ${sourceStandardizedPeriod}`);
              return {
                success: false,
                error: `Période source invalide: ${sourceStandardizedPeriod}`
              };
            }
            
            if (targetStandardizedPeriod !== 'M' && targetStandardizedPeriod !== 'AM' && targetStandardizedPeriod !== 'S') {
              console.error(`ERREUR CRITIQUE: Période standardisée cible invalide: ${targetStandardizedPeriod}`);
              return {
                success: false,
                error: `Période cible invalide: ${targetStandardizedPeriod}`
              };
            }
            
            // Créer les assignations pour les deux gardes avec les périodes standardisées
            const sourceAssignmentData = {
              date: exchange.date,
              period: sourceStandardizedPeriod,
              shiftType: exchange.shiftType,
              timeSlot: exchange.timeSlot,
              userId: proposal.proposingUserId, // Nouveau propriétaire (Médecin B)
              status: 'active'
            };
            
            const targetAssignmentData = {
              date: targetShift.date,
              period: targetStandardizedPeriod,
              shiftType: targetShift.shiftType,
              timeSlot: targetShift.timeSlot,
              userId: exchange.userId, // Nouveau propriétaire (Médecin A)
              status: 'active'
            };
            
            // Créer les clés d'assignation avec les périodes standardisées
            const sourceAssignmentKey = `${exchange.date}-${sourceStandardizedPeriod}`;
            const targetAssignmentKey = `${targetShift.date}-${targetStandardizedPeriod}`;
            
            console.log(`ÉCHANGE: Clé d'assignation source: ${sourceAssignmentKey}`);
            console.log(`ÉCHANGE: Clé d'assignation cible: ${targetAssignmentKey}`);
            
            // Utiliser la période "current" par défaut pour les deux médecins
            const periodId = "current";
            
            // MÉDECIN A (qui a créé l'échange)
            if (sourcePlanningDoc && sourcePlanningDoc.exists()) {
              const sourcePlanningData = sourcePlanningDoc.data();
              
              // 1A. Supprimer la garde qu'il cède
              let sourceGuardFound = false;
              let sourcePeriodIdFound = null;
              let sourceKeyFound = null;
              
              // Rechercher la garde avec différentes variantes de période pour être sûr de la trouver
              const possibleSourceKeys = [
                `${exchange.date}-${sourceStandardizedPeriod}`,
                `${exchange.date}-${exchange.period}`,
                `${exchange.date}-M`,
                `${exchange.date}-AM`,
                `${exchange.date}-S`
              ];
              
              console.log(`ÉCHANGE: Recherche de la garde source avec les clés possibles:`, possibleSourceKeys);
              
              // Parcourir toutes les périodes pour trouver la garde
              if (sourcePlanningData.periods) {
                // D'abord chercher dans 'current' car c'est la période par défaut
                if (sourcePlanningData.periods.current && sourcePlanningData.periods.current.assignments) {
                  const periodData = sourcePlanningData.periods.current;
                  
                  // Vérifier chaque clé possible
                  for (const possibleKey of possibleSourceKeys) {
                    if (periodData.assignments[possibleKey]) {
                      sourceGuardFound = true;
                      sourcePeriodIdFound = 'current';
                      sourceKeyFound = possibleKey;
                      console.log(`ÉCHANGE: Garde source trouvée dans période 'current' avec la clé: ${possibleKey}`);
                      break;
                    }
                  }
                }
                
                // Si non trouvé, chercher dans les autres périodes
                if (!sourceGuardFound) {
                  for (const pId in sourcePlanningData.periods) {
                    if (pId === 'current') continue; // Déjà vérifié
                    
                    const periodData = sourcePlanningData.periods[pId];
                    if (periodData && periodData.assignments) {
                      // Essayer toutes les clés possibles
                      for (const possibleKey of possibleSourceKeys) {
                        if (periodData.assignments[possibleKey]) {
                          sourceGuardFound = true;
                          sourcePeriodIdFound = pId;
                          sourceKeyFound = possibleKey;
                          console.log(`ÉCHANGE: Garde source trouvée dans période '${pId}' avec la clé: ${possibleKey}`);
                          break;
                        }
                      }
                      if (sourceGuardFound) break;
                    }
                  }
                }
              }
              
              if (sourceGuardFound && sourcePeriodIdFound && sourceKeyFound) {
                console.log(`ÉCHANGE: Suppression de la garde du planning du médecin A (${exchange.userId}) dans la période ${sourcePeriodIdFound} avec la clé ${sourceKeyFound}`);
                
                // Importer deleteField() une seule fois pour une meilleure gestion de la mémoire
                const { deleteField } = await import('firebase/firestore');
                
                // Supprimer uniquement la clé qui a été trouvée
                transaction.update(sourcePlanningRef, {
                  [`periods.${sourcePeriodIdFound}.assignments.${sourceKeyFound}`]: deleteField(),
                  lastUpdated: serverTimestamp()
                });
                
                console.log(`ÉCHANGE: Garde ${sourceKeyFound} supprimée du planning du médecin A`);
              } else {
                console.warn(`ÉCHANGE: ATTENTION - Garde source non trouvée dans le planning du médecin A (${exchange.userId})`);
                console.log(`ÉCHANGE: Création de l'échange sans supprimer de garde source (le médecin n'avait peut-être pas cette garde dans son planning)`);
              }
              
              // 1B. Ajouter la garde qu'il reçoit
              console.log(`ÉCHANGE: Ajout de la garde ${targetAssignmentKey} au planning du médecin A (${exchange.userId})`);
              
              // Vérifier si la période "current" existe déjà
              let currentPeriodExists = false;
              if (sourcePlanningData.periods && sourcePlanningData.periods[periodId]) {
                currentPeriodExists = true;
              }
              
              if (currentPeriodExists) {
                // Ajouter l'assignation à la période existante
                transaction.update(sourcePlanningRef, {
                  [`periods.${periodId}.assignments.${targetAssignmentKey}`]: targetAssignmentData,
                  lastUpdated: serverTimestamp()
                });
              } else {
                // Créer la période "current" avec l'assignation
                transaction.update(sourcePlanningRef, {
                  [`periods.${periodId}`]: {
                    assignments: {
                      [targetAssignmentKey]: targetAssignmentData
                    },
                    uploadedAt: serverTimestamp(),
                    isArchived: false
                  },
                  lastUpdated: serverTimestamp()
                });
              }
              
              console.log(`ÉCHANGE: Garde ajoutée au planning du médecin A`);
            } else {
              // Si le planning n'existe pas encore, le créer avec la garde reçue
              console.log(`ÉCHANGE: Création d'un nouveau planning pour le médecin A (${exchange.userId})`);
              
              transaction.set(sourcePlanningRef, {
                periods: {
                  [periodId]: {
                    assignments: {
                      [targetAssignmentKey]: targetAssignmentData
                    },
                    uploadedAt: serverTimestamp(),
                    isArchived: false
                  }
                },
                lastUpdated: serverTimestamp()
              });
            }
            
            // MÉDECIN B (qui a fait la proposition)
            if (targetPlanningDoc && targetPlanningDoc.exists()) {
              const targetPlanningData = targetPlanningDoc.data();
              
              // 2A. Supprimer la garde qu'il cède
              let targetGuardFound = false;
              let targetPeriodIdFound = null;
              let targetKeyFound = null;
              
              // Rechercher la garde avec différentes variantes de période pour être sûr de la trouver
              const possibleTargetKeys = [
                `${targetShift.date}-${targetStandardizedPeriod}`,
                `${targetShift.date}-${targetShift.period}`,
                `${targetShift.date}-M`,
                `${targetShift.date}-AM`,
                `${targetShift.date}-S`
              ];
              
              console.log(`ÉCHANGE: Recherche de la garde cible avec les clés possibles:`, possibleTargetKeys);
              
              // Parcourir toutes les périodes pour trouver la garde
              if (targetPlanningData.periods) {
                // D'abord chercher dans 'current' car c'est la période par défaut
                if (targetPlanningData.periods.current && targetPlanningData.periods.current.assignments) {
                  const periodData = targetPlanningData.periods.current;
                  
                  // Vérifier chaque clé possible
                  for (const possibleKey of possibleTargetKeys) {
                    if (periodData.assignments[possibleKey]) {
                      targetGuardFound = true;
                      targetPeriodIdFound = 'current';
                      targetKeyFound = possibleKey;
                      console.log(`ÉCHANGE: Garde cible trouvée dans période 'current' avec la clé: ${possibleKey}`);
                      break;
                    }
                  }
                }
                
                // Si non trouvé, chercher dans les autres périodes
                if (!targetGuardFound) {
                  for (const pId in targetPlanningData.periods) {
                    if (pId === 'current') continue; // Déjà vérifié
                    
                    const periodData = targetPlanningData.periods[pId];
                    if (periodData && periodData.assignments) {
                      // Essayer toutes les clés possibles
                      for (const possibleKey of possibleTargetKeys) {
                        if (periodData.assignments[possibleKey]) {
                          targetGuardFound = true;
                          targetPeriodIdFound = pId;
                          targetKeyFound = possibleKey;
                          console.log(`ÉCHANGE: Garde cible trouvée dans période '${pId}' avec la clé: ${possibleKey}`);
                          break;
                        }
                      }
                      if (targetGuardFound) break;
                    }
                  }
                }
              }
              
              if (targetGuardFound && targetPeriodIdFound && targetKeyFound) {
                console.log(`ÉCHANGE: Suppression de la garde du planning du médecin B (${proposal.proposingUserId}) dans la période ${targetPeriodIdFound} avec la clé ${targetKeyFound}`);
                
                // Importer deleteField() une seule fois pour une meilleure gestion de la mémoire
                const { deleteField } = await import('firebase/firestore');
                
                // Supprimer uniquement la clé qui a été trouvée
                transaction.update(targetPlanningRef, {
                  [`periods.${targetPeriodIdFound}.assignments.${targetKeyFound}`]: deleteField(),
                  lastUpdated: serverTimestamp()
                });
                
                console.log(`ÉCHANGE: Garde ${targetKeyFound} supprimée du planning du médecin B`);
              } else {
                console.warn(`ÉCHANGE: ATTENTION - Garde cible non trouvée dans le planning du médecin B (${proposal.proposingUserId})`);
                console.log(`ÉCHANGE: Création de l'échange sans supprimer de garde cible (le médecin n'avait peut-être pas cette garde dans son planning)`);
              }
              
              // 2B. Ajouter la garde qu'il reçoit
              console.log(`ÉCHANGE: Ajout de la garde ${sourceAssignmentKey} au planning du médecin B (${proposal.proposingUserId})`);
              
              // Vérifier si la période "current" existe déjà
              let currentPeriodExists = false;
              if (targetPlanningData.periods && targetPlanningData.periods[periodId]) {
                currentPeriodExists = true;
              }
              
              if (currentPeriodExists) {
                // Ajouter l'assignation à la période existante
                transaction.update(targetPlanningRef, {
                  [`periods.${periodId}.assignments.${sourceAssignmentKey}`]: sourceAssignmentData,
                  lastUpdated: serverTimestamp()
                });
              } else {
                // Créer la période "current" avec l'assignation
                transaction.update(targetPlanningRef, {
                  [`periods.${periodId}`]: {
                    assignments: {
                      [sourceAssignmentKey]: sourceAssignmentData
                    },
                    uploadedAt: serverTimestamp(),
                    isArchived: false
                  },
                  lastUpdated: serverTimestamp()
                });
              }
              
              console.log(`ÉCHANGE: Garde ajoutée au planning du médecin B`);
            } else {
              // Si le planning n'existe pas encore, le créer avec la garde reçue
              console.log(`ÉCHANGE: Création d'un nouveau planning pour le médecin B (${proposal.proposingUserId})`);
              
              transaction.set(targetPlanningRef, {
                periods: {
                  [periodId]: {
                    assignments: {
                      [sourceAssignmentKey]: sourceAssignmentData
                    },
                    uploadedAt: serverTimestamp(),
                    isArchived: false
                  }
                },
                lastUpdated: serverTimestamp()
              });
            }
            
            // Vérification finale et récapitulatif de l'opération
            console.log(`ÉCHANGE: ====== RÉCAPITULATIF DE L'ÉCHANGE ======`);
            console.log(`ÉCHANGE: Transaction ID: ${uuidv4()}`);
            console.log(`ÉCHANGE: Échange terminé entre les gardes ${sourceAssignmentKey} et ${targetAssignmentKey}`);
            console.log(`ÉCHANGE: Médecin A (${exchange.userId}) a maintenant la garde ${targetAssignmentKey}`);
            console.log(`ÉCHANGE: Médecin B (${proposal.proposingUserId}) a maintenant la garde ${sourceAssignmentKey}`);
            console.log(`ÉCHANGE: La proposition ${proposalId} a été acceptée et l'échange ${proposal.targetExchangeId} validé`);
            console.log(`ÉCHANGE: Les plannings ont été mis à jour dans la collection ${COLLECTIONS.PLANNINGS}`);
            console.log(`ÉCHANGE: ===================================`);
          }
        }
      }
      
      // 4. Créer une notification pour l'utilisateur qui a proposé si demandé
      if (sendNotification) {
        const notificationRef = doc(collection(db, 'notifications'));
        
        // Déterminer le bon type de notification selon le type de proposition
        let notificationType = "exchange_accepted"; // Valeur par défaut
        
        // Utiliser le proposalType déterminé précédemment (qui a une valeur par défaut si manquant)
        const safeProposalType = proposal.proposalType || 'exchange';
        
        if (safeProposalType === 'take' || safeProposalType === 'take_replacement') {
          notificationType = "give_accepted"; // Pour une cession
        } else if (safeProposalType.includes('exchange')) {
          notificationType = "exchange_accepted"; // Pour un échange
        } else if (safeProposalType.includes('replacement')) {
          notificationType = "replacement_accepted"; // Pour un remplacement
        }
        
        // S'assurer que tous les champs sont définis pour éviter les valeurs undefined
        
        // Créer la notification avec tous les champs obligatoires et des valeurs par défaut sécurisées
        const notificationData = {
          id: notificationRef.id,
          userId: proposal.proposingUserId || "",
          type: notificationType, // Utilise une chaîne littérale au lieu de l'enum
          title: "Proposition acceptée",
          message: `Votre proposition pour la garde du ${exchange.date || "non spécifiée"} a été acceptée`,
          read: false,
          iconType: "check", // Chaîne littérale au lieu de l'enum
          link: '/planning',
          data: {
            exchangeId: proposal.targetExchangeId || "",
            proposalId: proposalId || "",
            date: exchange.date || "",
            period: exchange.period || "",
            proposalType: safeProposalType // Utiliser la variable avec valeur par défaut
          },
          createdAt: serverTimestamp()
        };
        
        transaction.set(notificationRef, notificationData);
      }
      
      // 5. Ajouter à l'historique
      const transactionId = uuidv4(); // Identifiant unique pour cette transaction
      const historyRef = doc(collection(db, COLLECTIONS.DIRECT_HISTORY));
      
      // S'assurer que toutes les valeurs sont définies
      const operationType = proposal.proposalType || "exchange"; // Valeur par défaut si undefined
      const sourceShift = {
        date: exchange.date || "",
        period: exchange.period || "",
        shiftType: exchange.shiftType || "",
        timeSlot: exchange.timeSlot || ""
      };
      
      const historyData = {
        id: historyRef.id,
        exchangeId: proposal.targetExchangeId || "",
        proposalId: proposalId || "",
        sourceUserId: exchange.userId || "",
        targetUserId: proposal.proposingUserId || "",
        operationType: operationType,
        sourceShift: sourceShift,
        targetShifts: Array.isArray(proposal.proposedShifts) ? proposal.proposedShifts : [],
        completedAt: serverTimestamp(),
        transactionId: transactionId // Pour regrouper différentes opérations
      };
      
      transaction.set(historyRef, historyData);
      
      return {
        success: true,
        proposalId: proposalId,
        exchangeId: proposal.targetExchangeId,
        transactionId: transactionId
      };
    });
  } catch (error) {
    console.error("Erreur lors de l'acceptation de la proposition:", error);
    return {
      success: false,
      error: `Erreur lors de l'acceptation: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Rejette une proposition d'échange direct
 * 
 * @param proposalId ID de la proposition
 * @param userId ID de l'utilisateur qui rejette
 * @param sendNotification Si true, envoie une notification au proposant (par défaut)
 * @returns Résultat de l'opération
 */
export const rejectProposalTransaction = async (
  proposalId: string,
  userId: string,
  sendNotification = true
) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // Logique similaire à acceptProposalTransaction mais marque la proposition comme rejetée
      // et n'effectue pas de mise à jour des plannings
      
      // 1. Récupérer la proposition
      const proposalRef = doc(db, COLLECTIONS.DIRECT_PROPOSALS, proposalId);
      const proposalDoc = await transaction.get(proposalRef);
      
      if (!proposalDoc.exists()) {
        return {
          success: false,
          error: "La proposition n'existe pas"
        };
      }
      
      const proposal = proposalDoc.data();
      
      // 2. Vérifier que l'utilisateur est bien le propriétaire de l'échange
      if (proposal.targetUserId !== userId) {
        return {
          success: false,
          error: "Vous n'êtes pas autorisé à rejeter cette proposition"
        };
      }
      
      // 3. Vérifier que la proposition est toujours en attente
      if (proposal.status !== 'pending') {
        return {
          success: false,
          error: "Cette proposition n'est plus disponible"
        };
      }
      
      // 4. Mettre à jour la proposition
      transaction.update(proposalRef, {
        status: 'rejected',
        lastModified: serverTimestamp()
      });
      
      // 5. Vérifier s'il reste des propositions pour cet échange
      const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, proposal.targetExchangeId);
      
      // Récupérer toutes les propositions actives pour cet échange
      const remainingProposalsQuery = query(
        collection(db, COLLECTIONS.DIRECT_PROPOSALS),
        where('targetExchangeId', '==', proposal.targetExchangeId),
        where('status', '==', 'pending')
      );
      
      const remainingProposalsSnapshot = await transaction.get(remainingProposalsQuery);
      
      // Si c'était la dernière proposition, mettre à jour l'échange
      if (remainingProposalsSnapshot.empty) {
        transaction.update(exchangeRef, {
          hasProposals: false,
          lastModified: serverTimestamp()
        });
      }
      
      // 6. Créer une notification pour l'utilisateur qui a proposé si demandé
      if (sendNotification) {
        const notificationRef = doc(collection(db, 'notifications'));
        const notificationData = {
          id: notificationRef.id,
          userId: proposal.proposingUserId,
          type: NotificationType.DIRECT_EXCHANGE_REJECTED,
          title: "Proposition refusée",
          message: `Votre proposition d'échange pour la garde du ${proposal.targetShift.date} a été refusée`,
          read: false,
          data: {
            exchangeId: proposal.targetExchangeId,
            proposalId: proposalId,
            date: proposal.targetShift.date,
            period: proposal.targetShift.period,
            proposalType: proposal.proposalType
          },
          createdAt: serverTimestamp()
        };
        
        transaction.set(notificationRef, notificationData);
      }
      
      return {
        success: true,
        proposalId: proposalId,
        exchangeId: proposal.targetExchangeId
      };
    });
  } catch (error) {
    console.error("Erreur lors du rejet de la proposition:", error);
    return {
      success: false,
      error: `Erreur lors du rejet: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Annule ou retire un échange direct
 * 
 * @param exchangeId ID de l'échange à annuler
 * @param userId ID de l'utilisateur qui annule
 * @returns Résultat de l'opération
 */
export const cancelExchangeTransaction = async (
  exchangeId: string,
  userId: string
) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Verrouiller l'échange
      const lockResult = await lockExchangeForOperation(transaction, {
        exchangeId: exchangeId,
        userId: userId,
        date: "", // Pas nécessaire car on a l'ID
        period: "", // Pas nécessaire car on a l'ID
        operation: 'cancel'
      });
      
      if (!lockResult.locked) {
        return {
          success: false,
          error: lockResult.error || "Impossible de verrouiller l'échange pour l'annulation"
        };
      }
      
      if (!lockResult.exchangeDoc) {
        return {
          success: false,
          error: "L'échange à annuler n'existe pas"
        };
      }
      
      const exchange = lockResult.exchangeDoc;
      
      // 2. Vérifier que l'utilisateur est bien le propriétaire de l'échange
      if (exchange.userId !== userId) {
        return {
          success: false,
          error: "Vous n'êtes pas autorisé à annuler cet échange"
        };
      }
      
      // 3. Vérifier que l'échange est toujours en attente
      if (exchange.status !== 'pending') {
        return {
          success: false,
          error: "Cet échange n'est plus disponible pour annulation"
        };
      }
      
      // 4. Mettre à jour toutes les propositions associées
      const proposalsQuery = query(
        collection(db, COLLECTIONS.DIRECT_PROPOSALS),
        where('targetExchangeId', '==', exchangeId),
        where('status', '==', 'pending')
      );
      
      const proposalsSnapshot = await transaction.get(proposalsQuery);
      
      // Marquer toutes les propositions comme annulées
      proposalsSnapshot.forEach(doc => {
        transaction.update(doc.ref, {
          status: 'rejected',
          lastModified: serverTimestamp()
        });
        
        // Créer une notification pour chaque utilisateur affecté
        const proposalData = doc.data();
        const notificationRef = doc(collection(db, 'notifications'));
        const notificationData = {
          id: notificationRef.id,
          userId: proposalData.proposingUserId,
          type: NotificationType.DIRECT_EXCHANGE_CANCELLED,
          title: "Échange annulé",
          message: `L'échange pour la garde du ${exchange.date} a été annulé par le propriétaire`,
          read: false,
          data: {
            exchangeId: exchangeId,
            proposalId: doc.id,
            date: exchange.date,
            period: exchange.period
          },
          createdAt: serverTimestamp()
        };
        
        transaction.set(notificationRef, notificationData);
      });
      
      // 5. Mettre à jour l'échange
      const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, exchangeId);
      transaction.update(exchangeRef, {
        status: 'cancelled',
        lastModified: serverTimestamp()
      });
      
      // 6. Réactiver dans la bourse aux gardes si nécessaire
      if (lockResult.bagExchangeRef) {
        transaction.update(lockResult.bagExchangeRef, {
          unavailable: false,
          lastModified: serverTimestamp()
        });
      }
      
      return {
        success: true,
        exchangeId: exchangeId
      };
    });
  } catch (error) {
    console.error("Erreur lors de l'annulation de l'échange:", error);
    return {
      success: false,
      error: `Erreur lors de l'annulation: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Récupère l'historique des échanges d'un utilisateur
 * 
 * @param userId ID de l'utilisateur
 * @param limit Nombre maximum d'entrées à récupérer
 * @returns Liste des échanges
 */
export const getExchangeHistory = async (userId: string, limit: number = 50) => {
  try {
    // Récupérer les échanges où l'utilisateur est source ou cible
    const sourceQuery = query(
      collection(db, COLLECTIONS.DIRECT_HISTORY),
      where('sourceUserId', '==', userId),
      where('completedAt', '!=', null)
    );
    
    const targetQuery = query(
      collection(db, COLLECTIONS.DIRECT_HISTORY),
      where('targetUserId', '==', userId),
      where('completedAt', '!=', null)
    );
    
    const [sourceSnapshot, targetSnapshot] = await Promise.all([
      getDocs(sourceQuery),
      getDocs(targetQuery)
    ]);
    
    // Combiner les résultats
    const history = [
      ...sourceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        role: 'source'
      })),
      ...targetSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        role: 'target'
      }))
    ];
    
    // Trier par date de complétion (du plus récent au plus ancien)
    history.sort((a, b) => {
      const dateA = a.completedAt?.toDate?.() || new Date(0);
      const dateB = b.completedAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Limiter le nombre de résultats
    return history.slice(0, limit);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique des échanges:", error);
    throw error;
  }
};

/**
 * Convertit un historique d'échange en format lisible pour l'affichage
 * 
 * @param history Entrée d'historique
 * @returns Format lisible
 */
export const formatExchangeHistoryEntry = (history: any) => {
  try {
    const isSource = history.role === 'source';
    const operationType = history.operationType;
    const sourceShift = history.sourceShift;
    const targetShifts = history.targetShifts || [];
    
    let operationText = '';
    let shiftText = '';
    
    // Formater selon le type d'opération
    if (operationType === 'take' || operationType === 'take_replacement') {
      if (isSource) {
        operationText = 'Garde cédée';
      } else {
        operationText = 'Garde reprise';
      }
      shiftText = `${sourceShift.date} (${sourceShift.period})`;
    } else if (operationType.includes('exchange')) {
      if (isSource) {
        operationText = 'Garde échangée';
        shiftText = `${sourceShift.date} (${sourceShift.period}) contre ${targetShifts.map(s => `${s.date} (${s.period})`).join(', ')}`;
      } else {
        operationText = 'Garde échangée';
        shiftText = `${targetShifts.map(s => `${s.date} (${s.period})`).join(', ')} contre ${sourceShift.date} (${sourceShift.period})`;
      }
    }
    
    return {
      id: history.id,
      date: history.completedAt?.toDate?.() || new Date(),
      operation: operationText,
      shift: shiftText,
      withUser: isSource ? history.targetUserId : history.sourceUserId,
      transactionId: history.transactionId
    };
  } catch (error) {
    console.error("Erreur lors du formatage de l'historique:", error);
    return {
      id: history.id,
      date: new Date(),
      operation: 'Échange',
      shift: 'Détails non disponibles',
      withUser: 'Inconnu'
    };
  }
};
