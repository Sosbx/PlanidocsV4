# Correction du problème d'affichage des pastilles C, E, R en temps réel

## Problème identifié

Les pastilles C (Cession), E (Échange) et R (Remplacement) ne s'affichaient pas immédiatement sur les gardes après qu'un utilisateur ait choisi une option. Il fallait recharger la page pour que les pastilles apparaissent, même si les données étaient correctement enregistrées dans Firebase.

## Causes du problème

Après analyse du code, nous avons identifié plusieurs causes à ce problème :

1. **Souscription incomplète aux données Firebase** : La fonction `subscribeToDirectExchanges` n'utilisait `onSnapshot` que pour les échanges directs, mais utilisait `getDocs` (requête ponctuelle) pour les cessions et les remplacements.

2. **Délai de rechargement des données** : Dans le composant `DirectExchangeContainer`, un délai de 500 ms était utilisé avant de recharger les données après une action réussie, ce qui pouvait être insuffisant pour que Firebase ait terminé de traiter la transaction.

3. **Absence de mécanisme de rafraîchissement forcé** : Le composant `DirectExchangeTable` ne disposait pas d'un mécanisme efficace pour forcer le re-rendu lorsque les données changeaient.

## Solutions implémentées

### 1. Amélioration des souscriptions Firebase en temps réel

Dans le fichier `src/lib/firebase/directExchange/core.ts`, nous avons modifié la fonction `subscribeToDirectExchanges` pour utiliser `onSnapshot` pour toutes les collections (échanges, cessions et remplacements) :

```typescript
export const subscribeToDirectExchanges = (
  callback: (exchanges: any[]) => void
): (() => void) => {
  try {
    // ...
    
    // Stocker les données actuelles de chaque collection
    let currentExchangesData: any[] = [];
    let currentCessionsData: any[] = [];
    let currentReplacementsData: any[] = [];
    
    // Fonction pour combiner et envoyer les données
    const combineAndSendData = () => {
      const allExchanges = [
        ...currentExchangesData,
        ...currentCessionsData,
        ...currentReplacementsData
      ];
      
      // Appeler le callback avec les données combinées
      callback(allExchanges);
    };
    
    // Souscrire aux échanges directs
    const unsubscribeExchanges = onSnapshot(exchangesQuery, (snapshot) => {
      currentExchangesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        operationType: 'exchange'
      }));
      
      combineAndSendData();
    });
    
    // Souscrire aux cessions directes
    const unsubscribeCessions = onSnapshot(cessionsQuery, (snapshot) => {
      currentCessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        operationType: 'give'
      }));
      
      combineAndSendData();
    });
    
    // Souscrire aux remplacements directs
    const unsubscribeReplacements = onSnapshot(replacementsQuery, (snapshot) => {
      currentReplacementsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        operationType: 'replacement'
      }));
      
      combineAndSendData();
    });
    
    // Retourner une fonction qui annule toutes les souscriptions
    return () => {
      unsubscribeExchanges();
      unsubscribeCessions();
      unsubscribeReplacements();
    };
  } catch (error) {
    // ...
  }
};
```

### 2. Suppression du délai de rechargement des données

Dans le fichier `src/components/exchange/direct/DirectExchangeContainer.tsx`, nous avons supprimé le délai de 500 ms pour recharger les données immédiatement après une action réussie :

```typescript
const {
  toast,
  setToast,
  isProcessing,
  handleModalSubmit,
  updateExchangeOptions,
  removeExchange
} = useDirectExchangeActions({
  onSuccess: (message) => {
    // Rafraîchir les données immédiatement
    console.log('Action réussie, rafraîchissement des données...');
    loadDirectExchanges();
  }
});
```

### 3. Ajout d'un mécanisme de rafraîchissement forcé

Dans le fichier `src/components/exchange/DirectExchangeTable.tsx`, nous avons ajouté un mécanisme de rafraîchissement forcé lorsque les données changent :

```typescript
// Référence pour suivre les valeurs précédentes des props
const prevPropsRef = useRef<{
  directExchanges: ShiftExchange[];
  receivedProposals: ShiftExchange[];
  userProposals: DirectExchangeProposal[];
}>({
  directExchanges: [],
  receivedProposals: [],
  userProposals: []
});

// Effet pour mettre à jour les données précédentes et détecter les changements
useEffect(() => {
  // Vérifier si les données ont changé
  const hasExchangesChanged = directExchanges.length !== prevPropsRef.current.directExchanges.length;
  const hasProposalsChanged = userProposals.length !== prevPropsRef.current.userProposals.length;
  const hasReceivedProposalsChanged = receivedProposals.length !== prevPropsRef.current.receivedProposals.length;
  
  // Si les données ont changé, forcer le rafraîchissement
  if (hasExchangesChanged || hasProposalsChanged || hasReceivedProposalsChanged) {
    // Incrémenter refreshKey pour forcer le re-rendu du composant
    setRefreshKey(prevKey => prevKey + 1);
    
    console.log('Données mises à jour, rafraîchissement forcé:', {
      directExchanges: directExchanges.length,
      userProposals: userProposals.length,
      receivedProposals: receivedProposals.length,
      refreshKey: refreshKey + 1,
      hasExchangesChanged,
      hasProposalsChanged,
      hasReceivedProposalsChanged
    });
  }
  
  // Mettre à jour les données précédentes
  prevPropsRef.current = {
    directExchanges,
    receivedProposals,
    userProposals
  };
}, [directExchanges, userProposals, receivedProposals]);
```

Et nous avons utilisé cette clé de rafraîchissement pour forcer le re-rendu complet de la table :

```typescript
{/* Utiliser refreshKey comme clé pour forcer le re-rendu complet de la table */}
<table key={refreshKey} className="min-w-full border-collapse">
  {/* ... */}
</table>
```

## Résultats

Après ces améliorations :

1. Les pastilles C, E, R s'affichent désormais en temps réel après qu'un utilisateur ait choisi une option, sans nécessiter de rechargement de la page.
2. Les souscriptions en temps réel sont correctement configurées pour toutes les collections (échanges, cessions et remplacements).
3. Le composant se rafraîchit automatiquement lorsque les données changent, grâce au mécanisme de clé de rafraîchissement.

## Recommandations pour le futur

1. **Optimisation des souscriptions** : Limiter le nombre de documents récupérés en ajoutant des filtres supplémentaires (par exemple, par date).
2. **Mise en cache locale** : Implémenter un système de cache local pour réduire la charge sur Firebase et améliorer les performances.
3. **Gestion des erreurs** : Améliorer la gestion des erreurs et ajouter des mécanismes de reconnexion automatique en cas de perte de connexion.
4. **Tests unitaires** : Ajouter des tests unitaires pour vérifier que les souscriptions fonctionnent correctement et que les données sont correctement mises à jour.
5. **Optimisation du rendu** : Remplacer le mécanisme de rafraîchissement forcé par une approche plus fine utilisant `React.memo` et des comparaisons personnalisées pour éviter les re-rendus inutiles.
