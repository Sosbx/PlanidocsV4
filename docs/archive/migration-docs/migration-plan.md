# Plan de migration vers l'architecture Feature-First

Ce document décrit le plan de migration de l'architecture actuelle vers une architecture Feature-First plus modulaire et maintenable.

## Objectifs

- Améliorer la maintenabilité du code
- Réduire les dépendances circulaires
- Faciliter la compréhension du code pour les nouveaux développeurs
- Permettre une meilleure séparation des préoccupations
- Faciliter les tests unitaires

## Architecture actuelle

L'architecture actuelle est organisée par type de fichier :

```
src/
  ├── components/
  │   ├── admin/
  │   ├── auth/
  │   ├── bag/
  │   ├── common/
  │   ├── exchange/
  │   ├── modals/
  │   ├── planning/
  │   └── users/
  ├── context/
  │   ├── BagPhaseContext.tsx
  │   ├── ExchangeContext.tsx
  │   ├── NotificationContext.tsx
  │   ├── PlanningContext.tsx
  │   ├── PlanningPeriodContext.tsx
  │   └── UserContext.tsx
  ├── hooks/
  │   ├── exchange/
  │   ├── shiftExchange/
  │   ├── useAuth.ts
  │   ├── useConflictCheck.ts
  │   ├── useDesiderata.ts
  │   ├── useExchangeData.ts
  │   └── ...
  ├── lib/
  │   └── firebase/
  ├── pages/
  │   ├── AdminPage.tsx
  │   ├── AdminShiftExchangePage.tsx
  │   ├── DashboardPage.tsx
  │   ├── DirectExchangePage.tsx
  │   └── ...
  ├── types/
  │   ├── exchange.ts
  │   ├── planning.ts
  │   └── users.ts
  └── utils/
      ├── dateUtils.ts
      ├── exchange/
      └── ...
```

## Nouvelle architecture (Feature-First)

La nouvelle architecture est organisée par fonctionnalité :

```
src/
  ├── api/
  │   ├── auth/
  │   ├── exchange/
  │   ├── planning/
  │   └── users/
  ├── context/
  │   ├── auth/
  │   ├── exchange/
  │   ├── notifications/
  │   ├── planning/
  │   └── shiftExchange/
  ├── features/
  │   ├── auth/
  │   │   ├── components/
  │   │   ├── hooks/
  │   │   ├── utils/
  │   │   ├── types.ts
  │   │   ├── index.ts
  │   │   └── README.md
  │   ├── directExchange/
  │   │   ├── components/
  │   │   ├── hooks/
  │   │   ├── utils/
  │   │   ├── types.ts
  │   │   ├── index.ts
  │   │   └── README.md
  │   ├── planning/
  │   │   ├── components/
  │   │   ├── hooks/
  │   │   ├── utils/
  │   │   ├── types.ts
  │   │   ├── index.ts
  │   │   └── README.md
  │   ├── shiftExchange/
  │   │   ├── components/
  │   │   │   ├── admin/
  │   │   │   └── ...
  │   │   ├── hooks/
  │   │   ├── utils/
  │   │   ├── types.ts
  │   │   ├── index.ts
  │   │   └── README.md
  │   └── users/
  │       ├── components/
  │       ├── hooks/
  │       ├── utils/
  │       ├── types.ts
  │       ├── index.ts
  │       └── README.md
  ├── lib/
  │   └── firebase/
  ├── pages/
  │   ├── AdminPage.tsx
  │   ├── AdminShiftExchangePage.tsx
  │   ├── DashboardPage.tsx
  │   ├── DirectExchangePage.tsx
  │   └── ...
  └── utils/
      ├── dateUtils.ts
      ├── cacheUtils.ts
      └── ...
```

## Avantages de la nouvelle architecture

1. **Cohésion** : Tous les fichiers liés à une fonctionnalité sont regroupés ensemble
2. **Encapsulation** : Chaque fonctionnalité expose une API claire via son fichier `index.ts`
3. **Testabilité** : Les fonctionnalités sont plus faciles à tester de manière isolée
4. **Maintenabilité** : Les développeurs peuvent comprendre une fonctionnalité sans avoir à naviguer dans toute la base de code
5. **Évolutivité** : Ajouter une nouvelle fonctionnalité est aussi simple que d'ajouter un nouveau dossier

## Plan de migration

La migration sera effectuée progressivement, fonctionnalité par fonctionnalité, pour minimiser les perturbations :

1. **Phase 1** : Créer la structure de dossiers pour la nouvelle architecture
   - ✅ Créer les dossiers `features/` avec les sous-dossiers pour chaque fonctionnalité
   - ✅ Créer les dossiers `api/` et restructurer `context/`

2. **Phase 2** : Migrer les fonctionnalités une par une
   - ✅ Migrer la fonctionnalité `directExchange`
   - ✅ Migrer la fonctionnalité `shiftExchange`
   - ✅ Migrer la fonctionnalité `planning`
   - ✅ Migrer la fonctionnalité `auth`
   - ✅ Migrer la fonctionnalité `users`

3. **Phase 3** : Mettre à jour les imports dans les pages
   - ✅ Mettre à jour les imports de useAuth dans tous les fichiers pour utiliser la nouvelle structure
   - ✅ Mettre à jour les autres imports dans toutes les pages pour utiliser la nouvelle structure

4. **Phase 4** : Nettoyer les anciens fichiers
   - ✅ Créer un script pour supprimer les anciens fichiers une fois que toutes les fonctionnalités ont été migrées
   - ✅ Exécuter le script de nettoyage
   - ✅ Vérifier que tout fonctionne correctement après le nettoyage
   - ✅ Migration terminée le 02/04/2025

## Suivi de la migration

Pour chaque fonctionnalité, un document de suivi sera créé pour suivre la progression de la migration :

- [Migration de la fonctionnalité directExchange](./directExchange-migration-progress.md)
- [Migration de la fonctionnalité shiftExchange](./shiftExchange-migration-progress.md)
- [Migration de la fonctionnalité planning](./planning-migration-progress.md)
- [Migration de la fonctionnalité auth](./auth-migration-progress.md)
- [Migration de la fonctionnalité users](./users-migration-progress.md)

## Règles de migration

1. **Ne pas casser le code existant** : Le code doit continuer à fonctionner pendant la migration
2. **Migrer un composant à la fois** : Chaque composant doit être migré individuellement
3. **Mettre à jour les imports** : Les imports doivent être mis à jour pour utiliser la nouvelle structure
4. **Tester après chaque migration** : Les tests doivent être exécutés après chaque migration pour s'assurer que tout fonctionne correctement
5. **Documenter les changements** : Chaque migration doit être documentée dans le document de suivi correspondant
