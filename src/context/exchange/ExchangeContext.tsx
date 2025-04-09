import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShiftExchange, ExchangeType, ExchangeFilters, ShiftPeriod } from '../../types/exchange';
import { getShiftExchanges } from '../../lib/firebase/shifts';
import { getDirectExchanges } from '../../lib/firebase/directExchange';
import { useAuth } from '../../features/auth/hooks';

/**
 * Type pour le contexte d'échange
 */
interface ExchangeContextType {
  exchanges: ShiftExchange[];
  directExchanges: ShiftExchange[];
  loading: boolean;
  error: string | null;
  filters: ExchangeFilters;
  setFilters: React.Dispatch<React.SetStateAction<ExchangeFilters>>;
  refreshExchanges: () => Promise<void>;
  activeExchangeType: ExchangeType;
  setActiveExchangeType: (type: ExchangeType) => void;
}

const defaultFilters: ExchangeFilters = {
  showOwnShifts: true,
  showMyInterests: false,
  showDesiderata: true,
  hidePrimaryDesiderata: false,
  hideSecondaryDesiderata: false,
  filterPeriod: 'all'
};

const ExchangeContext = createContext<ExchangeContextType | undefined>(undefined);

/**
 * Provider pour le contexte d'échange
 * Gère les échanges de gardes (bourse aux gardes et échanges directs)
 */
export const ExchangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [directExchanges, setDirectExchanges] = useState<ShiftExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExchangeFilters>(defaultFilters);
  const [activeExchangeType, setActiveExchangeType] = useState<ExchangeType>('bag');

  /**
   * Charge les échanges depuis la base de données
   */
  const loadExchanges = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Charger les échanges de la bourse aux gardes
      const bagExchanges = await getShiftExchanges();
      
      // Ajouter le type d'échange (pour la compatibilité avec le code existant)
      const formattedBagExchanges = bagExchanges.map(exchange => {
        // Convertir la période en ShiftPeriod
        const period = exchange.period as unknown as ShiftPeriod;
        
        return {
          ...exchange,
          period,
          exchangeType: 'bag' as ExchangeType,
          operationType: 'exchange' as 'exchange' | 'give' | 'replacement'
        };
      });
      
      setExchanges(formattedBagExchanges);
      
      try {
        // Charger les échanges directs (si la fonction existe)
        const directExchangesData = await getDirectExchanges();
        setDirectExchanges(directExchangesData);
      } catch (directError) {
        console.error('Error loading direct exchanges (this might be expected if the function is not implemented yet):', directError);
        // Ne pas définir d'erreur globale ici, car c'est peut-être attendu
        setDirectExchanges([]);
      }
    } catch (error) {
      console.error('Error loading exchanges:', error);
      setError('Erreur lors du chargement des échanges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExchanges();
  }, [user]);

  /**
   * Rafraîchit les échanges
   */
  const refreshExchanges = async () => {
    await loadExchanges();
  };

  return (
    <ExchangeContext.Provider value={{
      exchanges,
      directExchanges,
      loading,
      error,
      filters,
      setFilters,
      refreshExchanges,
      activeExchangeType,
      setActiveExchangeType
    }}>
      {children}
    </ExchangeContext.Provider>
  );
};

/**
 * Hook pour accéder au contexte d'échange
 */
export const useExchange = () => {
  const context = useContext(ExchangeContext);
  if (context === undefined) {
    throw new Error('useExchange must be used within an ExchangeProvider');
  }
  return context;
};
