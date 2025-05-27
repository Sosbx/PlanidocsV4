# Feuille de route pour l'implémentation multi-association dans Planidocs

## Contexte et objectifs

### Situation actuelle
Planidocs est une application web React conçue pour la gestion des plannings médicaux. Actuellement, le site est dédié exclusivement à l'association "SOS Médecins Rive Droite" (SOS RD) avec son propre administrateur.

### Objectifs du projet
L'objectif est d'adapter la plateforme pour prendre en charge simultanément deux associations :
- **SOS Médecins Rive Droite** (SOS RD) - Association existante
- **SOS Médecins Rive Gauche** (SOS RG) - Nouvelle association à intégrer

### Fonctionnalités requises
1. Chaque association doit avoir :
   - Son propre administrateur
   - Sa propre gestion des désidérata
   - Sa propre gestion des plannings
   - Sa propre bourse aux gardes
   
2. Un système de super-administrateur qui aura accès aux deux associations pour dépannage

3. Possibilité d'échanges de garde entre les deux associations (fonctionnalité future)

## Principes directeurs

1. **Préservation de l'existant** : Ne pas perturber le fonctionnement actuel pour SOS RD
2. **Isolation des données** : Chaque association doit avoir ses propres collections de données
3. **Expérience utilisateur cohérente** : Interface utilisateur similaire pour les deux associations
4. **Évolutivité** : Architecture permettant d'ajouter facilement d'autres associations à l'avenir
5. **Sécurité** : Contrôle d'accès strict pour garantir que les utilisateurs ne voient que les données de leur association

## Architecture technique

### 1. Modèle de données

#### 1.1 Identification des associations

```typescript
// src/constants/associations.ts
export const ASSOCIATIONS = {
  RIVE_DROITE: 'RD',
  RIVE_GAUCHE: 'RG'
};

export const ASSOCIATION_NAMES = {
  [ASSOCIATIONS.RIVE_DROITE]: 'SOS Médecins Rive Droite',
  [ASSOCIATIONS.RIVE_GAUCHE]: 'SOS Médecins Rive Gauche'
};
```

#### 1.2 Modification du modèle utilisateur

```typescript
// src/types/common.ts
export interface BaseUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  associationId: string; // 'RD' pour Rive Droite, 'RG' pour Rive Gauche
  roles: {
    isAdmin: boolean;
    isUser: boolean;
    isManager: boolean;
    isSuperAdmin: boolean; // Nouveau rôle pour accéder aux deux associations
    // Autres rôles existants...
  };
  // Autres propriétés existantes...
}
```

### 2. Gestion du contexte d'association

```typescript
// src/context/association/AssociationContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/hooks';
import { ASSOCIATIONS, ASSOCIATION_NAMES } from '../../constants/associations';

interface AssociationContextType {
  currentAssociation: string;
  setCurrentAssociation: (association: string) => void;
  associationName: string;
  getCollectionName: (baseCollection: string) => string;
}

const AssociationContext = createContext<AssociationContextType | undefined>(undefined);

export const AssociationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentAssociation, setCurrentAssociation] = useState<string>(ASSOCIATIONS.RIVE_DROITE);

  // Définir l'association en fonction de l'utilisateur connecté
  useEffect(() => {
    if (user?.associationId) {
      setCurrentAssociation(user.associationId);
    }
  }, [user]);

  const associationName = ASSOCIATION_NAMES[currentAssociation] || ASSOCIATION_NAMES[ASSOCIATIONS.RIVE_DROITE];
  
  // Fonction utilitaire pour obtenir le nom de collection approprié
  const getCollectionName = (baseCollection: string): string => {
    if (currentAssociation === ASSOCIATIONS.RIVE_DROITE) {
      return baseCollection; // Pas de modification pour préserver l'existant
    }
    return `${baseCollection}_${currentAssociation}`; // Ex: "desiderata_RG"
  };

  return (
    <AssociationContext.Provider 
      value={{ 
        currentAssociation, 
        setCurrentAssociation, 
        associationName,
        getCollectionName
      }}
    >
      {children}
    </AssociationContext.Provider>
  );
};

export const useAssociation = () => {
  const context = useContext(AssociationContext);
  if (context === undefined) {
    throw new Error('useAssociation must be used within an AssociationProvider');
  }
  return context;
};
```

## Plan d'implémentation détaillé

### Phase 1 : Infrastructure de base (Jours 1-3)

#### Jour 1 : Mise en place des constantes et du contexte

1. Créer le fichier de constantes pour les associations
   - Définir les identifiants (RD, RG)
   - Définir les noms complets des associations

2. Créer l'interface utilisateur modifiée
   - Ajouter le champ `associationId` à l'interface `BaseUser`
   - Mettre à jour les types associés

3. Développer le contexte d'association
   - Créer le provider `AssociationContext`
   - Implémenter les hooks et fonctions utilitaires
   - Intégrer le provider dans l'arborescence des composants

#### Jour 2 : Intégration dans l'application

1. Modifier `App.tsx` pour intégrer le contexte d'association
   - Ajouter le provider `AssociationProvider` autour des composants principaux

2. Adapter la barre de navigation
   - Ajouter un indicateur visuel de l'association active
   - Préparer l'emplacement pour le sélecteur d'association (super-admin)

#### Jour 3 : Préparation des collections Firebase

1. Définir la stratégie de nommage des collections
   - Collections existantes pour SOS RD
   - Nouvelles collections avec suffixe "_RG" pour SOS RG

2. Créer les collections initiales pour SOS RG
   - `users_RG`
   - `desiderata_RG`
   - `planning_config_RG`

### Phase 2 : Adaptation des services Firebase (Jours 4-8)

#### Jour 4 : Service de gestion des désidérata

1. Modifier `src/lib/firebase/desiderata.ts`
   ```typescript
   // Ajouter cette fonction utilitaire
   const getCollectionName = (baseCollection: string, associationId: string = ASSOCIATIONS.RIVE_DROITE): string => {
     if (associationId === ASSOCIATIONS.RIVE_DROITE) {
       return baseCollection;
     }
     return `${baseCollection}_${associationId}`;
   };

   // Modifier les fonctions existantes
   export const getDesiderata = async (userId: string, associationId: string = ASSOCIATIONS.RIVE_DROITE) => {
     const collectionName = getCollectionName('desiderata', associationId);
     const docRef = doc(db, collectionName, userId);
     // ...
   };
   ```

2. Tester les modifications avec un utilisateur de test SOS RD

#### Jour 5 : Service de gestion des utilisateurs

1. Modifier `src/lib/firebase/users.ts`
   ```typescript
   export const getUsers = async (associationId: string = ASSOCIATIONS.RIVE_DROITE) => {
     const collectionName = getCollectionName('users', associationId);
     const q = query(collection(db, collectionName));
     // ...
   };

   export const createUser = async (userData: Omit<User, 'id'>, associationId: string = ASSOCIATIONS.RIVE_DROITE) => {
     const collectionName = getCollectionName('users', associationId);
     // Ajouter l'associationId aux données utilisateur
     const userWithAssociation = {
       ...userData,
       associationId
     };
     // ...
   };
   ```

2. Créer un utilisateur administrateur pour SOS RG

#### Jour 6 : Service de gestion des plannings

1. Modifier `src/lib/firebase/planning.ts`
   ```typescript
   export const getPlanningConfig = async (associationId: string = ASSOCIATIONS.RIVE_DROITE) => {
     const collectionName = getCollectionName('planning_config', associationId);
     // ...
   };

   export const savePlanningConfig = async (config: PlanningConfig, associationId: string = ASSOCIATIONS.RIVE_DROITE) => {
     const collectionName = getCollectionName('planning_config', associationId);
     // ...
   };
   ```

#### Jour 7 : Service de gestion des bourses aux gardes

1. Modifier `src/lib/firebase/shiftExchange.ts`
   ```typescript
   export const getAvailableShifts = async (associationId: string = ASSOCIATIONS.RIVE_DROITE) => {
     const collectionName = getCollectionName('shift_exchange', associationId);
     // ...
   };
   ```

#### Jour 8 : Autres services Firebase

1. Adapter les services restants selon le même modèle
2. Tester l'ensemble des services modifiés

### Phase 3 : Adaptation des composants pour les pages prioritaires (Jours 9-14)

#### Jour 9 : Page de désidérata (UserPage)

1. Modifier `src/features/users/pages/UserPage.tsx`
   ```typescript
   import { useAssociation } from '../../../context/association/AssociationContext';

   const UserPage = () => {
     const { currentAssociation, associationName } = useAssociation();
     
     // Modifier les appels aux services pour passer l'association
     useEffect(() => {
       const fetchData = async () => {
         const data = await getDesiderata(userId, currentAssociation);
         // ...
       };
       fetchData();
     }, [userId, currentAssociation]);
     
     // Ajouter un indicateur d'association dans l'interface
     return (
       <div>
         <div className="flex items-center justify-between mb-4">
           <h1 className="text-xl font-bold">Mes désidérata</h1>
           <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
             {associationName}
           </span>
         </div>
         {/* ... */}
       </div>
     );
   };
   ```

2. Tester avec un utilisateur de chaque association

#### Jour 10 : Page de configuration (AdminPage)

1. Modifier `src/pages/AdminPage.tsx`
   ```typescript
   import { useAssociation } from '../context/association/AssociationContext';

   const AdminPage = () => {
     const { currentAssociation, associationName } = useAssociation();
     
     // Modifier les appels aux services pour passer l'association
     useEffect(() => {
       const fetchConfig = async () => {
         const config = await getPlanningConfig(currentAssociation);
         // ...
       };
       fetchConfig();
     }, [currentAssociation]);
     
     // Ajouter un indicateur d'association dans l'interface
     return (
       <div>
         <div className="flex items-center justify-between mb-4">
           <h1 className="text-xl font-bold">Configuration</h1>
           <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
             {associationName}
           </span>
         </div>
         {/* ... */}
       </div>
     );
   };
   ```

#### Jour 11 : Page de gestion des utilisateurs (UsersManagementPage)

1. Modifier `src/pages/UsersManagementPage.tsx`
   ```typescript
   import { useAssociation } from '../context/association/AssociationContext';

   const UsersManagementPage = () => {
     const { currentAssociation, associationName } = useAssociation();
     
     // Modifier les appels aux services pour passer l'association
     useEffect(() => {
       const fetchUsers = async () => {
         const users = await getUsers(currentAssociation);
         // ...
       };
       fetchUsers();
     }, [currentAssociation]);
     
     // Ajouter un indicateur d'association dans l'interface
     return (
       <div>
         <div className="flex items-center justify-between mb-4">
           <h1 className="text-xl font-bold">Gestion des utilisateurs</h1>
           <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
             {associationName}
           </span>
         </div>
         {/* ... */}
       </div>
     );
   };
   ```

#### Jour 12 : Page de planning (PlanningPage)

1. Modifier `src/features/planning/pages/PlanningPage.tsx`
   ```typescript
   import { useAssociation } from '../../../context/association/AssociationContext';

   const PlanningPage = () => {
     const { currentAssociation, associationName } = useAssociation();
     
     // Modifier les appels aux services pour passer l'association
     useEffect(() => {
       const fetchPlanning = async () => {
         const planning = await getPlanning(currentAssociation);
         // ...
       };
       fetchPlanning();
     }, [currentAssociation]);
     
     // ...
   };
   ```

#### Jour 13 : Page de bourse aux gardes (ShiftExchangePage)

1. Modifier `src/features/shiftExchange/pages/ShiftExchangePage.tsx`
   ```typescript
   import { useAssociation } from '../../../context/association/AssociationContext';

   const ShiftExchangePage = () => {
     const { currentAssociation, associationName } = useAssociation();
     
     // Modifier les appels aux services pour passer l'association
     useEffect(() => {
       const fetchShifts = async () => {
         const shifts = await getAvailableShifts(currentAssociation);
         // ...
       };
       fetchShifts();
     }, [currentAssociation]);
     
     // ...
   };
   ```

#### Jour 14 : Autres composants et tests

1. Adapter les composants restants selon le même modèle
2. Tests complets des fonctionnalités pour les deux associations

### Phase 4 : Implémentation du super-administrateur (Jours 15-18)

#### Jour 15 : Modification du modèle utilisateur et des règles de sécurité

1. Ajouter le rôle `isSuperAdmin` dans Firebase
   ```javascript
   // Exemple de document utilisateur super-admin
   {
     "id": "super_admin_id",
     "email": "super.admin@example.com",
     "firstName": "Super",
     "lastName": "Admin",
     "associationId": "RD", // Association par défaut
     "roles": {
       "isAdmin": true,
       "isUser": true,
       "isSuperAdmin": true
     }
   }
   ```

2. Mettre à jour les règles de sécurité Firebase
   ```javascript
   service cloud.firestore {
     match /databases/{database}/documents {
       // Fonction pour vérifier l'accès à une association
       function hasAssociationAccess(associationId) {
         return request.auth.token.associationId == associationId ||
                request.auth.token.isSuperAdmin == true;
       }
       
       // Règles pour données spécifiques à l'association
       match /users/{userId} {
         allow read: if hasAssociationAccess(resource.data.associationId);
         // ...
       }
       
       match /users_RG/{userId} {
         allow read: if hasAssociationAccess('RG');
         // ...
       }
       
       // Autres règles similaires pour les autres collections
     }
   }
   ```

#### Jour 16 : Composant de sélection d'association

1. Créer `src/components/AssociationSelector.tsx`
   ```typescript
   import React from 'react';
   import { useAssociation } from '../context/association/AssociationContext';
   import { useAuth } from '../features/auth/hooks';
   import { ASSOCIATIONS, ASSOCIATION_NAMES } from '../constants/associations';

   const AssociationSelector = () => {
     const { user } = useAuth();
     const { currentAssociation, setCurrentAssociation } = useAssociation();
     
     // N'afficher que pour les super-admins
     if (!user?.roles?.isSuperAdmin) {
       return null;
     }
     
     return (
       <div className="ml-4">
         <select
           className="bg-blue-800 text-white border border-blue-700 rounded px-2 py-1 text-sm"
           value={currentAssociation}
           onChange={(e) => setCurrentAssociation(e.target.value)}
         >
           <option value={ASSOCIATIONS.RIVE_DROITE}>{ASSOCIATION_NAMES[ASSOCIATIONS.RIVE_DROITE]}</option>
           <option value={ASSOCIATIONS.RIVE_GAUCHE}>{ASSOCIATION_NAMES[ASSOCIATIONS.RIVE_GAUCHE]}</option>
         </select>
       </div>
     );
   };

   export default AssociationSelector;
   ```

2. Intégrer ce composant dans la barre de navigation
   ```typescript
   // src/components/Navbar.tsx
   import AssociationSelector from './AssociationSelector';

   const Navbar = () => {
     // ...
     return (
       <nav className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-50">
         <div className="flex items-center">
           {/* ... */}
           <div className="ml-2 px-2 py-1 bg-blue-800 rounded text-sm font-medium">
             {associationName}
           </div>
           <AssociationSelector />
           {/* ... */}
         </div>
       </nav>
     );
   };
   ```

#### Jour 17 : Adaptation des autorisations

1. Modifier `src/features/auth/hooks.ts` pour prendre en compte le super-admin
   ```typescript
   export const useHasPermission = (requiredRoles: string[]) => {
     const { user } = useAuth();
     
     if (!user) return false;
     
     // Le super-admin a toutes les permissions
     if (user.roles?.isSuperAdmin) return true;
     
     // Vérification normale des rôles
     return requiredRoles.some(role => user.roles?.[role]);
   };
   ```

#### Jour 18 : Tests du super-administrateur

1. Tester les fonctionnalités du super-administrateur
   - Basculer entre les associations
   - Accéder aux données des deux associations
   - Vérifier les restrictions pour les utilisateurs normaux

### Phase 5 : Échanges inter-associations (Jours 19-23)

#### Jour 19 : Conception du modèle de données pour les échanges inter-associations

1. Définir le modèle de données pour les échanges directs
   ```typescript
   // src/types/exchange.ts
   export interface DirectExchange {
     id: string;
     sourceShift: {
       userId: string;
       date: string;
       shift: string;
       associationId: string;
     };
     targetShift: {
       userId: string;
       date: string;
       shift: string;
       associationId: string;
     };
     status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
     createdAt: Timestamp;
     updatedAt: Timestamp;
     visibleToAssociations: string[]; // Liste des associations qui peuvent voir cet échange
   }
   ```

2. Créer une collection commune pour les échanges directs
   - Collection `direct_exchanges` accessible aux deux associations

#### Jour 20 : Service de gestion des échanges inter-associations

1. Créer `src/lib/firebase/directExchange.ts`
   ```typescript
   import { collection, addDoc, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
   import { db } from './config';
   import { ASSOCIATIONS } from '../../constants/associations';
   import type { DirectExchange } from '../../types/exchange';

   // Fonction pour créer un échange direct
   export const createDirectExchange = async (sourceShift, targetShift) => {
     try {
       const exchangeData: Omit<DirectExchange, 'id'> = {
         sourceShift,
         targetShift,
         status: 'pending',
         createdAt: serverTimestamp(),
         updatedAt: serverTimestamp(),
         visibleToAssociations: [sourceShift.associationId, targetShift.associationId]
       };

       const docRef = await addDoc(collection(db, 'direct_exchanges'), exchangeData);
       return { id: docRef.id, ...exchangeData };
     } catch (error) {
       console.error('Error creating direct exchange:', error);
       throw error;
     }
   };

   // Fonction pour récupérer les échanges directs pour un utilisateur
   export const getDirectExchangesForUser = async (userId: string, associationId: string) => {
     try {
       const q = query(
         collection(db, 'direct_exchanges'),
         where('visibleToAssociations', 'array-contains', associationId),
         where('status', '==', 'pending')
       );

       const querySnapshot = await getDocs(q);
       const exchanges: DirectExchange[] = [];

       querySnapshot.forEach((doc) => {
         const data = doc.data();
         if (data.sourceShift.userId === userId || data.targetShift.userId === userId) {
           exchanges.push({ id: doc.id, ...data } as DirectExchange);
         }
       });

       return exchanges;
     } catch (error) {
       console.error('Error getting direct exchanges:', error);
       throw error;
     }
   };

   // Autres fonctions pour gérer les échanges directs
   ```

#### Jour 21 : Interface utilisateur pour les échanges inter-associations

1. Modifier `src/features/exchange/pages/DirectExchangePage.tsx`
   ```typescript
   import { useAssociation } from '../../../context/association/AssociationContext';

   const DirectExchangePage = () => {
     const { currentAssociation, associationName } = useAssociation();
     const [otherAssociationShifts, setOtherAssociationShifts] = useState([]);
     
     // Charger les gardes disponibles des deux associations
     useEffect(() => {
       const fetchShifts = async () => {
         // Gardes de l'association courante
         const currentAssociationShifts = await getAvailableShifts(currentAssociation);
         
         // Gardes de l'autre association
         const otherAssociationId = 
           currentAssociation === ASSOCIATIONS.RIVE_DROITE 
             ? ASSOCIATIONS.RIVE_GAUCHE 
             : ASSOCIATIONS.RIVE_DROITE;
         const otherShifts = await getAvailableShifts(otherAssociationId);
         
         setOtherAssociationShifts(otherShifts);
         // ...
       };
       fetchShifts();
     }, [currentAssociation]);
     
     // Fonction pour proposer un échange
     const proposeExchange = async (sourceShift, targetShift) => {
       await createDirectExchange(sourceShift, targetShift);
       // ...
     };
     
     // ...
   };
   ```

#### Jour 22 : Notifications pour les échanges inter-associations

1. Modifier le service de notifications pour prendre en compte les échanges inter-associations
   ```typescript
   // src/lib/firebase/notifications.ts
   export const createExchangeNotification = async (exchange: DirectExchange) => {
     try {
       // Créer une notification pour le destinataire de la demande
       const targetUserNotification = {
         userId: exchange.targetShift.userId,
         type: 'exchange_request',
         message: `Vous avez reçu une demande d'échange de garde de ${exchange.sourceShift.associationId === 'RD' ? 'SOS RD' : 'SOS RG'}`,
         data: { exchangeId: exchange.id },
         read: false,
         createdAt: serverTimestamp()
       };
       
       // Utiliser la collection de notifications de l'association du destinataire
       const notificationCollection = 
         exchange.targetShift.associationId === ASSOCIATIONS.RIVE_DROITE
           ? 'notifications'
           : 'notifications_RG';
       
       await addDoc(collection(db, notificationCollection), targetUserNotification);
     } catch (error) {
       console.error('Error creating exchange notification:', error);
       throw error;
     }
   };
   ```

#### Jour 23 : Tests des échanges inter-associations

1. Tester le flux complet d'échange entre les deux associations
   - Proposer un échange depuis SOS RD vers SOS RG
   - Accepter l'échange depuis SOS RG
   - Vérifier la mise à jour des plannings dans les deux associations

### Phase 6 : Migration des données existantes (Jours 24-25)

#### Jour 24 : Script de migration pour les utilisateurs existants

1. Créer un script pour ajouter l'attribut `associationId` aux utilisateurs existants
   ```javascript
   // Script à exécuter dans Firebase Functions ou localement
   const admin = require('firebase-admin');
   admin.initializeApp();
   const db = admin.firestore();

   async function migrateUsers() {
     const usersSnapshot = await db.collection('users').get();
     
     const batch = db.batch();
     
     usersSnapshot.forEach(doc => {
       const userData = doc.data();
       if (!userData.associationId) {
         // Par défaut, tous les utilisateurs existants sont de SOS RD
         batch.update(doc.ref, { associationId: 'RD' });
       }
     });
     
     await batch.commit();
     console.log(`Migrated ${usersSnapshot.size} users`);
   }

   migrateUsers().catch(console.error);
   ```

#### Jour 25 : Vérification de la migration et tests

1. Vérifier que tous les utilisateurs ont bien l'attribut `associationId`
2. Tester l'application avec les données migrées

### Phase 7 : Déploiement et finalisation (Jours 26-30)

#### Jour 26 : Préparation du déploiement

1. Finaliser tous les tests
   - Tests unitaires
   - Tests d'intégration
   - Tests utilisateurs

2. Préparer la documentation
   - Guide d'utilisation pour les administrateurs
   - Guide d'utilisation pour les super-administrateurs

#### Jour 27 : Déploiement en pré-production

1. Déployer l'application en pré-production
2. Effectuer des tests finaux

#### Jour 28 : Déploiement en production

1. Déployer l'application en production
2. Surveiller les logs et les performances

#### Jour 29 : Formation des utilisateurs

1. Former les administrateurs de SOS RG
2. Former les super-administrateurs

#### Jour 30 : Suivi et ajustements

1. Recueillir les retours des utilisateurs
2. Effectuer les ajustements nécessaires

## Conclusion

Cette feuille de route détaillée permet d'implémenter la fonctionnalité multi-association dans Planidocs de manière progressive et sans perturber le fonctionnement actuel pour SOS RD. Elle couvre toutes les étapes nécessaires, des modifications de base de données aux adaptations de l'interface utilisateur, en passant par la création des rôles et autorisations.

La structure proposée est évolutive et permettrait d'ajouter facilement d'autres associations à l'avenir si nécessaire. L'approche de nommage des collections avec suffixe d'association permet de maintenir la compatibilité avec les données existantes tout en isolant les données de chaque association.

Le rôle de super-administrateur offre une flexibilité pour la gestion globale du système, tandis que les échanges inter-associations permettent une collaboration entre les deux entités tout en maintenant leur indépendance opérationnelle.
