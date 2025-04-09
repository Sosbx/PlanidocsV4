# Structure du projet Planidocs

Ce document décrit la structure du projet Planidocs, une application de gestion de planning pour les professionnels de santé.

## Vue d'ensemble

Planidocs est une application React/TypeScript qui utilise Firebase comme backend. L'application permet aux utilisateurs de :

- Consulter leur planning
- Participer à la bourse aux gardes
- Échanger des gardes directement avec d'autres utilisateurs
- Gérer leurs préférences et desiderata

## Architecture

Le projet est organisé selon une architecture Feature-First, où le code est regroupé par fonctionnalité plutôt que par type de fichier. Cette approche facilite la maintenance et l'évolution du code.

### Structure des dossiers

```
src/
  ├── api/                  # Couche d'accès aux données (abstraction de Firebase)
  ├── context/              # Contextes React pour le state global
  ├── features/             # Fonctionnalités principales de l'application
  ├── lib/                  # Bibliothèques et services externes
  ├── pages/                # Pages de l'application (composants de niveau supérieur)
  ├── styles/               # Styles globaux
  ├── types/                # Types TypeScript partagés
  └── utils/                # Utilitaires partagés
```

### Fonctionnalités principales

Chaque fonctionnalité est organisée dans un dossier sous `src/features/` avec la structure suivante :

```
features/[feature-name]/
  ├── components/           # Composants React spécifiques à la fonctionnalité
  ├── hooks/                # Hooks React spécifiques à la fonctionnalité
  ├── utils/                # Utilitaires spécifiques à la fonctionnalité
  ├── types.ts              # Types TypeScript spécifiques à la fonctionnalité
  ├── index.ts              # Point d'entrée qui exporte l'API publique
  └── README.md             # Documentation de la fonctionnalité
```

#### Fonctionnalités principales

1. **auth** : Authentification et gestion des utilisateurs
2. **planning** : Affichage et gestion des plannings
3. **shiftExchange** : Bourse aux gardes (échanges centralisés)
4. **directExchange** : Échanges directs entre utilisateurs
5. **users** : Gestion des utilisateurs et des profils

### Contextes

Les contextes React sont utilisés pour gérer l'état global de l'application :

```
context/
  ├── auth/                 # Contexte d'authentification
  ├── exchange/             # Contexte pour les échanges directs
  ├── notifications/        # Contexte pour les notifications
  ├── planning/             # Contexte pour les plannings
  └── shiftExchange/        # Contexte pour la bourse aux gardes
```

### API

La couche API abstrait les interactions avec Firebase :

```
api/
  ├── auth/                 # API d'authentification
  ├── exchange/             # API pour les échanges
  ├── planning/             # API pour les plannings
  └── users/                # API pour les utilisateurs
```

## Flux de données

1. Les pages (`src/pages/`) sont les points d'entrée de l'application
2. Les pages utilisent les composants des fonctionnalités (`src/features/`)
3. Les composants utilisent les hooks pour accéder aux données et aux fonctionnalités
4. Les hooks utilisent les contextes et les API pour interagir avec les données
5. Les API interagissent avec Firebase (`src/lib/firebase/`)

## Technologies principales

- **React** : Bibliothèque UI
- **TypeScript** : Typage statique
- **Firebase** : Backend (Firestore, Authentication)
- **TailwindCSS** : Framework CSS
- **React Router** : Routage
- **date-fns** : Manipulation de dates
- **Lucide React** : Icônes

## Conventions de nommage

- **Composants** : PascalCase (ex: `PlanningTable.tsx`)
- **Hooks** : camelCase avec préfixe "use" (ex: `useAuth.ts`)
- **Contextes** : PascalCase avec suffixe "Context" (ex: `UserContext.tsx`)
- **Utilitaires** : camelCase (ex: `dateUtils.ts`)
- **Types** : PascalCase (ex: `User`, `ShiftExchange`)

## Gestion des états

- **État local** : Géré avec `useState` et `useReducer`
- **État global** : Géré avec les contextes React
- **État serveur** : Géré avec Firebase et mis en cache localement

## Tests

Les tests sont organisés à côté des fichiers qu'ils testent, avec l'extension `.test.ts` ou `.test.tsx`.

## Documentation

La documentation est organisée dans le dossier `src/docs/` et comprend :

- **migration-plan.md** : Plan de migration vers l'architecture Feature-First
- **shiftExchange-migration-progress.md** : Suivi de la migration de la fonctionnalité shiftExchange
- **directExchange-migration-progress.md** : Suivi de la migration de la fonctionnalité directExchange
- **project-structure.md** : Ce document

Chaque fonctionnalité a également son propre fichier README.md qui décrit son fonctionnement et son API.
