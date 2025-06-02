import { db } from './config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { PeriodSelection } from '../../types/planning';
import { ASSOCIATIONS } from '../../constants/associations';
import { getCollectionName } from './desiderata';

interface HolidayBlock {
  blockChristmas: boolean;
  blockNewYear: boolean;
}

/**
 * Supprime les desiderata des dates bloquées pour un utilisateur
 * Gère les deux collections : desiderata et desiderata_RG
 */
export async function removeBlockedDatesDesiderata(
  userId: string,
  newBlocks: HolidayBlock,
  currentAssociation: 'RD' | 'RG' = 'RD'
): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];

  console.log(`=== Début de la suppression des desiderata bloqués ===`);
  console.log(`Utilisateur: ${userId}`);
  console.log(`Association courante: ${currentAssociation}`);
  console.log(`Blocages à appliquer:`, newBlocks);

  try {
    // Déterminer quelles collections vérifier
    const collectionsToCheck = currentAssociation === ASSOCIATIONS.RIVE_GAUCHE 
      ? [getCollectionName('desiderata', ASSOCIATIONS.RIVE_GAUCHE), getCollectionName('desiderata', ASSOCIATIONS.RIVE_DROITE)]
      : [getCollectionName('desiderata', ASSOCIATIONS.RIVE_DROITE), getCollectionName('desiderata', ASSOCIATIONS.RIVE_GAUCHE)];

    for (const collection of collectionsToCheck) {
      try {
        // Récupérer les desiderata actuels de l'utilisateur
        const desiderataRef = doc(db, collection, userId);
        const desiderataDoc = await getDoc(desiderataRef);

        if (!desiderataDoc.exists()) {
          console.log(`Aucun desiderata trouvé pour ${userId} dans ${collection}`);
          continue;
        }

        const data = desiderataDoc.data();
        const selections = data.selections as Record<string, PeriodSelection>;
        const isValidated = !!data.validatedAt;

        if (!selections || Object.keys(selections).length === 0) {
          console.log(`Aucune sélection trouvée pour ${userId} dans ${collection}`);
          continue;
        }

        console.log(`Desiderata trouvés pour ${userId} dans ${collection}:`, Object.keys(selections).length, 'sélections', isValidated ? '(validés)' : '(non validés)');

        // Filtrer les dates à supprimer
        const updatedSelections: Record<string, PeriodSelection> = {};
        let hasChanges = false;

        for (const [dateKey, selection] of Object.entries(selections)) {
          // Les clés de date sont au format YYYY-MM-DD-PERIOD (ex: 2025-12-24-AM)
          const parts = dateKey.split('-');
          if (parts.length < 3) {
            // Si le format n'est pas correct, conserver la sélection
            updatedSelections[dateKey] = selection;
            continue;
          }
          
          // Extraire la date sans la période (M, AM, S)
          const year = parts[0];
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);
          const dayMonth = `${day}-${month}`;
          let shouldRemove = false;

          // Vérifier si c'est une date de Noël bloquée
          if (newBlocks.blockChristmas && (dayMonth === '24-12' || dayMonth === '25-12')) {
            shouldRemove = true;
            const period = parts[3] || '';
            removed.push(`${dateKey} (Noël${period ? ' - ' + period : ''}) - ${collection}`);
          }

          // Vérifier si c'est le Nouvel An bloqué (31 décembre et 1er janvier)
          if (newBlocks.blockNewYear && (dayMonth === '31-12' || (dayMonth === '1-1' && year === parts[0]))) {
            shouldRemove = true;
            const period = parts[3] || '';
            const dateLabel = dayMonth === '31-12' ? '31 déc' : '1er jan';
            removed.push(`${dateKey} (Nouvel An - ${dateLabel}${period ? ' - ' + period : ''}) - ${collection}`);
          }

          // Conserver seulement les sélections non bloquées
          if (!shouldRemove) {
            updatedSelections[dateKey] = selection;
          } else {
            hasChanges = true;
            console.log(`Suppression de la sélection ${dateKey} (${selection.type || 'type inconnu'}) pour ${userId} dans ${collection}`);
          }
        }

        // Mettre à jour la base de données si des changements ont été effectués
        if (hasChanges) {
          const updateData: any = {
            selections: updatedSelections,
            lastModified: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Préserver les champs existants importants
          if (data.validatedAt) {
            updateData.validatedAt = data.validatedAt;
          }
          if (data.userId) {
            updateData.userId = data.userId;
          }
          if (data.associationId) {
            updateData.associationId = data.associationId;
          }
          
          await updateDoc(desiderataRef, updateData);
          console.log(`Mise à jour des desiderata ${isValidated ? 'validés' : 'non validés'} pour ${userId} dans ${collection} effectuée`);
        }

      } catch (error) {
        const errorMsg = `Erreur lors du traitement de ${collection}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

  } catch (error) {
    const errorMsg = `Erreur générale lors de la suppression des desiderata bloqués: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
  }

  return { removed, errors };
}

/**
 * Vérifie si une date est bloquée pour un utilisateur
 */
export function isDateBlocked(
  date: Date,
  blocks: HolidayBlock | undefined
): boolean {
  if (!blocks) return false;

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dayMonth = `${day}-${month}`;

  // Vérifier Noël (24 et 25 décembre)
  if (blocks.blockChristmas && (dayMonth === '24-12' || dayMonth === '25-12')) {
    return true;
  }

  // Vérifier Nouvel An (31 décembre et 1er janvier)
  if (blocks.blockNewYear && (dayMonth === '31-12' || dayMonth === '1-1')) {
    return true;
  }

  return false;
}