import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../features/auth/hooks';
import { HistoryFilters } from '../types';
import { firebaseTimestampToParisDate, toParisTime } from '../../../utils/timezoneUtils';

interface ProposedShift {
  id: string;
  date: string;
  period: string;
  shiftType: string;
  timeSlot: string;
  status: 'pourvue' | 'non_pourvue' | 'remplaçant';
  receiver?: string;
  receiverId?: string;
  interestedCount: number;
  comment?: string;
  validatedAt?: Date;
}

interface ReceivedShift {
  id: string;
  date: string;
  period: string;
  shiftType: string;
  timeSlot: string;
  originalOwner: string;
  originalOwnerId: string;
  exchangeType: 'échange' | 'cession';
  comment?: string;
  validatedAt?: Date;
}

interface BagUserHistory {
  proposedShifts: ProposedShift[];
  receivedShifts: ReceivedShift[];
}

export const useBagUserHistory = (filters: HistoryFilters) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<BagUserHistory>({
    proposedShifts: [],
    receivedShifts: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);

  useEffect(() => {
    const fetchUserHistory = async () => {
      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Vérifier d'abord si le planning BAG est validé
        const bagConfigRef = doc(db, 'config', 'bag_phase_config');
        const bagConfigDoc = await getDoc(bagConfigRef);
        
        if (!bagConfigDoc.exists()) {
          setIsValidated(false);
          setLoading(false);
          return;
        }

        const bagConfig = bagConfigDoc.data();
        
        // Ne montrer l'historique que si la phase est 'completed' et validée
        if (bagConfig.phase !== 'completed' || !bagConfig.isValidated) {
          setIsValidated(false);
          setLoading(false);
          return;
        }

        setIsValidated(true);

        // 2. Récupérer la période de planning active
        const periodsRef = doc(db, 'config', 'planning_periods');
        const periodsDoc = await getDoc(periodsRef);
        
        let activePeriod = null;
        if (periodsDoc.exists()) {
          const periods = periodsDoc.data();
          activePeriod = periods.currentPeriod;
        }

        // 3. Récupérer tous les échanges BAG de l'utilisateur
        const exchangesRef = collection(db, 'shift_exchanges');
        
        // Gardes proposées par l'utilisateur
        const proposedQuery = query(
          exchangesRef,
          where('userId', '==', user.id)
        );
        
        const proposedSnapshot = await getDocs(proposedQuery);
        const proposedShifts: ProposedShift[] = [];

        for (const docSnapshot of proposedSnapshot.docs) {
          const exchange = docSnapshot.data();
          
          // Vérifier si la garde est dans la période active
          if (activePeriod) {
            const exchangeDate = new Date(exchange.date);
            const startDate = activePeriod.startDate instanceof Date 
              ? activePeriod.startDate 
              : firebaseTimestampToParisDate(activePeriod.startDate);
            const endDate = activePeriod.endDate instanceof Date 
              ? activePeriod.endDate 
              : firebaseTimestampToParisDate(activePeriod.endDate);
            
            if (exchangeDate < startDate || exchangeDate > endDate) {
              continue; // Ignorer les gardes hors période
            }
          }

          // Déterminer le statut de la garde
          let status: 'pourvue' | 'non_pourvue' | 'remplaçant' = 'non_pourvue';
          let receiver = undefined;
          let receiverId = undefined;

          if (exchange.status === 'validated' && exchange.validatedBy) {
            status = 'pourvue';
            receiverId = exchange.validatedBy;
            
            // Récupérer le nom du receveur
            const receiverDoc = await getDoc(doc(db, 'users', receiverId));
            if (receiverDoc.exists()) {
              const receiverData = receiverDoc.data();
              receiver = `${receiverData.firstName} ${receiverData.lastName}`;
            }
          } else if (exchange.operationTypes?.includes('replacement')) {
            status = 'remplaçant';
          }

          proposedShifts.push({
            id: docSnapshot.id,
            date: exchange.date,
            period: exchange.period,
            shiftType: exchange.shiftType,
            timeSlot: exchange.timeSlot || '',
            status,
            receiver,
            receiverId,
            interestedCount: exchange.interestedUsers?.length || 0,
            comment: exchange.comment,
            validatedAt: exchange.validatedAt ? firebaseTimestampToParisDate(exchange.validatedAt) : undefined
          });
        }

        // 4. Récupérer les gardes reçues par l'utilisateur
        const receivedShifts: ReceivedShift[] = [];
        
        // Récupérer depuis l'historique des échanges
        const historyRef = collection(db, 'exchange_history');
        const historyQuery = query(
          historyRef,
          where('newUserId', '==', user.id)
        );
        
        const historySnapshot = await getDocs(historyQuery);
        
        for (const docSnapshot of historySnapshot.docs) {
          const historyEntry = docSnapshot.data();
          
          // Vérifier si c'est un échange BAG
          // Si pas de source, vérifier le status completed
          if (historyEntry.source && historyEntry.source !== 'bag') continue;
          if (historyEntry.status !== 'completed') continue;
          
          // Vérifier la période
          if (activePeriod) {
            const exchangeDate = new Date(historyEntry.date);
            const startDate = activePeriod.startDate instanceof Date 
              ? activePeriod.startDate 
              : firebaseTimestampToParisDate(activePeriod.startDate);
            const endDate = activePeriod.endDate instanceof Date 
              ? activePeriod.endDate 
              : firebaseTimestampToParisDate(activePeriod.endDate);
            
            if (exchangeDate < startDate || exchangeDate > endDate) {
              continue;
            }
          }

          // Récupérer le nom du donneur original
          let originalOwner = 'Inconnu';
          if (historyEntry.originalUserId) {
            const ownerDoc = await getDoc(doc(db, 'users', historyEntry.originalUserId));
            if (ownerDoc.exists()) {
              const ownerData = ownerDoc.data();
              originalOwner = `${ownerData.firstName} ${ownerData.lastName}`;
            }
          }

          receivedShifts.push({
            id: docSnapshot.id,
            date: historyEntry.date,
            period: historyEntry.period,
            shiftType: historyEntry.shiftType,
            timeSlot: historyEntry.timeSlot || '',
            originalOwner,
            originalOwnerId: historyEntry.originalUserId,
            exchangeType: historyEntry.isPermutation ? 'échange' : 'cession',
            comment: historyEntry.comment,
            validatedAt: historyEntry.exchangedAt ? firebaseTimestampToParisDate(historyEntry.exchangedAt) : undefined
          });
        }

        // 5. Appliquer les filtres
        let filteredProposed = [...proposedShifts];
        let filteredReceived = [...receivedShifts];

        // Filtre par date
        if (filters.startDate) {
          const startTime = toParisTime(filters.startDate);
          filteredProposed = filteredProposed.filter(shift => 
            new Date(shift.date).getTime() >= startTime
          );
          filteredReceived = filteredReceived.filter(shift => 
            new Date(shift.date).getTime() >= startTime
          );
        }

        if (filters.endDate) {
          const endTime = toParisTime(filters.endDate) + (24 * 60 * 60 * 1000 - 1);
          filteredProposed = filteredProposed.filter(shift => 
            new Date(shift.date).getTime() <= endTime
          );
          filteredReceived = filteredReceived.filter(shift => 
            new Date(shift.date).getTime() <= endTime
          );
        }

        // Filtre par terme de recherche
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          filteredProposed = filteredProposed.filter(shift =>
            shift.shiftType.toLowerCase().includes(searchLower) ||
            shift.period.toLowerCase().includes(searchLower) ||
            (shift.receiver && shift.receiver.toLowerCase().includes(searchLower))
          );
          filteredReceived = filteredReceived.filter(shift =>
            shift.shiftType.toLowerCase().includes(searchLower) ||
            shift.period.toLowerCase().includes(searchLower) ||
            shift.originalOwner.toLowerCase().includes(searchLower)
          );
        }

        // Trier par date
        filteredProposed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        filteredReceived.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setHistory({
          proposedShifts: filteredProposed,
          receivedShifts: filteredReceived
        });

      } catch (err) {
        console.error('Error fetching BAG user history:', err);
        setError('Erreur lors de la récupération de l\'historique');
      } finally {
        setLoading(false);
      }
    };

    fetchUserHistory();
  }, [user, filters]);

  return { history, loading, error, isValidated };
};