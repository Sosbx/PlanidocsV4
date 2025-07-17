# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet Planidocs

Planidocs est une application de gestion de planning et d'échange de gardes entre médecins. Elle permet aux médecins de consulter leur planning, participer à la bourse aux gardes, échanger directement avec d'autres médecins et gérer les remplacements.

## Commandes essentielles

```bash
# Développement
npm run dev          # Lancer le serveur de développement
npm run build        # Construire l'application pour la production
npm run lint         # Vérifier le code avec ESLint
npm run preview      # Prévisualiser la version de production
```

## Architecture du projet

Le projet suit une architecture "Feature-First" avec la structure suivante:

```
src/
  ├── api/                  # Couche d'accès aux données (abstraction de Firebase)
  ├── context/              # Contextes React pour le state global
  ├── features/             # Fonctionnalités principales de l'application
  │   ├── auth/             # Authentification
  │   ├── directExchange/   # Échanges directs entre médecins
  │   ├── planning/         # Gestion des plannings
  │   ├── shiftExchange/    # Bourse aux gardes (échanges centralisés)
  │   └── users/            # Gestion des utilisateurs
  ├── lib/                  # Bibliothèques et services externes
  ├── pages/                # Pages de l'application
  ├── styles/               # Styles globaux
  ├── types/                # Types TypeScript partagés
  └── utils/                # Utilitaires partagés
```

## Technologies principales

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Backend**: Firebase (Firestore, Authentication)
- **State Management**: React Context API
- **Routing**: React Router v6
- **Date Handling**: date-fns
- **Exports**: PDF (jspdf), Excel (xlsx), CSV

## Fonctionnalités clés

### 1. Authentification et gestion utilisateurs
- Système de connexion
- Gestion des rôles (admin, médecin, remplaçant)
- Profils utilisateurs

### 2. Planning
- Visualisation des plannings (jour, mois, période)
- Export en différents formats (PDF, Excel, CSV)
- Gestion des périodes de planning

### 3. Bourse aux gardes (centralisée)
Fonctionne selon un cycle de phases:
1. **Fermée**: Aucune action possible
2. **Soumission**: Les médecins soumettent leurs demandes d'échange
3. **Appariement**: Le système apparie les demandes compatibles
4. **Validation**: Les médecins valident les appariements proposés
5. **Terminée**: Les échanges validés sont appliqués aux plannings

### 4. Échanges directs
Permet aux médecins d'échanger directement leurs gardes avec options:
- **Échange**: Recherche d'une garde en contrepartie
- **Cession**: Don de la garde sans contrepartie
- **Remplacement**: Recherche d'un remplaçant (visible uniquement par les remplaçants)

## Conseils pour le développement

### Flux d'événements des échanges

Pour les échanges directs:
1. Un médecin propose sa garde (exchange/give/replacement)
2. Un autre médecin fait une proposition
3. Le premier médecin accepte ou rejette
4. Si accepté, les plannings sont automatiquement mis à jour
5. Notifications envoyées aux utilisateurs concernés

IMPORTANT: Pour toute modification des plannings, utiliser la collection `COLLECTIONS.PLANNINGS` et non une chaîne codée en dur.

### Modèles de données importants

- **User**: Informations sur les utilisateurs (avec statut "remplaçant")
- **Planning**: Gardes assignées aux médecins
- **ShiftExchange**: Échanges dans la bourse aux gardes
- **DirectExchange**: Échanges directs entre médecins

### Transactions

Les opérations importantes (comme les échanges) doivent être atomiques:
1. Effectuer toutes les lectures d'abord
2. Puis effectuer toutes les écritures
3. Utiliser des transactions Firestore pour garantir l'atomicité

### Points d'attention

- Toujours vérifier les conflits potentiels entre les différents systèmes d'échange
- Assurer qu'une garde n'est jamais disponible dans plusieurs systèmes simultanément
- Maintenir la traçabilité des opérations avec des logs détaillés
- Suivre la convention de séparation des mécanismes de lecture et d'écriture
- Respecter la structure feature-first pour toute nouvelle fonctionnalité

### ⚠️ IMPORTANT : Gestion des dates et fuseaux horaires

**L'application DOIT utiliser exclusivement le fuseau horaire Europe/Paris pour toutes les dates.**

#### Règles obligatoires pour les dates :

1. **JAMAIS utiliser `new Date()` directement**
   - ❌ `const today = new Date()`
   - ✅ `const today = createParisDate()`

2. **Importer les utilitaires de timezone** :
   ```typescript
   import { createParisDate, toParisTime, startOfMonthParis, endOfMonthParis, addMonthsParis, subMonthsParis } from '../utils/timezoneUtils';
   ```

3. **Conversions obligatoires** :
   - `new Date()` → `createParisDate()`
   - `new Date(year, month, day)` → `createParisDate(year, month, day)`
   - `startOfMonth(date)` → `startOfMonthParis(date)`
   - `endOfMonth(date)` → `endOfMonthParis(date)`
   - `addMonths(date, n)` → `addMonthsParis(date, n)`
   - `subMonths(date, n)` → `subMonthsParis(date, n)`
   - `firebaseTimestamp.toDate()` → `firebaseTimestampToParisDate(firebaseTimestamp)`

4. **Exceptions autorisées** :
   - `Date.now()` uniquement pour mesurer des performances (non pour des dates métier)
   - Timestamps de cache local (car relatifs)

5. **Vérification avant tout commit** :
   - Rechercher tous les `new Date(` dans le code modifié
   - S'assurer que toutes les dates passent par les utilitaires Paris
   - Tester avec un utilisateur dans un fuseau horaire différent

Cette règle garantit que tous les utilisateurs voient exactement les mêmes dates, peu importe leur localisation géographique.

## Directives spécifiques

Comme indiqué dans CLAUDE.local.md, pour toute modification:
1. Toujours proposer un plan d'action avant de proposer du code
2. Suggérer des améliorations ou des considérations additionnelles
3. Maintenir la cohérence avec la structure existante
4. Détailler précisément le flux d'événements des fonctionnalités modifiées, en particulier pour les échanges entre médecins