import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { getCollectionName } from '../../../utils/collectionUtils';
import { useAssociation } from '../../../context/association/AssociationContext';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { useUsers } from '../../../features/auth/hooks/useUsers';
import { eachDayOfInterval, format } from 'date-fns';
import { calculateDesiderataStats, calculateDoctorStats } from '../utils/statsCalculations';
import type { DesiderataStats, DoctorStats, PeriodAnalysis, StatsFilter } from '../types';
import type { Selections } from '../../../types/planning';

export function useDesiderataStatistics(filter?: StatsFilter) {
  const { currentAssociation } = useAssociation();
  const { config } = usePlanningConfig();
  const { users } = useUsers();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDesiderata, setAllDesiderata] = useState<Record<string, Selections>>({});
  
  // Filtrer les utilisateurs de l'association courante
  const associationUsers = useMemo(() => {
    return users.filter(user => 
      user.roles?.isUser && 
      (!user.associations || user.associations.includes(currentAssociation))
    );
  }, [users, currentAssociation]);
  
  // Charger tous les desiderata de l'association
  useEffect(() => {
    const loadDesiderata = async () => {
      if (!config.isConfigured || associationUsers.length === 0) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const collectionName = getCollectionName('desiderata', currentAssociation);
        const desiderataSnapshot = await getDocs(collection(db, collectionName));
        
        const desiderataData: Record<string, Selections> = {};
        desiderataSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.selections) {
            desiderataData[doc.id] = data.selections;
          }
        });
        
        setAllDesiderata(desiderataData);
      } catch (err) {
        console.error('Error loading desiderata:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    
    loadDesiderata();
  }, [config.isConfigured, currentAssociation, associationUsers]);
  
  // Calculer les statistiques par jour
  const dailyStats = useMemo(() => {
    if (!config.isConfigured || associationUsers.length === 0) return [];
    
    const startDate = filter?.startDate || config.startDate;
    const endDate = filter?.endDate || config.endDate;
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map(date => {
      const stats = calculateDesiderataStats(date, allDesiderata, associationUsers.length);
      
      // Appliquer les filtres
      if (filter?.showOnlyHolidays && !stats.isHoliday) return null;
      if (filter?.showOnlyWeekends && !stats.isWeekend) return null;
      if (filter?.minPercentage && stats.overallPercentage < filter.minPercentage) return null;
      
      return stats;
    }).filter(Boolean) as DesiderataStats[];
  }, [config, allDesiderata, associationUsers, filter]);
  
  // Calculer les statistiques par médecin
  const doctorStats = useMemo(() => {
    if (!config.isConfigured || associationUsers.length === 0) return [];
    
    return associationUsers.map(user => {
      const selections = allDesiderata[user.id] || {};
      return calculateDoctorStats(
        user.id,
        user,
        selections,
        config.startDate,
        config.endDate
      );
    }).sort((a, b) => b.totalDesiderata - a.totalDesiderata);
  }, [config, allDesiderata, associationUsers]);
  
  // Analyser la période
  const periodAnalysis = useMemo((): PeriodAnalysis | null => {
    if (!config.isConfigured || associationUsers.length === 0) return null;
    
    const participatingUsers = Object.keys(allDesiderata).length;
    const participationRate = associationUsers.length > 0 
      ? Math.round((participatingUsers / associationUsers.length) * 100) 
      : 0;
    
    const totalDesiderata = Object.values(allDesiderata).reduce(
      (sum, selections) => sum + Object.keys(selections).length, 
      0
    );
    
    const averagePerUser = participatingUsers > 0 
      ? Math.round((totalDesiderata / participatingUsers) * 10) / 10 
      : 0;
    
    // Trouver les jours critiques (> 60% d'indisponibilité)
    const criticalDays = dailyStats
      .filter(day => day.overallPercentage > 60)
      .sort((a, b) => b.overallPercentage - a.overallPercentage)
      .slice(0, 10);
    
    // Analyser les fêtes
    const christmasStats = dailyStats.find(d => d.date.includes('-12-24') || d.date.includes('-12-25'));
    const newYearStats = dailyStats.find(d => d.date.includes('-12-31') || d.date.includes('-01-01'));
    
    return {
      periodId: config.associationId || '',
      startDate: config.startDate,
      endDate: config.endDate,
      associationId: currentAssociation,
      totalUsers: associationUsers.length,
      participationRate,
      averageDesiderataPerUser: averagePerUser,
      criticalDays,
      holidayAnalysis: {
        christmas: christmasStats 
          ? { unavailable: christmasStats.totalUnavailable, percentage: christmasStats.overallPercentage }
          : { unavailable: 0, percentage: 0 },
        newYear: newYearStats
          ? { unavailable: newYearStats.totalUnavailable, percentage: newYearStats.overallPercentage }
          : { unavailable: 0, percentage: 0 },
        otherHolidays: dailyStats
          .filter(d => d.isHoliday && !d.date.includes('-12-24') && !d.date.includes('-12-25') 
            && !d.date.includes('-12-31') && !d.date.includes('-01-01'))
          .map(d => ({
            date: d.date,
            name: d.dayOfWeek,
            unavailable: d.totalUnavailable,
            percentage: d.overallPercentage
          }))
      }
    };
  }, [config, dailyStats, associationUsers, allDesiderata, currentAssociation]);
  
  return {
    loading,
    error,
    dailyStats,
    doctorStats,
    periodAnalysis,
    totalUsers: associationUsers.length,
    association: currentAssociation,
    periodInfo: config.isConfigured ? {
      startDate: config.startDate,
      endDate: config.endDate,
      totalDays: Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      totalCells: (Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1) * 3
    } : null,
    associationUsers // Passer les utilisateurs complets pour accéder aux statuts
  };
}