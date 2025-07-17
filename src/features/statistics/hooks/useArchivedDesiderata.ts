import { useState, useEffect } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { COLLECTIONS } from '../../../utils/collectionUtils';
import { useAssociation } from '../../../context/association/AssociationContext';
import { eachDayOfInterval, format, subYears, isSameYear } from 'date-fns';
import { calculateDesiderataStats } from '../utils/statsCalculations';
import type { DesiderataStats } from '../types';
import type { ArchivedDesiderata } from '../../../types/planning';

export function useArchivedDesiderata(currentYearStart: Date, currentYearEnd: Date) {
  const { currentAssociation } = useAssociation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousYearStats, setPreviousYearStats] = useState<DesiderataStats[]>([]);
  
  useEffect(() => {
    const loadArchivedData = async () => {
      if (!currentAssociation) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Déterminer l'année précédente
        const previousYearStart = subYears(currentYearStart, 1);
        const previousYearEnd = subYears(currentYearEnd, 1);
        
        // Requête pour récupérer les desiderata archivés de l'année précédente
        const archivedQuery = query(
          collection(db, COLLECTIONS.ARCHIVED_DESIDERATA),
          where('associationId', '==', currentAssociation),
          where('archivedAt', '>=', previousYearStart),
          where('archivedAt', '<=', previousYearEnd),
          orderBy('archivedAt', 'asc')
        );
        
        const snapshot = await getDocs(archivedQuery);
        
        if (snapshot.empty) {
          setPreviousYearStats([]);
          setLoading(false);
          return;
        }
        
        // Regrouper les desiderata archivés par période
        const archivedByPeriod = new Map<string, ArchivedDesiderata[]>();
        
        snapshot.forEach(doc => {
          const data = doc.data() as ArchivedDesiderata;
          const periodKey = `${formatParisDate(data.periodStart, 'yyyy-MM-dd')}_${formatParisDate(data.periodEnd, 'yyyy-MM-dd')}`;
          
          if (!archivedByPeriod.has(periodKey)) {
            archivedByPeriod.set(periodKey, []);
          }
          archivedByPeriod.get(periodKey)!.push(data);
        });
        
        // Calculer les statistiques pour chaque jour de l'année précédente
        const allStats: DesiderataStats[] = [];
        
        archivedByPeriod.forEach((archivedData, periodKey) => {
          const [startStr, endStr] = periodKey.split('_');
          const periodStart = new Date(startStr);
          const periodEnd = new Date(endStr);
          
          // Obtenir tous les desiderata de cette période
          const allDesiderata: Record<string, ArchivedDesiderata['selections']> = {};
          let totalUsers = 0;
          
          archivedData.forEach(archive => {
            if (archive.selections) {
              allDesiderata[archive.userId] = archive.selections;
            }
            // Compter le nombre total d'utilisateurs uniques
            totalUsers = Math.max(totalUsers, archive.totalUsers || 0);
          });
          
          // Si on a le nombre total d'utilisateurs dans l'archive, l'utiliser
          if (totalUsers === 0) {
            totalUsers = Object.keys(allDesiderata).length;
          }
          
          // Calculer les stats pour chaque jour de cette période
          const days = eachDayOfInterval({ 
            start: periodStart, 
            end: periodEnd 
          });
          
          days.forEach(date => {
            // Vérifier que le jour est dans l'année précédente
            if (isSameYear(date, previousYearStart)) {
              const stats = calculateDesiderataStats(date, allDesiderata, totalUsers);
              allStats.push(stats);
            }
          });
        });
        
        // Trier par date
        allStats.sort((a, b) => a.date.localeCompare(b.date));
        
        setPreviousYearStats(allStats);
      } catch (err) {
        console.error('Error loading archived desiderata:', err);
        setError('Erreur lors du chargement des données archivées');
      } finally {
        setLoading(false);
      }
    };
    
    loadArchivedData();
  }, [currentAssociation, currentYearStart, currentYearEnd]);
  
  return {
    loading,
    error,
    previousYearStats
  };
}