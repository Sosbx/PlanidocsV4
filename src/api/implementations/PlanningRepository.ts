import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch, 
  query, 
  orderBy, 
  where,
  Timestamp,
  deleteDoc,
  addDoc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { IPlanningRepository, ArchivedPeriod, SimplePlanningPeriod } from '../interfaces/IPlanningRepository';
import { PlanningConfig, PlanningPeriod, GeneratedPlanning } from '../../types/planning';
import { getCollectionName, COLLECTIONS } from '../../utils/collectionUtils';
import { ASSOCIATIONS } from '../../constants/associations';
import { archiveDesiderata } from '../../lib/firebase/archiveDesiderata';
import { firebaseTimestampToParisDate } from '../../utils/timezoneUtils';

export class PlanningRepository implements IPlanningRepository {
  
  // Fonction pour obtenir le nom du document de configuration
  private getPlanningConfigDoc(associationId: string): string {
    if (associationId === ASSOCIATIONS.RIVE_DROITE) {
      return 'planning_config'; // Garder le nom original pour RD
    }
    return `planning_config_${associationId}`; // Ex: planning_config_RG
  }
  
  // Fonction pour obtenir le nom de la collection des périodes archivées
  private getArchivedPeriodsCollection(associationId: string): string {
    return getCollectionName('archived_planning_periods', associationId);
  }
  
  async getConfig(associationId: string): Promise<PlanningConfig | null> {
    try {
      const configDoc = this.getPlanningConfigDoc(associationId);
      const _docRef = doc(db, 'config', configDoc);
      const snapshot = await getDocs(query(collection(db, 'config'), where('__name__', '==', configDoc)));
      
      if (snapshot.empty) {
        return null;
      }
      
      const data = snapshot.docs[0].data();
      return {
        ...data,
        startDate: firebaseTimestampToParisDate(data.startDate),
        endDate: firebaseTimestampToParisDate(data.endDate),
        deadline: firebaseTimestampToParisDate(data.deadline),
        primaryDesiderataLimit: data.primaryDesiderataLimit || 0,
        secondaryDesiderataLimit: data.secondaryDesiderataLimit || 0,
        isConfigured: true,
        associationId
      } as PlanningConfig;
    } catch (error) {
      console.error(`Error getting config for association ${associationId}:`, error);
      return null;
    }
  }
  
  async updateConfig(associationId: string, config: PlanningConfig): Promise<void> {
    const configDoc = this.getPlanningConfigDoc(associationId);
    const configRef = doc(db, 'config', configDoc);
    
    await setDoc(configRef, {
      ...config,
      startDate: Timestamp.fromDate(config.startDate),
      endDate: Timestamp.fromDate(config.endDate),
      deadline: Timestamp.fromDate(config.deadline),
      associationId
    });
  }
  
  async deleteConfig(associationId: string): Promise<void> {
    const configDoc = this.getPlanningConfigDoc(associationId);
    const configRef = doc(db, 'config', configDoc);
    await deleteDoc(configRef);
  }
  
  subscribeToConfig(
    associationId: string, 
    callback: (config: PlanningConfig | null) => void
  ): () => void {
    const configDoc = this.getPlanningConfigDoc(associationId);
    
    const unsubscribe = onSnapshot(doc(db, 'config', configDoc), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        callback({
          ...data,
          startDate: firebaseTimestampToParisDate(data.startDate),
          endDate: firebaseTimestampToParisDate(data.endDate),
          deadline: firebaseTimestampToParisDate(data.deadline),
          primaryDesiderataLimit: data.primaryDesiderataLimit || 0,
          secondaryDesiderataLimit: data.secondaryDesiderataLimit || 0,
          isConfigured: true,
          associationId
        } as PlanningConfig);
      } else {
        callback(null);
      }
    });
    
    return unsubscribe;
  }
  
  async getArchivedPeriods(associationId: string): Promise<ArchivedPeriod[]> {
    try {
      const archivedCollection = this.getArchivedPeriodsCollection(associationId);
      
      const periodsQuery = query(
        collection(db, archivedCollection),
        orderBy('archivedAt', 'desc')
      );
      
      const periodsSnapshot = await getDocs(periodsQuery);
      return periodsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          config: {
            ...data.config,
            startDate: firebaseTimestampToParisDate(data.config.startDate),
            endDate: firebaseTimestampToParisDate(data.config.endDate),
            deadline: firebaseTimestampToParisDate(data.config.deadline),
            associationId
          },
          archivedAt: firebaseTimestampToParisDate(data.archivedAt),
          name: data.name,
          validatedDesiderataCount: data.validatedDesiderataCount || 0,
          associationId
        } as ArchivedPeriod;
      });
    } catch (error) {
      console.error(`Error loading archived periods for association ${associationId}:`, error);
      return [];
    }
  }
  
  async archivePeriod(
    associationId: string,
    config: PlanningConfig,
    validatedDesiderata: Record<string, any>,
    periodName: string,
    totalUsers: number
  ): Promise<string> {
    const archivedCollection = this.getArchivedPeriodsCollection(associationId);
    const archivedPeriodRef = doc(collection(db, archivedCollection));
    
    await setDoc(archivedPeriodRef, {
      config: {
        ...config,
        startDate: Timestamp.fromDate(config.startDate),
        endDate: Timestamp.fromDate(config.endDate),
        deadline: Timestamp.fromDate(config.deadline)
      },
      archivedAt: Timestamp.now(),
      name: periodName,
      associationId,
      validatedDesiderataCount: Object.keys(validatedDesiderata).length
    });
    
    // Stocker les desiderata validés dans une sous-collection
    const desiderataCollection = getCollectionName('desiderata', associationId);
    const desiderataCollectionRef = collection(archivedPeriodRef, desiderataCollection);
    const batch = writeBatch(db);
    
    Object.entries(validatedDesiderata).forEach(([userId, data]) => {
      batch.set(doc(desiderataCollectionRef, userId), data);
    });
    
    await batch.commit();
    
    // Archiver aussi dans la collection centralisée
    await archiveDesiderata(
      validatedDesiderata,
      config.startDate,
      config.endDate,
      associationId,
      totalUsers
    );
    
    return archivedPeriodRef.id;
  }
  
  async resetPlanningForAssociation(associationId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // 1. Supprimer la configuration actuelle
    const configDoc = this.getPlanningConfigDoc(associationId);
    const configRef = doc(db, 'config', configDoc);
    batch.delete(configRef);
    
    // 2. Supprimer tous les desiderata existants pour cette association
    const desiderataCollection = getCollectionName('desiderata', associationId);
    const desiderataSnapshot = await getDocs(collection(db, desiderataCollection));
    desiderataSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 3. Réinitialiser le statut de validation pour tous les utilisateurs
    const usersCollection = getCollectionName('users', associationId);
    // Récupérer TOUS les utilisateurs de la collection appropriée
    // Pas besoin de filtrer par associationId car getCollectionName retourne déjà la bonne collection
    const usersSnapshot = await getDocs(collection(db, usersCollection));
    
    // Réinitialiser hasValidatedPlanning pour TOUS les utilisateurs de cette collection
    usersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { hasValidatedPlanning: false });
    });
    
    // 4. Exécuter toutes les opérations
    await batch.commit();
  }
  
  // Planning periods methods
  async getPlanningPeriods(associationId: string): Promise<PlanningPeriod[]> {
    try {
      const periodsCollection = getCollectionName(COLLECTIONS.PLANNING_PERIODS, associationId);
      const snapshot = await getDocs(collection(db, periodsCollection));
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        startDate: firebaseTimestampToParisDate(doc.data().startDate),
        endDate: firebaseTimestampToParisDate(doc.data().endDate),
        status: doc.data().status,
        bagPhase: doc.data().bagPhase,
        isValidated: doc.data().isValidated,
        validatedAt: doc.data().validatedAt ? firebaseTimestampToParisDate(doc.data().validatedAt) : undefined
      }));
    } catch (error) {
      console.error(`Error getting planning periods for association ${associationId}:`, error);
      return [];
    }
  }
  
  async createPlanningPeriod(period: Omit<PlanningPeriod, 'id'>, associationId: string): Promise<string> {
    const periodsCollection = getCollectionName(COLLECTIONS.PLANNING_PERIODS, associationId);
    const docRef = await addDoc(collection(db, periodsCollection), {
      ...period,
      startDate: Timestamp.fromDate(period.startDate),
      endDate: Timestamp.fromDate(period.endDate),
      validatedAt: period.validatedAt ? Timestamp.fromDate(period.validatedAt) : null
    });
    return docRef.id;
  }
  
  async updatePlanningPeriod(periodId: string, updates: Partial<PlanningPeriod>, associationId: string): Promise<void> {
    const periodsCollection = getCollectionName(COLLECTIONS.PLANNING_PERIODS, associationId);
    const docRef = doc(db, periodsCollection, periodId);
    
    const updateData: any = { ...updates };
    if (updates.startDate) updateData.startDate = Timestamp.fromDate(updates.startDate);
    if (updates.endDate) updateData.endDate = Timestamp.fromDate(updates.endDate);
    if (updates.validatedAt) updateData.validatedAt = Timestamp.fromDate(updates.validatedAt);
    
    await updateDoc(docRef, updateData);
  }
  
  async deletePlanningPeriod(periodId: string, associationId: string): Promise<void> {
    const periodsCollection = getCollectionName(COLLECTIONS.PLANNING_PERIODS, associationId);
    const docRef = doc(db, periodsCollection, periodId);
    await deleteDoc(docRef);
  }
  
  async validateBagAndMergePeriods(_futurePeriodId: string, _associationId: string): Promise<void> {
    // TODO: Implémenter la fusion des périodes
    console.warn('validateBagAndMergePeriods: Non implémenté');
  }
  
  subscribeToPeriodsConfig(
    associationId: string, 
    callback: (data: { currentPeriod?: SimplePlanningPeriod; futurePeriod?: SimplePlanningPeriod | null }) => void
  ): () => void {
    const configPath = associationId === ASSOCIATIONS.RIVE_DROITE ? 'config' : `config_${associationId}`;
    const docRef = doc(db, configPath, 'planning_periods');
    
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const result: { currentPeriod?: SimplePlanningPeriod; futurePeriod?: SimplePlanningPeriod | null } = {};
        
        if (data.currentPeriod) {
          result.currentPeriod = {
            startDate: firebaseTimestampToParisDate(data.currentPeriod.startDate),
            endDate: firebaseTimestampToParisDate(data.currentPeriod.endDate)
          };
        }
        
        if (data.futurePeriod) {
          result.futurePeriod = {
            startDate: firebaseTimestampToParisDate(data.futurePeriod.startDate),
            endDate: firebaseTimestampToParisDate(data.futurePeriod.endDate)
          };
        } else {
          result.futurePeriod = null;
        }
        
        callback(result);
      } else {
        callback({});
      }
    });
  }
  
  subscribeToPlanningPeriods(associationId: string, callback: (periods: PlanningPeriod[]) => void): () => void {
    const periodsCollection = getCollectionName(COLLECTIONS.PLANNING_PERIODS, associationId);
    
    return onSnapshot(collection(db, periodsCollection), (snapshot) => {
      const periods: PlanningPeriod[] = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        startDate: firebaseTimestampToParisDate(doc.data().startDate),
        endDate: firebaseTimestampToParisDate(doc.data().endDate),
        status: doc.data().status,
        bagPhase: doc.data().bagPhase,
        isValidated: doc.data().isValidated,
        validatedAt: doc.data().validatedAt ? firebaseTimestampToParisDate(doc.data().validatedAt) : undefined
      }));
      
      callback(periods);
    });
  }
  
  async saveGeneratedPlanning(
    userId: string, 
    planning: GeneratedPlanning,
    periodId?: string,
    associationId: string = 'RD'
  ): Promise<void> {
    // Import dynamique pour éviter les dépendances circulaires
    const { saveGeneratedPlanning } = await import('../../lib/firebase/planning');
    await saveGeneratedPlanning(userId, planning, periodId, associationId);
  }
  
  async getGeneratedPlanning(
    userId: string,
    periodId?: string,
    associationId: string = 'RD'
  ): Promise<GeneratedPlanning | null> {
    try {
      const docRef = doc(db, getCollectionName(COLLECTIONS.GENERATED_PLANNINGS, associationId), userId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      const data = docSnap.data();
      if (!periodId) {
        // Retourner toutes les périodes
        return data as GeneratedPlanning;
      }
      
      // Retourner une période spécifique
      const periodData = data.periods?.[periodId];
      if (!periodData) return null;
      
      return {
        assignments: periodData.assignments || {},
        periodId
      } as GeneratedPlanning;
    } catch (error) {
      console.error('Error getting generated planning:', error);
      return null;
    }
  }
  
  async getAssignmentsByDate(date: string, associationId: string): Promise<Record<string, any>> {
    try {
      const planningsCollection = getCollectionName(COLLECTIONS.PLANNINGS, associationId);
      const snapshot = await getDocs(collection(db, planningsCollection));
      
      const assignmentsByUser: Record<string, any> = {};
      
      // Parcourir tous les documents de planning
      snapshot.docs.forEach(doc => {
        const userId = doc.id;
        const planningData = doc.data();
        
        // Supporter les deux structures : moderne et legacy
        let allAssignments: Record<string, any> = {};
        
        // Structure moderne : periods.{periodId}.assignments
        if (planningData.periods) {
          Object.values(planningData.periods).forEach((period: any) => {
            if (period.assignments) {
              allAssignments = { ...allAssignments, ...period.assignments };
            }
          });
        }
        
        // Structure legacy : assignments directement
        if (planningData.assignments) {
          allAssignments = { ...allAssignments, ...planningData.assignments };
        }
        
        // Filtrer les assignations pour la date donnée
        const dateAssignments: Record<string, any> = {};
        Object.entries(allAssignments).forEach(([key, assignment]) => {
          // Les clés sont au format "YYYY-MM-DD-PERIOD" 
          if (key.startsWith(date)) {
            dateAssignments[key] = assignment;
          }
        });
        
        // Si l'utilisateur a des assignations pour cette date, les ajouter
        if (Object.keys(dateAssignments).length > 0) {
          assignmentsByUser[userId] = dateAssignments;
        }
      });
      
      return assignmentsByUser;
    } catch (error) {
      console.error(`Erreur lors de la récupération des assignations pour la date ${date}:`, error);
      return {};
    }
  }
}

// Instance singleton
let planningRepository: PlanningRepository | null = null;

export const getPlanningRepository = (): PlanningRepository => {
  if (!planningRepository) {
    planningRepository = new PlanningRepository();
  }
  return planningRepository;
};