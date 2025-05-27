# Guide de migration vers le nouveau système d'échanges directs

## Introduction

Ce document détaille la migration progressive du système d'échanges directs vers la nouvelle architecture basée sur le `TransactionService`. Cette migration vise à améliorer la robustesse, la fiabilité et les performances des échanges directs entre médecins.

## Pourquoi migrer ?

Le nouveau système apporte plusieurs avantages clés :

- **Atomicité des opérations** : Toutes les opérations sont effectuées de manière atomique, ce qui garantit la cohérence des données même en cas d'erreur.
- **Gestion centralisée des conflits** : Détection et prévention unifiée des conflits entre les différents systèmes d'échange.
- **Verrouillage optimisé** : Prévention des modifications concurrentes sur les mêmes ressources.
- **Traçabilité complète** : Historique détaillé et fiable de toutes les opérations effectuées.
- **Performances améliorées** : Réduction du nombre de requêtes et optimisation des transactions.

## Stratégie de migration

La migration s'effectue en quatre phases pour minimiser les perturbations :

1. **Phase 1 : Implémentation des nouveaux services** (terminé)
   - Création du `TransactionService.ts`
   - Création du `ConflictService.ts`
   - Ajout de `atomicOperations.ts`

2. **Phase 2 : Préparation des hooks de transition** (terminé)
   - Création de `useTransactionService.ts`
   - Création de `useDirectExchangeTransactions.ts` (wrapper de compatibilité)
   - Création de `useExchangeListFilters.ts`

3. **Phase 3 : Migration progressive des composants** (en cours)
   - Création de nouveaux composants utilisant les nouveaux hooks
   - Modification progressive des composants existants
   - Intégration parallèle des deux systèmes pendant la transition

4. **Phase 4 : Finalisation et nettoyage** (à venir)
   - Suppression des anciens hooks et services
   - Optimisation et refactoring final
   - Documentation complète

## Comment utiliser le nouveau système

### Hooks disponibles

1. **useTransactionService**
   - Hook principal pour interagir avec le `TransactionService`
   - Fournit toutes les opérations atomiques disponibles

2. **useDirectExchangeTransactions**
   - Hook de compatibilité qui maintient la même interface que l'ancien système
   - Facilite la transition sans modification majeure des composants

3. **useExchangeListFilters**
   - Nouveau système de filtres pour les listes d'échanges
   - Compatible avec les données du nouveau système

### Nouveaux composants

1. **ExchangeActionButton**
   - Bouton d'action unifié pour les opérations sur les échanges
   - Utilise le nouveau système de transactions

2. **ExchangeHistory**
   - Affiche l'historique des échanges d'un utilisateur
   - Utilise les nouvelles fonctionnalités d'historique

### Exemple d'utilisation

```tsx
import { useDirectExchangeTransactions } from '../hooks';
import { ExchangeActionButton, ExchangeHistory } from '../components';

const MyComponent = () => {
  const { 
    handleModalSubmit,
    proposeExchange,
    toast
  } = useDirectExchangeTransactions({
    onSuccess: (message) => console.log(`Succès: ${message}`),
    onError: (message) => console.error(`Erreur: ${message}`)
  });

  // Utiliser les fonctions du hook pour les opérations d'échange...

  return (
    <div>
      {/* Utiliser les composants prêts à l'emploi */}
      <ExchangeActionButton 
        actionType="accept" 
        id="proposition-123" 
        label="Accepter"
        onComplete={() => console.log('Proposition acceptée')}
      />
      
      <ExchangeHistory limit={5} />
    </div>
  );
};
```

## État actuel de la migration

- ✅ Services principaux implémentés
- ✅ Hooks de transition disponibles
- ✅ Nouveaux composants disponibles
- 🔄 Migration progressive des composants existants en cours
- ⏱️ Nettoyage final prévu après validation complète

## Recommandations

1. Pour les nouveaux composants, utilisez directement `useTransactionService` ou `useDirectExchangeTransactions`.
2. Pour les composants existants, utilisez le wrapper `useDirectExchangeTransactions` pour faciliter la transition.
3. Testez soigneusement chaque fonctionnalité après migration pour s'assurer de la cohérence des données.
4. Utilisez les nouveaux composants `ExchangeActionButton` et `ExchangeHistory` comme référence.

---

Document préparé par l'équipe Planidocs - Avril 2025