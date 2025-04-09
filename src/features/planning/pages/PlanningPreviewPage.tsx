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
import type { User } from '../../../features/users/types';

const PlanningPreviewPage: React.FC = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { config } = usePlanningConfig();
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
        // Récupérer les données de l'utilisateur directement depuis Firestore
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          throw new Error('Utilisateur non trouvé');
        }
        const userData = userDoc.data() as User;

        // Récupérer les desiderata
        const desiderataData = await getDesiderata(userId);
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
  }, [userId]);

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
