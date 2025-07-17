import React, { useState, useEffect } from 'react';
import { firebaseTimestampToParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { format } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PlanningPreview from './PlanningPreview';
import { ArchivedPeriod } from '../../../context/planning/PlanningContext';
import { Selections } from '../../../types/planning';

interface ArchivedPeriodDetailsProps {
  periodId: string;
}

interface UserWithDesiderata {
  id: string;
  firstName: string;
  lastName: string;
  selections: Selections;
  validatedAt: string;
}

const ArchivedPeriodDetails: React.FC<ArchivedPeriodDetailsProps> = ({ periodId }) => {
  const [period, setPeriod] = useState<ArchivedPeriod | null>(null);
  const [users, setUsers] = useState<UserWithDesiderata[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPeriodDetails = async () => {
      setLoading(true);
      try {
        // 1. Charger les détails de la période
        const periodDoc = await getDoc(doc(db, 'archived_planning_periods', periodId));
        if (!periodDoc.exists()) {
          console.error('Period not found');
          setLoading(false);
          return;
        }

        const periodData = periodDoc.data();
        const periodWithDates: ArchivedPeriod = {
          id: periodDoc.id,
          config: {
            ...periodData.config,
            startDate: firebaseTimestampToParisDate(periodData.config.startDate),
            endDate: firebaseTimestampToParisDate(periodData.config.endDate),
            deadline: firebaseTimestampToParisDate(periodData.config.deadline),
          },
          archivedAt: firebaseTimestampToParisDate(periodData.archivedAt),
          name: periodData.name,
          validatedDesiderataCount: periodData.validatedDesiderataCount || 0
        };
        setPeriod(periodWithDates);

        // 2. Charger les desiderata des utilisateurs depuis la sous-collection de la période archivée
        // Nous n'utilisons pas getAllDesiderata ici car nous voulons spécifiquement les desiderata
        // de cette période archivée, pas les desiderata actifs
        const desiderataSnapshot = await getDocs(collection(periodDoc.ref, 'desiderata'));
        const desiderataData = desiderataSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || doc.id,
            selections: data.selections || {},
            validatedAt: data.validatedAt || '',
            ...data
          };
        });

        // 3. Charger les informations des utilisateurs
        const usersWithDesiderata: UserWithDesiderata[] = [];
        for (const desiderata of desiderataData) {
          try {
            const userId = desiderata.userId || desiderata.id;
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              usersWithDesiderata.push({
                id: userDoc.id,
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                selections: desiderata.selections || {},
                validatedAt: desiderata.validatedAt || ''
              });
            }
          } catch (error) {
            console.error('Error loading user data:', error);
          }
        }

        setUsers(usersWithDesiderata.sort((a, b) => a.lastName.localeCompare(b.lastName)));
        if (usersWithDesiderata.length > 0) {
          setSelectedUserId(usersWithDesiderata[0].id);
        }
      } catch (error) {
        console.error('Error loading period details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (periodId) {
      loadPeriodDetails();
    }
  }, [periodId]);

  const selectedUser = users.find(user => user.id === selectedUserId);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!period) {
    return (
      <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-yellow-800 mb-2">Période non trouvée</h2>
        <p className="text-yellow-700">
          La période demandée n'a pas été trouvée.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">{period.name}</h3>
        <div className="text-sm text-gray-500">
          Archivé le {formatParisDate(period.archivedAt, 'dd MMMM yyyy', { locale: frLocale })}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">Période:</span>{' '}
          {formatParisDate(period.config.startDate, 'dd/MM/yyyy', { locale: frLocale })} - {formatParisDate(period.config.endDate, 'dd/MM/yyyy', { locale: frLocale })}
        </div>
        <div>
          <span className="font-medium">Date limite:</span>{' '}
          {formatParisDate(period.config.deadline, 'dd/MM/yyyy HH:mm', { locale: frLocale })}
        </div>
        <div>
          <span className="font-medium">Desiderata primaires:</span>{' '}
          {period.config.primaryDesiderataLimit}%
        </div>
        <div>
          <span className="font-medium">Desiderata secondaires:</span>{' '}
          {period.config.secondaryDesiderataLimit}%
        </div>
        <div className="col-span-2">
          <span className="font-medium">Réponses validées:</span>{' '}
          {period.validatedDesiderataCount}
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Aucun planning validé</h2>
          <p className="text-yellow-700">
            Aucun utilisateur n'a validé son planning pour cette période.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-medium">Plannings validés</h4>
            <div className="flex items-center">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="block w-64 pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.lastName} {user.firstName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedUser && (
            <PlanningPreview
              user={{
                firstName: selectedUser.firstName,
                lastName: selectedUser.lastName
              }}
              selections={selectedUser.selections}
              validatedAt={selectedUser.validatedAt}
              startDate={period.config.startDate}
              endDate={period.config.endDate}
              primaryLimit={period.config.primaryDesiderataLimit}
              secondaryLimit={period.config.secondaryDesiderataLimit}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ArchivedPeriodDetails;
