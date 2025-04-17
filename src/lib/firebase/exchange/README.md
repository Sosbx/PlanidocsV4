# Module d'échange de gardes

Ce module contient toutes les fonctions nécessaires pour gérer les échanges de gardes dans l'application. Il est organisé en plusieurs sous-modules pour une meilleure maintenabilité et lisibilité.

## Structure du module

Le module est organisé en plusieurs fichiers, chacun ayant une responsabilité spécifique :

- **types.ts** : Définition des types et interfaces utilisés dans le module
- **validation.ts** : Fonctions de validation des données d'échange
- **core.ts** : Fonctions de base pour les échanges (ajout, suppression, récupération)
- **interest-operations.ts** : Fonctions liées à la gestion des intérêts pour les échanges
- **history-operations.ts** : Fonctions liées à la gestion de l'historique des échanges
- **subscription-operations.ts** : Fonctions d'abonnement en temps réel pour les échanges
- **planning-operations.ts** : Fonctions utilitaires pour manipuler les plannings lors des échanges
- **bag-exchange.ts** : Fonctions spécifiques à la bourse aux gardes
- **index.ts** : Point d'entrée qui réexporte toutes les fonctions publiques

## Utilisation

Toutes les fonctions sont exportées depuis le fichier `index.ts`. Pour utiliser le module, il suffit d'importer les fonctions depuis ce fichier :

```typescript
import { 
  addShiftExchange, 
  validateShiftExchange, 
  toggleInterest 
} from '../lib/firebase/exchange';
```

## Fonctionnalités principales

### Gestion des échanges

- `addShiftExchange` : Ajoute un nouvel échange de garde
- `removeShiftExchange` : Supprime un échange de garde
- `getShiftExchanges` : Récupère tous les échanges de garde
- `finalizeAllExchanges` : Finalise tous les échanges en attente
- `restorePendingExchanges` : Restaure tous les échanges indisponibles qui n'ont pas d'entrée dans l'historique

### Gestion des intérêts

- `toggleInterest` : Ajoute ou supprime l'intérêt d'un utilisateur pour un échange
- `removeUserFromExchange` : Supprime un utilisateur de la liste des intéressés d'un échange
- `proposeToUsers` : Propose un échange à des utilisateurs spécifiques

### Validation des échanges

- `validateShiftExchange` : Valide un échange de garde
- `validateExchangeData` : Valide les données d'un échange
- `verifyNoExistingExchange` : Vérifie si un utilisateur a déjà un échange en cours pour une garde spécifique
- `verifyNoReceivedGuard` : Vérifie si un utilisateur a déjà reçu une garde sur une période spécifique
- `verifyPlanningAssignment` : Vérifie l'assignation d'une garde dans le planning d'un utilisateur
- `verifyExchangeStatus` : Vérifie le statut d'un échange

### Gestion de l'historique

- `getExchangeHistory` : Récupère l'historique des échanges
- `revertToExchange` : Annule un échange et restaure les gardes d'origine

### Abonnements en temps réel

- `subscribeToShiftExchanges` : S'abonne aux changements en temps réel des échanges
- `subscribeToExchangeHistory` : S'abonne aux changements en temps réel de l'historique des échanges

### Manipulation des plannings

- `findAssignmentInPlanning` : Trouve une assignation dans un planning, quelle que soit sa structure
- `findPeriodWithAssignment` : Trouve la période qui contient une assignation
- `removeAssignmentFromPlanningData` : Supprime une assignation d'un planning
- `addAssignmentToPlanningData` : Ajoute une assignation à un planning
- `getPlanningRefs` : Récupère les références aux plannings des utilisateurs impliqués dans un échange

## Gestion des remplacements

- `createReplacement` : Crée un nouveau remplacement à partir d'un échange
- `deleteReplacement` : Supprime un remplacement associé à un échange
