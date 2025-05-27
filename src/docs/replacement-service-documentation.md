# Documentation du service de remplacement

Ce document technique décrit le fonctionnement et l'implémentation du système de remplacement amélioré pour l'application Planidocs.

## Architecture du service

Le système de remplacement s'articule autour de trois composants principaux :

1. **Service de transaction atomique** (`replacementTransactionService.ts`)
   - Gère les opérations de base de données avec garantie d'atomicité
   - Assure la cohérence des données lors des opérations de remplacement
   - S'intègre avec les services existants d'échange et de planning

2. **Hook React** (`useReplacementService.ts`)
   - Fournit une interface React pour utiliser le service de remplacement
   - Gère les états de chargement et d'erreur
   - Vérifie les autorisations utilisateur

3. **Composants d'interface** (modaux et listes)
   - `ReplacementRequestModal` : Interface pour proposer un remplacement
   - `ReplacementProposalsList` : Affiche les propositions reçues par un remplaçant
   - `ReplacementHistoryList` : Historique des remplacements

## Flux de travail des remplacements

### 1. Proposition de remplacement

Un médecin peut proposer un remplacement pour une de ses gardes via les étapes suivantes :

1. Sélection d'une garde à proposer dans le tableau d'échange
2. Ouverture du modal de proposition de remplacement
3. Choix des destinataires (tous les remplaçants ou un remplaçant spécifique)
4. Ajout d'un commentaire facultatif
5. Soumission de la proposition

En arrière-plan :
- La proposition est enregistrée dans la collection `direct_exchange_proposals`
- L'échange est marqué comme ayant des propositions en attente
- Les opérations sont effectuées de manière atomique via une transaction Firestore

### 2. Réception et réponse à une proposition

Un remplaçant peut consulter et répondre aux propositions via les étapes suivantes :

1. Consultation de la liste des propositions de remplacement
2. Visualisation des détails (médecin, date, horaire, commentaire)
3. Acceptation ou refus de la proposition
4. Ajout d'un commentaire facultatif avec la réponse

En arrière-plan :
- La proposition est mise à jour avec la réponse du remplaçant
- En cas d'acceptation, une entrée est créée dans l'historique des remplacements
- L'échange est marqué comme finalisé
- Les autres propositions pour cette garde sont automatiquement refusées
- Le planning est mis à jour pour refléter le remplacement

### 3. Consultation de l'historique

Tous les utilisateurs peuvent consulter l'historique des remplacements les concernant :

1. Les médecins voient les remplacements qu'ils ont demandés
2. Les remplaçants voient les remplacements qu'ils ont effectués
3. Les administrateurs peuvent voir tous les remplacements

## Interactions avec les autres systèmes

1. **Interaction avec le système d'échange direct**
   - Verrouillage des échanges pendant les opérations de remplacement
   - Actualisation des statuts des échanges proposés
   - Gestion cohérente des opérations mixtes (échange + remplacement)

2. **Interaction avec le système de planning**
   - Notification automatique des changements de planning lors d'un remplacement accepté
   - Mise à jour des assignations pour refléter les remplacements
   - Synchronisation avec les autres systèmes d'échange

3. **Interaction avec le système d'authentification**
   - Vérification du statut "remplaçant" des utilisateurs
   - Filtrage des propositions selon les autorisations des utilisateurs

## Structure des données

### Collections Firestore

1. **Collection `direct_exchanges`**
   - Contient les gardes proposées
   - Champ `operationTypes` étendu pour inclure `'replacement'`
   - Champ `hasProposals` pour indiquer les propositions en attente

2. **Collection `direct_exchange_proposals`**
   - Enregistre les propositions de remplacement
   - Nouveau champ `isGroupProposal` pour identifier les propositions à tous les remplaçants
   - Nouveau champ `targetUserIds` pour les propositions ciblées

3. **Collection `direct_exchange_history`**
   - Historique des remplacements effectués
   - Contient les détails des gardes, médecins et remplaçants
   - Timestamps pour suivre la chronologie des opérations

## Transactions atomiques

Le service implémente des transactions Firestore pour garantir la cohérence des données :

1. Lors de la proposition d'un remplacement, une transaction assure que :
   - L'échange est créé ou mis à jour avec le type d'opération `replacement`
   - La proposition est correctement enregistrée
   - L'échange est marqué comme ayant des propositions en attente

2. Lors de la réponse à une proposition, une transaction assure que :
   - L'échange est verrouillé pendant l'opération
   - La proposition est mise à jour avec la réponse
   - L'historique est créé en cas d'acceptation
   - L'échange est marqué comme finalisé
   - Les autres propositions sont rejetées
   - Le verrouillage est levé à la fin de l'opération

## Avantages du système

1. **Fiabilité** : opérations atomiques garantissant la cohérence des données
2. **Flexibilité** : propositions à tous les remplaçants ou à des remplaçants spécifiques
3. **Traçabilité** : historique complet des remplacements
4. **Interface intuitive** : composants dédiés pour chaque étape du processus
5. **Intégration** : synchronisation avec les systèmes existants