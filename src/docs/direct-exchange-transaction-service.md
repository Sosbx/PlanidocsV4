# DirectExchange - Transaction Service

## Présentation

Le TransactionService est un service centralisé pour la gestion des échanges directs entre médecins. Il permet de :

- Créer des échanges directs avec diverses opérations (échange, cession, remplacement)
- Proposer des gardes en échange
- Accepter ou rejeter des propositions d'échange
- Annuler des échanges ou des propositions
- Mettre à jour automatiquement les plannings lors d'échanges validés
- Gérer les notifications aux utilisateurs

## Caractéristiques principales

- **Transactions atomiques** : Toutes les opérations sont réalisées de manière atomique, garantissant l'intégrité des données.
- **Gestion des conflits** : Détection et prévention des conflits entre les différents systèmes d'échange.
- **Verrouillage d'échanges** : Prévient les modifications concurrentes sur le même échange.
- **Synchronisation avec la bourse aux gardes** : Assure qu'une garde n'est jamais disponible dans les deux systèmes simultanément.
- **Traçabilité complète** : Chaque opération est enregistrée dans l'historique avec un identifiant de transaction unique.

## Architecture

Le service s'appuie sur trois composants principaux :

1. **TransactionService** : Gère les transactions atomiques pour toutes les opérations d'échange.
2. **ConflictService** : Détecte les conflits potentiels entre les différents systèmes d'échange.
3. **AtomicOperations** : Fournit des opérations atomiques de bas niveau comme le verrouillage et la synchronisation.

## Types d'opérations supportées

- **Échange direct** : Échange d'une garde contre une autre garde
- **Cession** : Cession d'une garde sans contrepartie
- **Remplacement** : Prise en charge d'une garde temporairement
- **Opérations hybrides** : Combinaisons comme échange+remplacement

## Flux d'événements typique

1. Un médecin crée un échange direct pour proposer sa garde (`createExchangeTransaction`)
2. Un autre médecin propose de prendre ou d'échanger la garde (`createProposalTransaction`)
3. Le médecin initial accepte ou rejette la proposition (`acceptProposalTransaction` ou `rejectProposalTransaction`)
4. Si accepté, les plannings sont automatiquement mis à jour et des notifications sont envoyées
5. L'historique est mis à jour avec toutes les informations de l'échange

## Collection de planning importante

**IMPORTANT**: La modification des plannings se fait dans la collection `generated_plannings`, qui est définie comme constante `COLLECTIONS.PLANNINGS` dans le fichier `types.ts`. Toujours utiliser cette constante et non une chaîne codée en dur pour assurer la cohérence.

## Structure d'une transaction pour accepter une proposition

```typescript
// 1. EFFECTUER TOUTES LES LECTURES D'ABORD
// - Récupérer la proposition
// - Récupérer l'échange associé
// - Récupérer les plannings des utilisateurs concernés

// 2. EFFECTUER TOUTES LES ÉCRITURES ENSUITE
// - Mettre à jour le statut de la proposition à "accepted"
// - Mettre à jour le statut de l'échange à "validated"
// - Mettre à jour les plannings des deux médecins dans generated_plannings
// - Envoyer les notifications
// - Ajouter à l'historique
```

## Correction d'avril 2025

Une correction importante a été apportée pour résoudre un problème où les plannings n'étaient pas correctement mis à jour lors de l'acceptation d'une proposition d'échange:

1. **Problème**: Les mises à jour de planning utilisaient une collection hardcodée au lieu de la constante `COLLECTIONS.PLANNINGS`.

2. **Solution**:
   - Utilisation systématique de la constante `COLLECTIONS.PLANNINGS` 
   - Amélioration de la journalisation pour une meilleure traçabilité
   - Ajout d'un système d'invalidation de cache pour assurer le rafraîchissement des UI
   - Séparation stricte des lectures et écritures dans les transactions
   - Validation complète des données avant les opérations d'écriture

3. **Impact**: 
   - Les échanges directs fonctionnent maintenant correctement
   - Les plannings des deux médecins sont mis à jour dans la collection appropriée
   - L'interface utilisateur est automatiquement rafraîchie après un échange

## Diagnostic des problèmes

En cas de problème avec les échanges, vérifier les logs avec ces préfixes:
- "🔄 Début du processus d'acceptation..."
- "TRACE TRANSFERT: ..."
- "ÉCHANGE: ..."
- "PLANNINGS: ..."

## Utilisation avec les hooks

Ce service est conçu pour être utilisé avec des hooks React comme `useDirectExchangeActions`, garantissant une expérience utilisateur optimale avec :

- Gestion des états de chargement
- Gestion des erreurs
- Mises à jour optimistes de l'interface
- Notifications en temps réel

## Gestion des erreurs

Toutes les fonctions retournent un objet avec les propriétés suivantes :
- `success` : Indique si l'opération a réussi
- `error` : Message d'erreur si l'opération a échoué
- `data` : Données résultantes de l'opération

## Bonnes pratiques pour les développements futurs

1. Toujours utiliser les constantes depuis `COLLECTIONS` au lieu de chaînes hardcodées
2. Maintenir la structure de transaction avec lectures avant écritures
3. Ajouter des logs détaillés pour faciliter le débogage
4. Invalider les caches après toute modification de données
5. Tester les cas limites (planning inexistant, valeurs manquantes, etc.)

---

© Planidocs 2025 - Documentation technique