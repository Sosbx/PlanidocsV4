import React, { useState, useEffect } from 'react';
import { ShiftExchange } from '../../types/exchange';
import { User } from '../../types/users';
import ExchangeProposalsManager from './ExchangeProposalsManager';
import { useFirestoreDocument } from '../../hooks/useFirestoreCache';

/**
 * Exemple d'utilisation du composant ExchangeProposalsManager
 * Ce composant peut être intégré dans une page d'échange ou dans un modal
 */
const ExchangeProposalsExample: React.FC<{ exchangeId: string }> = ({ exchangeId }) => {
  const [exchange, setExchange] = useState<ShiftExchange | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Utilisation du hook de cache Firestore pour charger l'échange
  const { data: exchangeData, loading: exchangeLoading, error: exchangeError } = useFirestoreDocument<ShiftExchange>(
    'direct_exchanges',
    exchangeId,
    { 
      cacheDuration: 5 * 60 * 1000, // 5 minutes de cache
      subscribe: true // Abonnement aux changements en temps réel
    }
  );

  // Charger les utilisateurs
  useEffect(() => {
    if (!exchangeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Si l'échange est déjà chargé par le hook useFirestoreDocument
      if (exchangeData) {
        setExchange(exchangeData);
      }
      
      // Charger les utilisateurs (dans une application réelle, vous auriez probablement un hook ou un service pour cela)
      const loadUsers = async () => {
        try {
          const usersCollection = await fetch('/api/users'); // Exemple fictif
          const usersData = await usersCollection.json();
          setUsers(usersData);
        } catch (err) {
          console.error('Erreur lors du chargement des utilisateurs:', err);
          setError('Impossible de charger les utilisateurs. Veuillez réessayer.');
        } finally {
          setLoading(false);
        }
      };
      
      loadUsers();
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err);
      setError('Impossible de charger les données. Veuillez réessayer.');
      setLoading(false);
    }
  }, [exchangeId, exchangeData]);

  // Gérer le changement de statut d'une proposition
  const handleProposalStatusChange = () => {
    // Recharger l'échange pour mettre à jour son statut si nécessaire
    // Dans une application réelle, vous pourriez utiliser un hook personnalisé ou un contexte
    console.log('Statut de proposition modifié, mise à jour de l\'échange...');
  };

  // Afficher un message de chargement
  if (loading || exchangeLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Chargement...
      </div>
    );
  }

  // Afficher un message d'erreur
  if (error || exchangeError) {
    return (
      <div className="p-4 text-center text-red-500">
        {error || (exchangeError instanceof Error ? exchangeError.message : 'Erreur inconnue')}
      </div>
    );
  }

  // Si l'échange n'est pas trouvé
  if (!exchange && !exchangeData) {
    return (
      <div className="p-4 text-center text-gray-500">
        Échange non trouvé
      </div>
    );
  }
  
  // Utiliser les données du cache si l'état local n'est pas encore défini
  const displayExchange = exchange || exchangeData;

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">
          Détails de l'échange
        </h1>
        <p className="text-sm text-gray-600">
          {displayExchange?.date} - {displayExchange?.period}
        </p>
      </div>
      
      {/* Intégration du composant ExchangeProposalsManager */}
      <div className="mt-6">
        <ExchangeProposalsManager
          exchangeId={exchangeId}
          users={users}
          onProposalStatusChange={handleProposalStatusChange}
        />
      </div>
    </div>
  );
};

export default ExchangeProposalsExample;
