import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUsers } from '../../../features/auth/hooks';
import { getDesiderata } from '../../../lib/firebase/desiderata';
import { calculatePercentages } from '../../../utils/planningUtils';
import PlanningPreview from '../components/PlanningPreview';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

const ValidatedPlanningsPage: React.FC = () => {
  const { users } = useUsers();
  const { config } = usePlanningConfig();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [planningData, setPlanningData] = useState<{
    selections: Record<string, 'primary' | 'secondary' | null>;
    validatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtrer uniquement les utilisateurs ayant validé leur planning
  const validatedUsers = users.filter(user => user.hasValidatedPlanning);

  const currentUser = validatedUsers.find(user => user.id === selectedUserId);

  useEffect(() => {
    // Sélectionner automatiquement le premier utilisateur au chargement
    if (validatedUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(validatedUsers[0].id);
    }
  }, [validatedUsers, selectedUserId]);

  useEffect(() => {
    const loadPlanning = async () => {
      if (!currentUser) {
        setPlanningData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await getDesiderata(currentUser.id);
        if (data?.validatedAt) {
          setPlanningData({
            selections: data.selections,
            validatedAt: data.validatedAt
          });
        }
      } catch (error) {
        console.error('Error loading planning:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlanning();
  }, [currentUser]);

  const handleUserChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUserId(event.target.value);
  };
  
  const goToPrevious = () => {
    const currentIndex = validatedUsers.findIndex(user => user.id === selectedUserId);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : validatedUsers.length - 1;
    setSelectedUserId(validatedUsers[newIndex].id);
  };

  const goToNext = () => {
    const currentIndex = validatedUsers.findIndex(user => user.id === selectedUserId);
    const newIndex = currentIndex < validatedUsers.length - 1 ? currentIndex + 1 : 0;
    setSelectedUserId(validatedUsers[newIndex].id);
  };

  if (!config.isConfigured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Planning non configuré</h2>
          <p className="text-yellow-700">
            Le planning doit être configuré avant de pouvoir visualiser les desiderata.
          </p>
        </div>
      </div>
    );
  }

  if (validatedUsers.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Aucun planning validé</h2>
          <p className="text-yellow-700">
            Aucun utilisateur n'a encore validé son planning.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Plannings Validés</h1>
        <div className="flex items-center">
          <div className="inline-flex items-center">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Médecin précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <select
              value={selectedUserId}
              onChange={handleUserChange}
              className="block w-64 pl-4 pr-10 py-2 mx-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            >
              {validatedUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.lastName} {user.firstName}
                </option>
              ))}
            </select>
            <ChevronDown className="h-5 w-5 text-gray-400 pointer-events-none absolute right-5" />
            <button
              onClick={goToNext}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Médecin suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        planningData && (
          <PlanningPreview
            user={{
              firstName: currentUser.firstName,
              lastName: currentUser.lastName
            }}
            selections={planningData.selections}
            validatedAt={planningData.validatedAt}
            startDate={config.startDate}
            endDate={config.endDate}
            primaryLimit={config.primaryDesiderataLimit}
            secondaryLimit={config.secondaryDesiderataLimit}
          />
        )
      )}
    </div>
  );
};

export default ValidatedPlanningsPage;
