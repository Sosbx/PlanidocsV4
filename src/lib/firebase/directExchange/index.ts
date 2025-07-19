// Re-export everything from the directExchange modules
export * from './core';
// Réexportation explicite pour éviter les conflits de noms
export { COLLECTIONS } from './types';
export type { DirectExchangeProposal } from './types';
// Les notifications sont désormais centralisées dans /lib/firebase/notifications.ts
// Réexportation explicite pour éviter les conflits avec ExchangeData
export { 
  processExchangeTransaction,
  addDirectExchange,
  getDirectExchanges,
  getDirectExchangeHistory,
  acceptDirectExchange,
  rejectDirectExchange,
  removeDirectExchange,
  updateExchangeOptions,
  verifyPermission,
  logUserAction
} from './directExchangeOperations';
export type { ExchangeTransactionOptions } from './directExchangeOperations';
export * from './directCessionOperations';
export * from './directReplacementOperations';
export * from './directProposalOperations';
export * from './ValidationService';

// Fonction centralisée pour gérer la soumission des échanges directs
// Ceci permet d'unifier la logique utilisée par différentes parties de l'application
import { updateExchangeOptions as updateOptions } from './directExchangeOperations';
import { createCombinedExchange, getCollectionByOperationType } from './core';
import { doc, updateDoc, getDoc, serverTimestamp, deleteDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from './types';
import type { OperationType } from '../../../types/exchange';

export type ExchangeSubmissionData = {
  exchangeId?: string;
  userId: string;
  date: string;
  period: string;
  shiftType: string;
  timeSlot: string;
  comment: string;
  operationType?: OperationType;
  operationTypes?: OperationType[];
  // existingOperationTypes a été supprimé pour éviter la duplication
  existingReplacementId?: string; // ID du remplacement existant, si applicable
}

export type ExchangeSubmissionOptions = {
  removeExchange?: (id: string, operationType?: OperationType) => Promise<void>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onComplete?: () => void;
}

/**
 * Fonction centralisée et unifiée pour soumettre un échange direct
 * Cette fonction est conçue pour être utilisée par tous les composants de l'application
 * qui ont besoin de gérer des échanges directs
 * @param data Les données de l'échange 
 * @param selectedOperationTypes Les types d'opération sélectionnés par l'utilisateur
 * @param options Options supplémentaires
 * @returns Un objet contenant l'ID de l'échange créé ou mis à jour
 */
export const submitDirectExchange = async (
  data: ExchangeSubmissionData,
  selectedOperationTypes: OperationType[],
  options?: ExchangeSubmissionOptions
): Promise<{ exchangeId?: string; replacementId?: string }> => {
  try {
    console.log("submitDirectExchange appelé avec:", {
      data,
      selectedOperationTypes
    });
    
    // Importer le ValidationService
    const { ValidationService } = await import('./ValidationService');
    
    // Valider les types d'opération
    const validationResult = ValidationService.validateOperationTypes(selectedOperationTypes);
    if (!validationResult.isValid) {
      throw new Error(validationResult.error || 'Types d\'opération invalides');
    }
    
    // Utiliser les types nettoyés
    const sanitizedTypes = validationResult.sanitizedTypes || selectedOperationTypes;
    
    // Si aucune option sélectionnée, supprimer l'échange et/ou le remplacement
    if (sanitizedTypes.length === 0) {
      // Utiliser une promesse pour supprimer à la fois l'échange et le remplacement
      const deletePromises = [];
      
      // Rechercher l'échange par date/période si l'ID n'est pas fourni
      if (!data.exchangeId && data.userId && data.date && data.period) {
        console.log("Recherche d'échange par date/période pour suppression:", {
          userId: data.userId,
          date: data.date,
          period: data.period
        });
        
        try {
          // Rechercher dans la collection direct_exchanges
          const exchangesQuery = query(
            collection(db, COLLECTIONS.DIRECT_EXCHANGES),
            where('userId', '==', data.userId),
            where('date', '==', data.date),
            where('period', '==', data.period),
            where('status', '==', 'pending')
          );
          
          const exchangeSnapshot = await getDocs(exchangesQuery);
          
          if (!exchangeSnapshot.empty) {
            const exchangeDoc = exchangeSnapshot.docs[0];
            data.exchangeId = exchangeDoc.id;
            data.operationType = exchangeDoc.data().operationType || 'exchange';
            console.log("Échange trouvé par date/période pour suppression:", data.exchangeId);
          }
        } catch (error) {
          console.error("Erreur lors de la recherche d'échange par date/période:", error);
        }
      }
      
      // Rechercher le remplacement par date/période si l'ID n'est pas fourni
      if (!data.existingReplacementId && data.userId && data.date && data.period) {
        console.log("Recherche de remplacement par date/période pour suppression:", {
          userId: data.userId,
          date: data.date,
          period: data.period
        });
        
        try {
          // Rechercher dans la collection direct_replacements
          const replacementsQuery = query(
            collection(db, COLLECTIONS.DIRECT_REPLACEMENTS),
            where('originalUserId', '==', data.userId),
            where('date', '==', data.date),
            where('period', '==', data.period),
            where('status', '==', 'pending')
          );
          
          const replacementSnapshot = await getDocs(replacementsQuery);
          
          if (!replacementSnapshot.empty) {
            const replacementDoc = replacementSnapshot.docs[0];
            data.existingReplacementId = replacementDoc.id;
            console.log("Remplacement trouvé par date/période pour suppression:", data.existingReplacementId);
          }
        } catch (error) {
          console.error("Erreur lors de la recherche de remplacement par date/période:", error);
        }
      }
      
      // Supprimer l'échange s'il existe
      if (data.exchangeId && options?.removeExchange) {
        console.log("Suppression de l'échange existant car aucune option sélectionnée:", data.exchangeId);
        deletePromises.push(options.removeExchange(data.exchangeId, data.operationType));
      }
      
      // Supprimer le remplacement s'il existe
      if (data.existingReplacementId && options?.removeExchange) {
        console.log("Suppression du remplacement existant:", data.existingReplacementId);
        deletePromises.push(options.removeExchange(data.existingReplacementId, 'replacement'));
      }
      
      // Attendre que toutes les suppressions soient terminées
      await Promise.all(deletePromises);
      
      options?.onSuccess?.('Propositions retirées avec succès');
      options?.onComplete?.();
      return {};
    } 
    // Mettre à jour ou créer des échanges
    else if (sanitizedTypes.length > 0) {
      let result: { exchangeId?: string; replacementId?: string } = {};
      
      // Rechercher d'abord s'il existe déjà un échange pour cette garde, même si data.exchangeId n'est pas fourni
      let existingExchangeId = data.exchangeId;
      let existingExchangeCollection = '';
      
      // Si l'ID n'est pas fourni ou si nous voulons vérifier qu'il n'y a pas de document dupliqué,
      // rechercher par userId, date et période
      if ((!existingExchangeId || true) && data.userId && data.date && data.period) {
        console.log("Recherche d'échange existant par date/période:", {
          userId: data.userId,
          date: data.date,
          period: data.period
        });
        
        try {
          // Rechercher d'abord dans la collection direct_exchanges
          const exchangesQuery = query(
            collection(db, COLLECTIONS.DIRECT_EXCHANGES),
            where('userId', '==', data.userId),
            where('date', '==', data.date),
            where('period', '==', data.period),
            where('status', 'in', ['pending', 'unavailable'])
          );
          
          const exchangeSnapshot = await getDocs(exchangesQuery);
          
          if (!exchangeSnapshot.empty) {
            // Prendre le premier document trouvé
            const exchangeDoc = exchangeSnapshot.docs[0];
            existingExchangeId = exchangeDoc.id;
            existingExchangeCollection = COLLECTIONS.DIRECT_EXCHANGES;
            console.log("Échange trouvé par date/période dans direct_exchanges:", existingExchangeId);
          } else {
            // Si rien n'est trouvé dans direct_exchanges, chercher dans direct_replacements
            const replacementsQuery = query(
              collection(db, COLLECTIONS.DIRECT_REPLACEMENTS),
              where('originalUserId', '==', data.userId),
              where('date', '==', data.date),
              where('period', '==', data.period),
              where('status', 'in', ['pending', 'unavailable'])
            );
            
            const replacementSnapshot = await getDocs(replacementsQuery);
            
            if (!replacementSnapshot.empty) {
              const replacementDoc = replacementSnapshot.docs[0];
              existingExchangeId = replacementDoc.id;
              existingExchangeCollection = COLLECTIONS.DIRECT_REPLACEMENTS;
              console.log("Échange trouvé par date/période dans direct_replacements:", existingExchangeId);
            } else {
              // Si rien n'est trouvé dans direct_replacements, chercher dans shift_exchanges
              const shiftExchangesQuery = query(
                collection(db, 'shift_exchanges'),
                where('userId', '==', data.userId),
                where('date', '==', data.date),
                where('period', '==', data.period),
                where('status', 'in', ['pending', 'unavailable'])
              );
              
              const shiftExchangeSnapshot = await getDocs(shiftExchangesQuery);
              
              if (!shiftExchangeSnapshot.empty) {
                const shiftExchangeDoc = shiftExchangeSnapshot.docs[0];
                existingExchangeId = shiftExchangeDoc.id;
                existingExchangeCollection = 'shift_exchanges';
                console.log("Échange trouvé par date/période dans shift_exchanges:", existingExchangeId);
              }
            }
          }
        } catch (error) {
          console.error("Erreur lors de la recherche d'échange par date/période:", error);
        }
      }
      
      // Si un échange existe déjà, mettre à jour ses options
      if (existingExchangeId) {
        console.log("Mise à jour de l'échange existant:", existingExchangeId, 
                   "Collection:", existingExchangeCollection || "à déterminer",
                   "Types d'opération sélectionnés:", sanitizedTypes);
        
        try {
          // Si la collection n'est pas déterminée, essayer de la déterminer
          if (!existingExchangeCollection) {
            existingExchangeCollection = getCollectionByOperationType(data.operationType || 'exchange');
          }
          
          // Si la collection n'est pas déterminée, utiliser DIRECT_EXCHANGES par défaut
          if (!existingExchangeCollection) {
            console.log("Collection non déterminée, utilisation de DIRECT_EXCHANGES par défaut");
            existingExchangeCollection = COLLECTIONS.DIRECT_EXCHANGES;
          }
          
          console.log(`Vérification du document dans la collection ${existingExchangeCollection}:`, existingExchangeId);
          
          // Vérifier que le document existe réellement
          let exchangeRef;
          let exchangeDoc;
          
          try {
            exchangeRef = doc(db, existingExchangeCollection, existingExchangeId);
            exchangeDoc = await getDoc(exchangeRef);
          } catch (error) {
            console.error("Erreur lors de la création de la référence au document:", error);
            console.error("Détails:", { existingExchangeCollection, existingExchangeId });
            
            // Utiliser une collection par défaut en cas d'erreur
            console.log("Utilisation de DIRECT_EXCHANGES comme collection de secours");
            existingExchangeCollection = COLLECTIONS.DIRECT_EXCHANGES;
            exchangeRef = doc(db, existingExchangeCollection, existingExchangeId);
            exchangeDoc = await getDoc(exchangeRef);
          }
          
          if (exchangeDoc.exists()) {
            console.log(`Document trouvé dans la collection ${existingExchangeCollection}`);
            
            // Mettre à jour le commentaire et les operationTypes
            await updateDoc(exchangeRef, { 
              comment: data.comment,
              lastModified: serverTimestamp(),
              // Mettre à jour directement les operationTypes pour s'assurer que les options désélectionnées sont bien supprimées
              operationTypes: sanitizedTypes
            });
            
            // Mettre à jour les options de l'échange
            // Note: updateOptions est toujours appelé pour maintenir la compatibilité avec le reste du code
            await updateOptions(existingExchangeId, sanitizedTypes);
            
            result.exchangeId = existingExchangeId;
          } else {
            console.warn(`Le document ${existingExchangeId} n'existe pas dans la collection ${existingExchangeCollection}`);
            
            // Vérifier dans les autres collections
            let documentFound = false;
            const possibleCollections = [
              COLLECTIONS.DIRECT_EXCHANGES, // Vérifier d'abord dans direct_exchanges car tous les échanges y sont maintenant
              COLLECTIONS.DIRECT_REPLACEMENTS,
              'shift_exchanges' // Bourse aux gardes
            ];
            
            console.log("Document non trouvé dans la collection initiale, recherche dans d'autres collections:", possibleCollections);
            
            for (const collection of possibleCollections) {
              if (collection === existingExchangeCollection) continue; // Déjà vérifié
              
              try {
                console.log(`Tentative de recherche dans la collection ${collection}`);
                const alternativeRef = doc(db, collection, existingExchangeId);
                const alternativeDoc = await getDoc(alternativeRef);
              
                if (alternativeDoc.exists()) {
                  console.log(`Document trouvé dans la collection alternative ${collection}`);
                  documentFound = true;
                  existingExchangeCollection = collection;
                  
                  // Mettre à jour le document trouvé
                  await updateDoc(alternativeRef, { 
                    comment: data.comment,
                    lastModified: serverTimestamp(),
                    operationTypes: sanitizedTypes
                  });
                  
                  // Mettre à jour les options de l'échange
                  await updateOptions(existingExchangeId, sanitizedTypes);
                  
                  result.exchangeId = existingExchangeId;
                  break;
                }
              } catch (error) {
                console.error(`Erreur lors de la recherche dans la collection ${collection}:`, error);
                // Continuer avec la prochaine collection
              }
            }
            
            // Si le document n'est trouvé dans aucune collection, créer un nouvel échange
            if (!documentFound) {
              console.log("Document non trouvé dans aucune collection, création d'un nouvel échange");
              
              // Préparer les données d'échange
              const exchangeData = {
                userId: data.userId,
                date: data.date,
                period: data.period,
                shiftType: data.shiftType,
                timeSlot: data.timeSlot,
                comment: data.comment
              };
              
              // Créer l'échange combiné
              result = await createCombinedExchange(exchangeData, sanitizedTypes);
            }
          }
        } catch (error) {
          console.error("Erreur lors de la recherche/mise à jour du document:", error);
          
          // En cas d'erreur, créer un nouvel échange
          console.log("Création d'un nouvel échange après échec de la mise à jour");
          
          // Préparer les données d'échange
          const exchangeData = {
            userId: data.userId,
            date: data.date,
            period: data.period,
            shiftType: data.shiftType,
            timeSlot: data.timeSlot,
            comment: data.comment
          };
          
          // Créer l'échange combiné
          result = await createCombinedExchange(exchangeData, sanitizedTypes);
        }
      } 
      // Sinon, créer un nouvel échange
      else {
        console.log("Création d'un nouvel échange combiné");
        
        // Préparer les données d'échange
        const exchangeData = {
          userId: data.userId,
          date: data.date,
          period: data.period,
          shiftType: data.shiftType,
          timeSlot: data.timeSlot,
          comment: data.comment
        };
        
        // Créer l'échange combiné
        result = await createCombinedExchange(exchangeData, sanitizedTypes);
      }
      
      // Vérifier si nous devons supprimer un remplacement existant
      // qui n'est plus sélectionné
      if (data.existingReplacementId && !sanitizedTypes.includes('replacement')) {
        console.log("Suppression du remplacement existant car l'option a été désélectionnée:", data.existingReplacementId);
        
        if (options?.removeExchange) {
          console.log("Utilisation de removeExchange pour supprimer le remplacement");
          await options.removeExchange(data.existingReplacementId, 'replacement');
        } else {
          // Suppression directe si removeExchange n'est pas fourni
          try {
            console.log("Suppression directe du remplacement (pas de callback removeExchange fourni)");
            const replacementRef = doc(db, COLLECTIONS.DIRECT_REPLACEMENTS, data.existingReplacementId);
            // Utiliser delete au lieu de update pour assurer une suppression complète
            await deleteDoc(replacementRef);
            console.log("Remplacement supprimé avec succès");
          } catch (error) {
            console.error("Erreur lors de la suppression du remplacement:", error);
          }
        }
      }
      
      // Construire le message de succès
      const operationMessages = [];
      if (sanitizedTypes.includes('exchange')) operationMessages.push('échange');
      if (sanitizedTypes.includes('give')) operationMessages.push('cession');
      if (sanitizedTypes.includes('replacement')) operationMessages.push('remplaçant');
      
      // Appeler le callback de succès
      options?.onSuccess?.(
        data.exchangeId
          ? `Proposition mise à jour avec succès (${operationMessages.join(', ')})`
          : `Proposition ajoutée avec succès (${operationMessages.join(', ')})`
      );
      
      options?.onComplete?.();
      return result;
    }
    
    // Retourner un objet vide par défaut
    return {};
  } catch (error) {
    console.error('Erreur lors de la soumission de l\'échange direct:', error);
    
    // Appeler le callback d'erreur
    options?.onError?.(
      `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`
    );
    
    options?.onComplete?.();
    throw error;
  }
};
