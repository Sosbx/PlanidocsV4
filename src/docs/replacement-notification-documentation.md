# Système de notification ciblé pour les remplacements

Ce document explique le fonctionnement du système de notification spécifique aux remplacements, permettant d'informer les médecins remplaçants des propositions de garde disponibles.

## Architecture du système

Le système de notification pour les remplacements s'articule autour des composants suivants:

1. **Service de notification dédié** (`replacementNotificationService.ts`)
   - Gère l'envoi de notifications ciblées aux remplaçants
   - S'intègre avec le système de notification existant
   - Permet d'envoyer des notifications à des remplaçants spécifiques ou à tous les remplaçants

2. **Intégration avec le service de transaction** (`replacementTransactionService.ts`)
   - Déclenche les notifications lors des opérations de remplacement
   - Garantit la cohérence entre les actions et les notifications

3. **Interface utilisateur améliorée** (`NotificationBell.tsx`)
   - Affiche les notifications spécifiques aux remplacements avec une mise en forme adaptée
   - Permet aux utilisateurs d'accéder rapidement aux propositions pertinentes

## Types de notifications

Le système gère plusieurs types de notifications spécifiques aux remplacements:

1. **Proposition de remplacement** (`REPLACEMENT_PROPOSED`)
   - Envoyée aux remplaçants lorsqu'un médecin propose une garde en remplacement
   - Peut être ciblée à un remplaçant spécifique ou à tous les remplaçants
   - Inclut les détails de la garde et éventuellement un message personnalisé

2. **Acceptation de remplacement** (`REPLACEMENT_ACCEPTED`)
   - Envoyée au médecin proposant lorsqu'un remplaçant accepte sa proposition
   - Inclut les informations sur le remplaçant et la garde concernée

3. **Refus de remplacement** (`REPLACEMENT_REJECTED`)
   - Envoyée au médecin proposant lorsqu'un remplaçant refuse sa proposition
   - Peut inclure la raison du refus

4. **Mise à jour de remplacement** (`REPLACEMENT_UPDATED`)
   - Envoyée lorsqu'une proposition de remplacement est modifiée
   - Informe les remplaçants des changements apportés

5. **Annulation de remplacement** (`REPLACEMENT_CANCELLED`)
   - Envoyée lorsqu'une proposition de remplacement est annulée
   - Permet aux remplaçants d'être informés rapidement des annulations

## Flux de travail des notifications

### 1. Envoi de propositions de remplacement

Lorsqu'un médecin propose une garde en remplacement:

1. Le médecin crée une proposition via l'interface utilisateur
2. Le service de transaction traite la proposition et l'enregistre
3. Une fois la transaction réussie, le service déclenche une notification:
   - Si la proposition cible un remplaçant spécifique, seul ce remplaçant est notifié
   - Si la proposition est générale, tous les utilisateurs avec le statut "remplaçant" sont notifiés

### 2. Réponse à une proposition de remplacement

Lorsqu'un remplaçant répond à une proposition:

1. Le remplaçant accepte ou refuse la proposition via l'interface
2. Le service de transaction traite la réponse et met à jour la proposition
3. Une notification est envoyée au médecin proposant pour l'informer de la réponse
4. Si la proposition est acceptée, le planning est mis à jour et une notification de confirmation est envoyée

## Implémentation technique

### Notification à des remplaçants spécifiques

```typescript
// Exemple d'utilisation pour notifier un remplaçant spécifique
await replacementNotificationService.notifySpecificReplacement(
  replacementUserId,
  doctorName,
  date,
  period,
  proposalId,
  optionalMessage
);
```

### Notification à tous les remplaçants

```typescript
// Exemple d'utilisation pour notifier tous les remplaçants
await replacementNotificationService.notifyAllReplacements(
  doctorName,
  date,
  period,
  proposalId,
  optionalMessage
);
```

### Transactions atomiques avec notifications

Les notifications sont envoyées après la finalisation des transactions pour garantir que les données sont cohérentes avant l'envoi des notifications:

```typescript
// Après une transaction réussie
setTimeout(async () => {
  try {
    await replacementNotificationService.notifyProposerOfAcceptance(...);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification:', error);
  }
}, 0);
```

## Interface utilisateur des notifications

Les notifications de remplacement utilisent un code couleur spécifique dans l'interface:

- **Propositions**: Couleur ambre
- **Acceptations**: Couleur verte
- **Refus**: Couleur rouge
- **Annulations**: Couleur orange

Chaque notification inclut:
- Le titre de la notification
- Le message détaillé
- L'horodatage
- Un lien direct vers la page pertinente (liste des propositions ou planning)

## Avantages du système

1. **Ciblage précis**: Seuls les remplaçants concernés reçoivent des notifications
2. **Réactivité**: Les notifications sont délivrées immédiatement après les actions
3. **Contexte complet**: Les notifications contiennent toutes les informations nécessaires
4. **Traçabilité**: Les notifications sont enregistrées et peuvent être consultées ultérieurement
5. **Expérience utilisateur**: Interface claire avec code couleur et accès direct aux actions

## Maintenance et évolutivité

Le système est conçu pour être facilement extensible:

1. Ajout de nouveaux types de notifications
2. Personnalisation des messages et des actions
3. Intégration avec d'autres systèmes (notifications push, emails, etc.)
4. Filtrage et priorisation des notifications