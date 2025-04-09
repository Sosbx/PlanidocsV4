import { useCallback, useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { ShiftExchange, GeneratedPlanning, ShiftAssignment } from '../types/planning';
import { useAuth } from './useAuth';

interface ConflictResult {
  hasConflict: boolean;
  conflictDetails?: {
    date: string;
    period: string;
    shiftType: string;
  };
}

export default function useConflictCheck(exchanges: ShiftExchange[] = []) {
  const { user } = useAuth();
  
  // Fonction pour vérifier les conflits
  const checkForConflict = useCallback(
    async (exchange: ShiftExchange): Promise<ConflictResult> => {
      if (!user) return { hasConflict: false };

      try {
        const planningDoc = await getDoc(doc(db, 'generated_plannings', user.id));
        if (!planningDoc.exists()) return { hasConflict: false };

        const planning = planningDoc.data() as GeneratedPlanning;
        const assignmentKey = `${exchange.date}-${exchange.period}`;

        const conflictAssignment = planning.assignments[assignmentKey];

        if (conflictAssignment) {
          return {
            hasConflict: true,
            conflictDetails: {
              date: exchange.date,
              period: exchange.period,
              shiftType: conflictAssignment.shiftType,
            },
          };
        }

        return { hasConflict: false };
      } catch (error) {
        console.error('Error checking for conflicts:', error);
        return { hasConflict: false };
      }
    },
    [user]
  );
  
  // Générer un état pour chaque échange et utilisateur intéressé
  const [conflictStates, setConflictStates] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Référence aux derniers échanges traités pour éviter les boucles infinies
  const previousExchangesRef = useRef('');
  
  // Vérifier tous les conflits potentiels
  useEffect(() => {
    // Fonction pour créer une clé de cache unique basée sur les échanges actuels
    const getExchangesHash = () => {
      return exchanges.map(e => 
        `${e.id}:${e.interestedUsers?.join(',') || 'none'}`
      ).join('|');
    };
    
    const currentExchangesHash = getExchangesHash();
    
    // Vérifier si les échanges ont réellement changé de manière significative
    // Si le hash est le même, aucun besoin de recalculer les conflits
    if (previousExchangesRef.current === currentExchangesHash) {
      return;
    }
    
    // Mettre à jour le hash pour le prochain rendu
    previousExchangesRef.current = currentExchangesHash;
    
    const checkAllConflicts = async () => {
      if (!user || !exchanges.length) {
        setConflictStates({});
        setLoading(false);
        return;
      }

      setLoading(true);
      const newConflictStates: Record<string, Record<string, boolean>> = {};

      try {
        // Pour tous les échanges avec des utilisateurs intéressés
        for (const exchange of exchanges) {
          // Ignorer les échanges sans utilisateurs intéressés
          if (!exchange.interestedUsers?.length) continue;
          
          // Initialiser l'entrée pour cet échange
          newConflictStates[exchange.id] = {};
          
          // Charger les plannings de tous les utilisateurs intéressés
          const interestedUsersPromises = exchange.interestedUsers.map(async (userId) => {
            const planningDoc = await getDoc(doc(db, 'generated_plannings', userId));
            if (!planningDoc.exists()) return { userId, hasConflict: false };
            
            const planning = planningDoc.data() as GeneratedPlanning;
            const assignmentKey = `${exchange.date}-${exchange.period}`;
            // Vérifier si l'utilisateur a une garde à cette date et période
            const assignment = planning.assignments[assignmentKey];
            const hasAssignment = assignment !== undefined;
            
            // Vérification approfondie: un conflit existe seulement si l'utilisateur a une garde valide avec shiftType
            const hasConflict = hasAssignment && assignment && 
                               typeof assignment === 'object' && 
                               assignment.shiftType && 
                               typeof assignment.shiftType === 'string';
            
            // Log désactivé pour éviter de spammer la console
            /*
            if (hasConflict) {
              console.log(`📊 Conflit détecté pour ${userId} sur ${exchange.date}-${exchange.period}:`, {
                assignmentType: assignment ? typeof assignment : 'undefined',
                shiftType: assignment?.shiftType
              });
            }
            */
            
            return { userId, hasConflict };
          });
          
          const results = await Promise.all(interestedUsersPromises);
          
          // Mettre à jour les états de conflit pour cet échange
          results.forEach(({ userId, hasConflict }) => {
            newConflictStates[exchange.id][userId] = hasConflict;
          });
        }

        // Mettre à jour l'état avec tous les conflits détectés
        setConflictStates(newConflictStates);
      } catch (error) {
        console.error('Error checking for all conflicts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Vérifier les conflits immédiatement
    checkAllConflicts();
  }, [exchanges, user]);

  return { checkForConflict, conflictStates, loading };
};