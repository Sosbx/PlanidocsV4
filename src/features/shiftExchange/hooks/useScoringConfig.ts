import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import type { ScoringConfig } from '../types/scoring';
import { DEFAULT_EQUITY_CONFIG } from '../types/scoring';

const SCORING_CONFIG_DOC = 'scoring_config';

/**
 * Hook pour gérer la configuration du système de scoring
 */
export const useScoringConfig = (associationId: string = 'RD') => {
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger la configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'associations', associationId, 'config', SCORING_CONFIG_DOC);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Gérer la migration des anciennes données
          if (!data.equity && data.coefficients) {
            // Ancienne structure, convertir
            const migratedConfig: ScoringConfig = {
              id: data.id,
              equity: DEFAULT_EQUITY_CONFIG,
              shiftScores: data.shiftScores || {},
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              updatedBy: data.updatedBy
            };
            setConfig(migratedConfig);
          } else {
            // Nouvelle structure ou structure incomplète
            const config: ScoringConfig = {
              ...data,
              equity: data.equity || DEFAULT_EQUITY_CONFIG,
              shiftScores: data.shiftScores || {}
            };
            setConfig(config);
          }
        } else {
          // Configuration par défaut
          const defaultConfig: ScoringConfig = {
            equity: DEFAULT_EQUITY_CONFIG,
            shiftScores: {}
          };
          setConfig(defaultConfig);
        }
      } catch (err) {
        console.error('Erreur lors du chargement de la configuration:', err);
        setError('Erreur lors du chargement de la configuration');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [associationId]);

  // Sauvegarder la configuration
  const saveConfig = async (newConfig: ScoringConfig) => {
    try {
      const docRef = doc(db, 'associations', associationId, 'config', SCORING_CONFIG_DOC);
      await setDoc(docRef, {
        ...newConfig,
        updatedAt: new Date(),
        updatedBy: 'admin' // TODO: Utiliser l'ID de l'utilisateur actuel
      });
      setConfig(newConfig);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de la configuration:', err);
      throw new Error('Erreur lors de la sauvegarde de la configuration');
    }
  };

  return {
    config,
    loading,
    error,
    saveConfig
  };
};