# Plan d'amélioration du système d'échanges directs et remplacements

## Contexte et objectifs

Le système actuel d'échanges directs et de remplacements nécessite des améliorations pour mieux répondre aux besoins des médecins. Ce document détaille un plan complet pour refondre ces fonctionnalités.

Une fonctionnalité essentielle à implémenter est la gestion d'un statut "remplaçant" pour certains utilisateurs, qui seront les seuls à recevoir les notifications et propositions de remplacement.

## Flux utilisateur souhaité

1. Un médecin propose sa garde via la colonne "Mes gardes" ou depuis son planning personnel
2. Il peut sélectionner plusieurs options simultanément :
   - Échange (recherche d'une garde en contrepartie)
   - Cession (don de la garde sans contrepartie)
   - Remplacement (recherche d'un remplaçant)
3. Selon les options choisies :
   - Les gardes avec option échange/cession apparaissent dans la colonne "Gardes proposées" pour tous les autres médecins
   - Les gardes avec option remplacement apparaissent **uniquement** dans la page "Remplacements" destinée aux utilisateurs ayant le statut "remplaçant"
4. Dès qu'une garde est prise (par échange, cession ou remplacement), elle disparaît automatiquement des autres propositions
5. Seuls les utilisateurs avec le statut "remplaçant" reçoivent les notifications de nouvelles opportunités de remplacement
6. Les plannings de tous les médecins concernés sont mis à jour automatiquement
7. Des notifications informent tous les acteurs des changements

## Plan d'implémentation détaillé

### Phase 1 : Améliorations du filtrage et de l'affichage

#### 1.1 Correction du filtrage des gardes proposées
- [x] Exclure les gardes de l'utilisateur courant de la colonne "Gardes proposées"
- [ ] Exclure les gardes proposées uniquement aux remplaçants de la colonne "Gardes proposées"
- [ ] Implémenter un filtre côté serveur pour éviter que les données inutiles soient chargées

```javascript
// Filtrage côté client pour exclure les gardes de remplacement
const filteredExchanges = exchanges.filter(exchange => 
  // N'inclure que si ce n'est pas uniquement un remplacement
  !(exchange.operationTypes.length === 1 && exchange.operationTypes[0] === 'replacement')
);
```

#### 1.2 Amélioration de l'affichage des badges

- [ ] Créer des badges différenciés par type d'opération :
  - E (vert) = échange
  - C (jaune) = cession
  - R (ambre) = remplacement
- [ ] Implémenter des badges combinés pour les propositions multiples :
  - EC, ER, CR, ECR avec couleurs distinctives
- [ ] Ajouter un indicateur visuel pour les nouvelles propositions ou mises à jour

```javascript
const getBadgeForOperation = (operations) => {
  // Logique pour déterminer l'étiquette et la classe du badge
  let label = '';
  let cssClass = '';
  
  if (operations.includes('exchange')) label += 'E';
  if (operations.includes('give')) label += 'C';
  if (operations.includes('replacement')) label += 'R';
  
  // Déterminer la classe CSS selon la combinaison
  switch (label) {
    case 'E': cssClass = 'bg-green-100 text-green-700'; break;
    case 'C': cssClass = 'bg-yellow-100 text-yellow-700'; break;
    case 'R': cssClass = 'bg-amber-100 text-amber-700'; break;
    case 'EC': cssClass = 'bg-emerald-100 text-emerald-700'; break;
    case 'ER': cssClass = 'bg-teal-100 text-teal-700'; break;
    case 'CR': cssClass = 'bg-orange-100 text-orange-700'; break;
    case 'ECR': cssClass = 'bg-blue-100 text-blue-700'; break;
    default: cssClass = 'bg-gray-100 text-gray-700';
  }
  
  return { label, cssClass };
};
```

### Phase 2 : Implémentation du statut "remplaçant"

#### 2.1 Modification du modèle utilisateur
- [ ] Ajouter un champ `isReplacement` (boolean) au modèle utilisateur
- [ ] Créer une interface d'administration pour gérer ce statut
- [ ] Mettre à jour la base de données pour les utilisateurs existants

```typescript
// Mise à jour du type User
interface User {
  id: string;
  name: string;
  email: string;
  // ...autres champs existants
  isReplacement: boolean; // Nouveau champ indiquant si l'utilisateur est un remplaçant
  replacementDetails?: {
    availability: string[];
    specialties: string[];
    contactPreference: 'email' | 'sms' | 'app';
  };
}

// Fonction pour mettre à jour le statut d'un utilisateur
export const updateUserReplacementStatus = async (
  userId: string, 
  isReplacement: boolean,
  details?: ReplacementDetails
): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isReplacement,
      ...(details && { replacementDetails: details }),
      lastModified: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut de remplaçant:", error);
    return false;
  }
};
```

#### 2.2 Interface utilisateur pour les remplaçants
- [ ] Créer une page dédiée "Remplacements disponibles" accessible uniquement aux remplaçants
- [ ] Adapter l'interface utilisateur en fonction du statut (médecin ou remplaçant)
- [ ] Ajouter des filtres spécifiques pour les remplaçants (par spécialité, région, etc.)

```jsx
// Composant pour l'accès conditionnel à la page des remplacements
const ReplacementRoute = ({ children }) => {
  const { user } = useAuth();
  
  // Rediriger si l'utilisateur n'est pas un remplaçant
  if (!user?.isReplacement) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Dans le routeur principal
<Routes>
  {/* Autres routes... */}
  <Route 
    path="/replacements" 
    element={
      <ReplacementRoute>
        <ReplacementsPage />
      </ReplacementRoute>
    } 
  />
</Routes>
```

### Phase 3 : Amélioration du service de transactions

#### 3.1 Renforcement de la gestion des remplacements
- [ ] Améliorer la gestion des remplacements dans TransactionService
- [ ] Assurer la synchronisation correcte entre les options d'échange, cession et remplacement
- [ ] Implémenter la mise à jour automatique des plannings après validation d'un remplacement

```typescript
// Extension des types d'opérations dans TransactionService
export type OperationType = 'exchange' | 'give' | 'replacement' | 'combined';

// Fonction pour gérer une proposition de remplacement
export const proposeReplacement = async (
  exchangeId: string,
  replacementData: ReplacementData,
  userId: string
): Promise<OperationResult> => {
  // Implémentation...
};
```

#### 3.2 Filtrage des remplacements par statut utilisateur
- [ ] Modifier le service de transactions pour filtrer les opportunités de remplacement
- [ ] S'assurer que seuls les utilisateurs avec statut "remplaçant" peuvent postuler pour un remplacement
- [ ] Implémenter des contrôles d'accès au niveau des services et de l'interface

```typescript
// Fonction pour vérifier si un utilisateur peut prendre un remplacement
export const canTakeReplacement = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    return userData.isReplacement === true;
  } catch (error) {
    console.error("Erreur lors de la vérification du statut de remplaçant:", error);
    return false;
  }
};

// Middleware pour les routes API de remplacement
export const replacementAccessMiddleware = async (req, res, next) => {
  try {
    const userId = req.user.id; // Obtenu depuis l'authentification
    const canAccess = await canTakeReplacement(userId);
    
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: "Accès refusé. Seuls les remplaçants peuvent effectuer cette action."
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Erreur serveur lors de la vérification des accès."
    });
  }
};
```

#### 3.3 Vérification des conflits inter-systèmes
- [ ] Améliorer la détection des conflits entre échanges et remplacements
- [ ] Empêcher les propositions multiples pour une même garde déjà validée
- [ ] Mise en place de verrous atomiques pour éviter les conditions de course

### Phase 4 : Système de notifications

#### 4.1 Notifications pour tous les acteurs du système
- [ ] Notifier l'auteur d'une proposition quand un médecin est intéressé
- [ ] Notifier l'auteur quand sa garde est prise ou échangée
- [ ] Notifier les remplaçants des nouvelles opportunités disponibles
- [ ] Notifier les médecins concernés une fois l'échange validé

```typescript
// Types de notifications à implémenter
export enum NotificationType {
  NEW_EXCHANGE_OFFER = 'new_exchange_offer',
  NEW_PROPOSAL = 'new_proposal',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_REJECTED = 'proposal_rejected',
  EXCHANGE_COMPLETED = 'exchange_completed',
  NEW_REPLACEMENT_OPPORTUNITY = 'new_replacement_opportunity',
  REPLACEMENT_CONFIRMED = 'replacement_confirmed'
}
```

#### 4.2 Centre de notifications
- [ ] Créer une interface centralisée pour consulter toutes les notifications
- [ ] Permettre de filtrer les notifications par type (échanges, remplacements, etc.)
- [ ] Implémenter un système de marquage "lu/non lu"

### Phase 5 : Synchronisation des plannings

#### 5.1 Mise à jour atomique des plannings
- [ ] Implémenter des transactions atomiques pour la mise à jour des plannings
- [ ] Assurer la cohérence des plannings entre les médecins impliqués
- [ ] Gérer les cas particuliers (annulations, rejets tardifs, etc.)

```typescript
// Fonction pour mettre à jour les plannings après un échange validé
const updatePlanningsAfterExchange = async (transaction, exchangeData, proposalData) => {
  // Étapes de mise à jour:
  // 1. Récupérer les plannings des deux médecins
  // 2. Supprimer les gardes échangées des plannings d'origine
  // 3. Ajouter les gardes aux nouveaux plannings
  // 4. Marquer les gardes comme "échangées" avec référence à l'échange
};
```

#### 5.2 Suppression automatique des propositions
- [ ] Supprimer automatiquement les propositions concernant une garde validée
- [ ] Notifier les auteurs de propositions lorsqu'une garde n'est plus disponible
- [ ] Marquer les propositions comme "expirées" plutôt que de les supprimer totalement

### Phase 6 : Amélioration de l'expérience utilisateur

#### 6.1 Confirmations et feedbacks
- [ ] Ajouter des confirmations avant les actions importantes
- [ ] Améliorer les messages de succès/erreur pour plus de clarté
- [ ] Fournir des indicateurs visuels de progression pour les opérations longues

```jsx
// Composant de confirmation
const ConfirmationDialog = ({ message, onConfirm, onCancel }) => (
  <div className="bg-white p-4 rounded shadow-md">
    <p className="mb-4">{message}</p>
    <div className="flex justify-end space-x-2">
      <button 
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" 
        onClick={onCancel}
      >
        Annuler
      </button>
      <button 
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" 
        onClick={onConfirm}
      >
        Confirmer
      </button>
    </div>
  </div>
);
```

#### 6.2 Historique et traçabilité
- [ ] Créer une page d'historique des échanges/remplacements
- [ ] Permettre de filtrer l'historique par type d'opération, date, etc.
- [ ] Ajouter des statistiques sur les échanges (nombre total, acceptés, refusés, etc.)

### Phase 7 : Documentation et tests

#### 7.1 Documentation complète
- [ ] Documenter le nouveau flux d'échanges et de remplacements
- [ ] Créer des tutoriels pour les utilisateurs
- [ ] Mettre à jour la documentation technique

#### 7.2 Tests exhaustifs
- [ ] Créer des tests unitaires pour les fonctions critiques
- [ ] Implémenter des tests d'intégration pour les flux complets
- [ ] Tester les cas limites et les scénarios d'échec

## Calendrier d'implémentation suggéré

| Phase | Durée estimée | Priorité |
|-------|---------------|----------|
| Phase 1 : Filtrage et affichage | 1-2 jours | Haute |
| Phase 2 : Implémentation du statut "remplaçant" | 2 jours | Haute |
| Phase 3 : Amélioration du service de transactions | 2-3 jours | Haute |
| Phase 4 : Système de notifications | 2 jours | Moyenne |
| Phase 5 : Synchronisation des plannings | 2-3 jours | Haute |
| Phase 6 : Expérience utilisateur | 1-2 jours | Moyenne |
| Phase 7 : Documentation et tests | 2 jours | Moyenne |

## Dépendances et prérequis

- Service de transaction atomique (déjà implémenté)
- Système de notification (partiellement implémenté)
- Accès aux plannings des médecins et remplaçants
- Permissions appropriées pour les mises à jour en cascade
- Schéma utilisateur extensible pour ajouter le statut "remplaçant"
- Contrôle d'accès basé sur les rôles pour la gestion des remplaçants

## Risques et mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Perte de données lors des transactions | Élevé | Faible | Utiliser des transactions atomiques avec rollback |
| Confusion des utilisateurs avec le nouveau système | Moyen | Moyen | Fournir des tooltips et une documentation claire |
| Performance réduite avec des opérations complexes | Moyen | Moyen | Optimiser les requêtes et utiliser des caches |
| Conflits entre les systèmes d'échange et de remplacement | Élevé | Moyen | Centraliser la logique dans TransactionService |
| Migration des utilisateurs vers le statut "remplaçant" | Moyen | Élevé | Créer un outil d'administration pour la transition |
| Accès non autorisé aux fonctionnalités de remplacement | Élevé | Moyen | Implémenter des contrôles d'accès stricts |
| Notifications indésirables aux utilisateurs | Faible | Élevé | Paramètres de notification personnalisables par utilisateur |

## Conclusion

Cette refonte du système d'échanges et de remplacements apportera plus de clarté et de robustesse à l'application. L'ajout du statut "remplaçant" permettra de mieux cibler les propositions de remplacement et d'améliorer l'expérience utilisateur pour les différents profils. 

En suivant ce plan d'implémentation par phases, nous pourrons progressivement améliorer le système tout en maintenant sa stabilité. Les médecins bénéficieront d'un système plus intuitif pour les échanges et cessions, tandis que les remplaçants auront un accès privilégié aux opportunités qui leur sont réservées.

La séparation claire entre les flux d'échanges/cessions (entre médecins) et remplacements (par des remplaçants désignés) permettra d'éviter les confusions et d'optimiser chaque parcours utilisateur selon ses besoins spécifiques.

---

Document préparé par Claude | Avril 2025