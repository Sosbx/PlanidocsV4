# Migration des imports

Ce document décrit les modifications apportées aux imports dans le cadre de la migration vers l'architecture Feature-First.

## Contexte

Dans le cadre de la migration vers l'architecture Feature-First, nous avons besoin de mettre à jour tous les imports pour utiliser la nouvelle structure. Plusieurs types d'imports ont été identifiés comme problématiques :

1. Imports de la configuration Firebase
2. Imports des hooks d'authentification (useAuth)
3. Imports des hooks de planning (useDesiderata, useDesiderataState)
4. Imports d'autres hooks fréquemment utilisés

## Solution

Un script Python a été créé pour automatiser la mise à jour des imports dans tous les fichiers TypeScript/JavaScript du projet. Le script applique une série de règles de remplacement pour corriger les imports.

### Règles de migration

Les règles suivantes ont été appliquées :

- Imports de Firebase config : `../lib/firebase/config` → `../../../lib/firebase/config`
- Imports de useAuth : 
  - `../hooks/useAuth` → `../../../features/auth/hooks`
  - `../useAuth` → `../../../features/auth/hooks`
  - `./useAuth` → `../../../features/auth/hooks`
- Imports de useDesiderata :
  - `../hooks/useDesiderata` → `../../../features/planning/hooks/useDesiderata`
  - `../useDesiderata` → `../../../features/planning/hooks/useDesiderata`
  - `./useDesiderata` → `../../../features/planning/hooks/useDesiderata`
- Imports de useDesiderataState :
  - `../hooks/useDesiderataState` → `../../../features/planning/hooks/useDesiderataState`
  - `../useDesiderataState` → `../../../features/planning/hooks/useDesiderataState`
  - `./useDesiderataState` → `../../../features/planning/hooks/useDesiderataState`
- Imports d'autres hooks :
  - `../hooks/usePlanningPeriod` → `../../../features/planning/hooks/usePlanningPeriod`
  - `../hooks/useShiftAssignments` → `../../../features/planning/hooks/useShiftAssignments`
  - `../hooks/useUserAssignments` → `../../../features/users/hooks/useUserAssignments`
  - `../hooks/useCachedUserData` → `../../../features/users/hooks/useCachedUserData`

## Résultats

Le script a analysé 266 fichiers et a modifié 24 fichiers avec un total de 27 modifications. Les fichiers modifiés sont :

1. src/hooks/useFirestoreCache.ts
2. src/hooks/useConnectionStatus.ts
3. src/hooks/useUnsavedChanges.ts
4. src/features/auth/hooks/index.ts
5. src/features/planning/hooks/useDesiderataState.ts
6. src/features/planning/hooks/useUserAssignments.ts
7. src/features/planning/hooks/index.ts
8. src/hooks/shiftExchange/useShiftExchange.ts
9. src/hooks/shiftExchange/useShiftInteraction.ts
10. src/pages/ReplacementsPage.tsx
11. src/pages/GeneratedPlanningPage.tsx
12. src/pages/UserPlanningPage.tsx
13. src/pages/PlanningPreviewPage.tsx
14. src/pages/AdminShiftExchangePage.tsx
15. src/context/shiftExchange/BagPhaseContext.tsx
16. src/context/auth/UserContext.tsx
17. src/context/planning/PlanningContext.tsx
18. src/context/planning/PlanningPeriodContext.tsx
19. src/context/notifications/NotificationContext.tsx
20. src/features/planning/components/PermanentPlanningPreview.tsx
21. src/features/planning/pages/GeneratedPlanningPage.tsx
22. src/features/planning/pages/UserPlanningPage.tsx
23. src/features/planning/pages/PlanningPreviewPage.tsx
24. src/components/planning/PermanentPlanningPreview.tsx

## Problèmes identifiés

### 1. Problèmes de types d'utilisateurs

Lors de la migration, nous avons identifié plusieurs problèmes liés aux types d'utilisateurs :

1. **Incohérence des types User** : Il existe deux définitions différentes du type User :
   - `src/features/auth/types.ts` : définit un type User avec les propriétés `role` (au singulier), `displayName`, `status`, etc.
   - `src/features/users/types.ts` : définit un type User avec les propriétés `roles` (au pluriel), `hasValidatedPlanning`, etc.

2. **Utilisation incohérente des types** : Certains fichiers utilisent le type User de auth/types.ts, d'autres utilisent le type User de users/types.ts, et d'autres encore utilisent le type UserExtended de users/types.ts.

Ces incohérences causent des erreurs de type dans plusieurs fichiers, notamment :
- src/pages/AdminPage.tsx
- src/pages/UsersManagementPage.tsx
- src/features/planning/hooks/useDesiderata.ts

### 2. Problèmes d'imports après le nettoyage

Après l'exécution du script de nettoyage, plusieurs fichiers présentent des erreurs d'imports car ils font référence à des fichiers qui ont été déplacés ou supprimés :

1. **src/components/planning/GeneratedPlanningTable.tsx** :
   - Impossible de localiser le module '../exchange/ExchangeModal'
   - Impossible de localiser le module '../../hooks/exchange/useDirectExchange'

2. **src/pages/UserPlanningPage.tsx** :
   - Impossible de localiser le module '../components/planning/PlanningTutorial'
   - Impossible de localiser le module '../components/planning/GeneratedPlanningTable'

3. **src/pages/ValidatedPlanningsPage.tsx** :
   - Impossible de localiser le module '../components/planning/PlanningPreview'

4. **src/pages/GeneratedPlanningPage.tsx** :
   - Impossible de localiser le module '../components/planning/GeneratedPlanningTable'

5. **src/App.tsx** :
   - Impossible de localiser le module './pages/LoginPage'

## Prochaines étapes

- Résoudre les incohérences de types en unifiant les définitions des types User et UserExtended
- Vérifier que l'application compile et fonctionne correctement après les modifications
- Identifier et corriger les éventuels problèmes restants
- Continuer la migration vers l'architecture Feature-First
