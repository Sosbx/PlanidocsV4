import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import { DIRECT_EXCHANGE_PROPOSALS } from './directExchange/directProposalOperations';

/**
 * Corrige une proposition d'échange spécifique dans Firebase
 * @param proposalId ID de la proposition à corriger
 * @param correctData Données correctes à appliquer
 */
export const fixExchangeProposal = async (
  proposalId: string,
  correctData: {
    date: string;
    period: 'M' | 'AM' | 'S';
    shiftType?: string;
    timeSlot?: string;
  }
): Promise<void> => {
  try {
    console.log(`Correction de la proposition d'échange ${proposalId} avec les données:`, correctData);
    
    // Récupérer la proposition
    const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalId);
    const proposalDoc = await getDoc(proposalRef);
    
    if (!proposalDoc.exists()) {
      throw new Error(`Proposition ${proposalId} non trouvée`);
    }
    
    const proposal = proposalDoc.data();
    console.log('Données actuelles de la proposition:', proposal);
    
    // Vérifier si la proposition a des gardes proposées
    if (!proposal.proposedShifts || !Array.isArray(proposal.proposedShifts) || proposal.proposedShifts.length === 0) {
      throw new Error('La proposition ne contient pas de gardes proposées');
    }
    
    // Créer une copie des gardes proposées
    const updatedProposedShifts = [...proposal.proposedShifts];
    
    // Trouver la garde à corriger (première garde par défaut)
    const shiftToUpdate = updatedProposedShifts[0];
    
    // Afficher les données avant la correction
    console.log('Garde avant correction:', shiftToUpdate);
    
    // Appliquer les corrections
    shiftToUpdate.date = correctData.date;
    shiftToUpdate.period = correctData.period;
    
    if (correctData.shiftType) {
      shiftToUpdate.shiftType = correctData.shiftType;
    }
    
    if (correctData.timeSlot) {
      shiftToUpdate.timeSlot = correctData.timeSlot;
    }
    
    // Afficher les données après la correction
    console.log('Garde après correction:', shiftToUpdate);
    
    // Mettre à jour la proposition dans Firebase
    await updateDoc(proposalRef, {
      proposedShifts: updatedProposedShifts
    });
    
    console.log(`Proposition ${proposalId} corrigée avec succès`);
  } catch (error) {
    console.error('Erreur lors de la correction de la proposition:', error);
    throw error;
  }
};

/**
 * Corrige la proposition spécifique mentionnée dans le problème
 * (Garde du 19 mai 2025, période de soir)
 */
export const fixSpecificProposal = async (): Promise<void> => {
  try {
    console.log('Recherche de la proposition problématique...');
    
    // Créer une requête pour trouver les propositions avec la date incorrecte (2025-01-01)
    const proposalsRef = collection(db, DIRECT_EXCHANGE_PROPOSALS);
    const q = query(
      proposalsRef,
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    
    console.log(`${snapshot.size} propositions trouvées au total`);
    
    // Variables pour suivre la proposition trouvée
    let foundProposal = false;
    let proposalId = '';
    
    // Parcourir les propositions pour trouver celle avec la date incorrecte
    for (const doc of snapshot.docs) {
      const proposal = doc.data();
      
      // Vérifier si la proposition a des gardes proposées
      if (proposal.proposedShifts && Array.isArray(proposal.proposedShifts) && proposal.proposedShifts.length > 0) {
        // Parcourir les gardes proposées
        for (const shift of proposal.proposedShifts) {
          // Vérifier si c'est la garde problématique (date 2025-01-01 et période AM mais timeSlot de soir)
          if (
            shift.date === '2025-01-01' && 
            shift.period === 'AM' && 
            shift.timeSlot && 
            shift.timeSlot.includes('20:00')
          ) {
            console.log('Proposition problématique trouvée:', {
              id: doc.id,
              shift
            });
            
            foundProposal = true;
            proposalId = doc.id;
            
            // Corriger la proposition
            await fixExchangeProposal(doc.id, {
              date: '2025-05-19', // Date correcte (19 mai au lieu du 1er janvier)
              period: 'S',        // Période correcte (Soir au lieu de AM)
              shiftType: shift.shiftType,
              timeSlot: shift.timeSlot
            });
            
            break;
          }
        }
      }
      
      if (foundProposal) break;
    }
    
    if (!foundProposal) {
      console.log('Aucune proposition problématique trouvée avec les critères spécifiés');
      
      // Rechercher des propositions avec des incohérences entre période et horaire
      console.log('Recherche de propositions avec des incohérences entre période et horaire...');
      
      for (const doc of snapshot.docs) {
        const proposal = doc.data();
        
        // Vérifier si la proposition a des gardes proposées
        if (proposal.proposedShifts && Array.isArray(proposal.proposedShifts) && proposal.proposedShifts.length > 0) {
          // Parcourir les gardes proposées
          for (const shift of proposal.proposedShifts) {
            // Vérifier les incohérences
            const hasMorningInconsistency = shift.period === 'AM' && shift.timeSlot && shift.timeSlot.includes('08:00');
            const hasAfternoonInconsistency = shift.period === 'M' && shift.timeSlot && shift.timeSlot.includes('13:00');
            const hasEveningInconsistency = shift.period === 'AM' && shift.timeSlot && shift.timeSlot.includes('20:00');
            
            if (hasMorningInconsistency || hasAfternoonInconsistency || hasEveningInconsistency) {
              console.log('Proposition avec incohérence trouvée:', {
                id: doc.id,
                shift
              });
              
              // Déterminer la période correcte
              let correctPeriod: 'M' | 'AM' | 'S';
              
              if (shift.timeSlot && shift.timeSlot.includes('08:00')) {
                correctPeriod = 'M';
              } else if (shift.timeSlot && shift.timeSlot.includes('13:00')) {
                correctPeriod = 'AM';
              } else if (shift.timeSlot && shift.timeSlot.includes('20:00')) {
                correctPeriod = 'S';
              } else {
                // Si impossible de déterminer, conserver la période actuelle
                correctPeriod = shift.period as 'M' | 'AM' | 'S';
              }
              
              // Corriger la proposition
              await fixExchangeProposal(doc.id, {
                date: shift.date, // Conserver la date
                period: correctPeriod, // Corriger la période
                shiftType: shift.shiftType,
                timeSlot: shift.timeSlot
              });
              
              foundProposal = true;
              proposalId = doc.id;
              break;
            }
          }
        }
        
        if (foundProposal) break;
      }
    }
    
    if (foundProposal) {
      console.log(`Proposition ${proposalId} corrigée avec succès`);
    } else {
      console.log('Aucune proposition problématique trouvée');
    }
  } catch (error) {
    console.error('Erreur lors de la correction de la proposition spécifique:', error);
    throw error;
  }
};
