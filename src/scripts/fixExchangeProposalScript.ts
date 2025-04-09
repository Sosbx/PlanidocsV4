import { fixExchangeProposal, fixSpecificProposal } from '../lib/firebase/fixExchangeProposal';

/**
 * Script pour corriger une proposition d'échange spécifique dans Firebase
 * 
 * Usage:
 * - Pour corriger la proposition spécifique mentionnée dans le problème:
 *   node fixExchangeProposalScript.js
 * 
 * - Pour corriger une proposition avec un ID spécifique:
 *   node fixExchangeProposalScript.js <proposalId>
 */

const main = async () => {
  try {
    // Récupérer l'ID de la proposition depuis les arguments de la ligne de commande
    const proposalId = process.argv[2];
    
    if (proposalId) {
      console.log(`Correction de la proposition avec l'ID: ${proposalId}`);
      
      // Données correctes pour la garde du 19 mai (période de soir)
      const correctData = {
        date: '2025-05-19', // Date correcte (19 mai au lieu du 1er janvier)
        period: 'S' as 'M' | 'AM' | 'S',  // Période correcte (Soir au lieu de AM)
        shiftType: 'SS',    // Type de garde (inchangé)
        timeSlot: '20:00 - 23:59' // Horaire (inchangé)
      };
      
      await fixExchangeProposal(proposalId, correctData);
      console.log('Proposition corrigée avec succès!');
    } else {
      console.log('Correction de la proposition spécifique mentionnée dans le problème...');
      await fixSpecificProposal();
      console.log('Opération terminée. Veuillez vérifier les logs pour plus de détails.');
    }
  } catch (error) {
    console.error('Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  }
};

// Exécuter le script
main().catch(console.error);
