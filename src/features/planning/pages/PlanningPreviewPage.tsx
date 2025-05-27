import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getDesiderata } from '../../../lib/firebase/desiderata';
import { doc, getDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import { useAuth } from '../../../features/auth/hooks';
import { PlanningPreview } from '../components';
import type { Selections, PeriodSelection } from '../types';
import { LoadingSpinner } from '../../../components/common';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { useAssociation } from '../../../context/association/AssociationContext';
import type { User } from '../../../features/users/types';
import { getCollectionName } from '../../../lib/firebase/users';
import { ASSOCIATIONS } from '../../../constants/associations';

const PlanningPreviewPage: React.FC = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { config } = usePlanningConfig();
  const { currentAssociation } = useAssociation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planningData, setPlanningData] = useState<{
    user: { firstName: string; lastName: string };
    selections: Selections;
    validatedAt: string;
  } | null>(null);

  useEffect(() => {
    const loadPlanning = async () => {
      if (!userId) return;
      
      try {
        // Récupérer les données de l'utilisateur directement depuis Firestore en utilisant la collection appropriée pour l'association
        const usersCollection = getCollectionName('users', currentAssociation);
        console.log(`Recherche de l'utilisateur ${userId} dans la collection ${usersCollection}`);
        
        const userDoc = await getDoc(doc(db, usersCollection, userId));
        if (!userDoc.exists()) {
          // Si l'utilisateur n'est pas trouvé dans la collection de l'association actuelle, essayons de le trouver dans la collection par défaut
          if (currentAssociation !== ASSOCIATIONS.RIVE_DROITE) {
            console.log(`Utilisateur non trouvé dans ${usersCollection}, recherche dans users`);
            const defaultUserDoc = await getDoc(doc(db, 'users', userId));
            if (!defaultUserDoc.exists()) {
              throw new Error(`Utilisateur non trouvé dans les collections ${usersCollection} et users`);
            }
            // Utilisateur trouvé dans la collection par défaut
            const userData = defaultUserDoc.data() as User;
            console.log(`Utilisateur trouvé dans la collection users`);
            return userData;
          } else {
            throw new Error(`Utilisateur non trouvé dans la collection ${usersCollection}`);
          }
        }
        const userData = userDoc.data() as User;

        // Récupérer les desiderata avec l'association courante
        console.log(`Récupération des désiderata pour l'utilisateur ${userId} de l'association ${currentAssociation}`);
        const desiderataData = await getDesiderata(userId, currentAssociation);
        if (!desiderataData || !desiderataData.validatedAt) {
          throw new Error('Planning non trouvé ou non validé');
        }

        // Transformer les données pour qu'elles correspondent au type Selections
        const transformedSelections: Selections = {};
        Object.entries(desiderataData.selections).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            // Si c'est déjà un objet PeriodSelection, on le garde tel quel
            transformedSelections[key] = value as PeriodSelection;
          } else {
            // Sinon, on le transforme en objet PeriodSelection
            transformedSelections[key] = { type: value as 'primary' | 'secondary' | null };
          }
        });

        setPlanningData({
          user: {
            firstName: userData.firstName,
            lastName: userData.lastName
          },
          selections: transformedSelections,
          validatedAt: desiderataData.validatedAt
        });
      } catch (err) {
        console.error('Error loading planning:', err);
        setError('Impossible de charger le planning');
      } finally {
        setLoading(false);
      }
    };

    loadPlanning();
  }, [userId, currentAssociation]); // Ajouter currentAssociation comme dépendance pour recharger les desiderata quand l'association change

  if (!currentUser?.roles.isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-medium text-red-800">Accès non autorisé</h2>
          <p className="mt-2 text-sm text-red-700">
            Vous n'avez pas les droits nécessaires pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !planningData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-medium text-red-800">Erreur</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Retour
        </button>
      </div>

      <PlanningPreview
        user={planningData.user}
        selections={planningData.selections}
        validatedAt={planningData.validatedAt}
        startDate={config.startDate}
        endDate={config.endDate}
      />
    </div>
  );
};

export default PlanningPreviewPage;
