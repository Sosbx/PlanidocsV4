# Améliorations des mises à jour en temps réel pour les échanges de gardes

Ce document détaille les améliorations apportées au système de mise à jour en temps réel des échanges de gardes, en particulier pour l'affichage des pastilles et la persistance des options sélectionnées.

## Problèmes identifiés

1. **Pastilles non mises à jour en temps réel** : Les pastilles indiquant qu'une garde est proposée au don/échange/remplacement n'étaient pas mises à jour immédiatement après une action de l'utilisateur. Il fallait recharger la page pour voir les changements.

2. **Options sélectionnées non persistantes** : Lorsqu'un utilisateur revenait sur une garde pour laquelle il avait déjà proposé une option d'échange/remplacement/cession, les options n'étaient pas toujours correctement restaurées dans la fenêtre modale.

3. **Problème de reconnaissance des périodes** : Les gardes de l'après-midi étaient parfois reconnues comme des gardes du matin dans la fenêtre modale, même si elles étaient correctement placées dans la colonne de l'après-midi dans la section "Mes gardes".

## Causes des problèmes

1. **Absence de souscription en temps réel** : Le hook `useDirectExchangeData` utilisait des appels Firebase standard pour charger les données, mais n'utilisait pas de souscription en temps réel pour les mises à jour.

2. **Confusion dans la standardisation des périodes** : La fonction `standardizePeriod` dans `periodUtils.ts` incluait 'AM' dans la liste des périodes qui correspondent à 'M' (matin), ce qui causait une confusion avec 'AM' (après-midi).

## Solutions apportées

### 1. Mise en place de souscriptions en temps réel

Nous avons ajouté deux nouvelles fonctions dans le module `directExchange/core.ts` :

```typescript
/**
 * Souscrire aux échanges directs en temps réel
 * @param callback Fonction appelée à chaque mise à jour des données
 * @returns Fonction pour annuler la souscription
 */
export const subscribeToDirectExchanges = (
  callback: (exchanges: any[]) => void
): (() => void) => {
  // ...
};

/**
 * Souscrire aux propositions d'un utilisateur en temps réel
 * @param userId ID de l'utilisateur
 * @param callback Fonction appelée à chaque mise à jour des données
 * @returns Fonction pour annuler la souscription
 */
export const subscribeToUserProposals = (
  userId: string,
  callback: (proposals: any[]) => void
): (() => void) => {
  // ...
};
```

Ces fonctions utilisent `onSnapshot` de Firebase pour souscrire aux changements en temps réel dans les collections d'échanges et de propositions.

### 2. Modification du hook useDirectExchangeData

Nous avons modifié le hook `useDirectExchangeData` pour utiliser ces souscriptions en temps réel :

```typescript
// Mettre en place les souscriptions en temps réel
const setupRealtimeSubscriptions = useCallback(() => {
  if (!user) return;
  
  // Nettoyer les souscriptions existantes
  if (unsubscribeExchangesRef.current) {
    unsubscribeExchangesRef.current();
    unsubscribeExchangesRef.current = null;
  }
  
  if (unsubscribeProposalsRef.current) {
    unsubscribeProposalsRef.current();
    unsubscribeProposalsRef.current = null;
  }
  
  // Souscrire aux échanges directs
  try {
    const unsubscribeExchanges = subscribeToDirectExchanges((exchangesData) => {
      console.log('Mise à jour en temps réel des échanges:', exchangesData.length);
      setDirectExchanges(exchangesData);
    });
    
    unsubscribeExchangesRef.current = unsubscribeExchanges;
    
    // Souscrire aux propositions de l'utilisateur
    const unsubscribeProposals = subscribeToUserProposals(user.id, (proposals) => {
      console.log('Mise à jour en temps réel des propositions:', proposals.length);
      setUserProposals(proposals);
    });
    
    unsubscribeProposalsRef.current = unsubscribeProposals;
    
    console.log('Souscriptions en temps réel mises en place');
  } catch (error) {
    console.error('Erreur lors de la mise en place des souscriptions en temps réel:', error);
    setError('Erreur lors de la mise en place des souscriptions en temps réel');
  }
}, [user]);
```

### 3. Correction de la standardisation des périodes

Nous avons corrigé la fonction `standardizePeriod` dans `periodUtils.ts` pour éviter la confusion entre 'AM' (après-midi) et 'AM' (matin en anglais) :

```typescript
// Mapping des différentes représentations possibles
// Note: 'AM' a été retiré de la liste des périodes du matin pour éviter la confusion avec l'après-midi
if (['M', 'MATIN', 'MORNING', '1', 'MAT', 'MORN'].includes(periodStr)) return 'M';

// Pour l'après-midi, vérifier d'abord si c'est exactement 'AM' (cas spécial)
if (periodStr === 'AM') return 'AM';

// Autres représentations de l'après-midi
if (['APRÈS-MIDI', 'APRES-MIDI', 'AFTERNOON', '2', 'PM', 'MIDI', 'APM'].includes(periodStr)) return 'AM';
```

## Améliorations supplémentaires pour l'affichage en temps réel des pastilles

Malgré les améliorations initiales, l'affichage des pastilles en temps réel ne fonctionnait toujours pas correctement. Nous avons donc apporté des améliorations supplémentaires au composant `DirectExchangeTable` :

### 1. Ajout d'un mécanisme de rafraîchissement forcé

Nous avons ajouté un état local `refreshKey` qui est incrémenté à chaque fois que les données changent :

```typescript
// État pour forcer le rafraîchissement du composant
const [refreshKey, setRefreshKey] = useState<number>(0);

// Effet pour forcer le rafraîchissement du composant lorsque les données changent
useEffect(() => {
  // Incrémenter refreshKey pour forcer le re-rendu du composant
  setRefreshKey(prevKey => prevKey + 1);
  
  console.log('Données mises à jour, rafraîchissement forcé:', {
    directExchanges: directExchanges.length,
    userProposals: userProposals.length,
    receivedProposals: receivedProposals.length,
    refreshKey: refreshKey + 1
  });
}, [directExchanges, userProposals, receivedProposals]);
```

### 2. Utilisation de la clé de rafraîchissement dans le rendu

Nous avons utilisé `refreshKey` comme clé pour la table, ce qui force React à recréer complètement le composant lorsque les données changent :

```typescript
{/* Utiliser refreshKey comme clé pour forcer le re-rendu complet de la table */}
<table key={refreshKey} className="min-w-full border-collapse">
  {/* ... */}
</table>
```

### 3. Affichage de la clé de rafraîchissement pour le débogage

Nous avons ajouté un affichage de la clé de rafraîchissement dans le message de débogage pour faciliter le suivi des mises à jour :

```typescript
<div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-2 mb-4 rounded">
  <p className="text-sm font-medium">Mode débogage activé</p>
  <p className="text-xs">
    Données de test chargées : {Object.keys(testUserAssignments).length} gardes utilisateur, {testDirectExchanges.length} gardes proposées
  </p>
  <p className="text-xs">
    Données réelles : {Object.keys(userAssignments).length} gardes utilisateur, {directExchanges.length} gardes proposées, {userProposals.length} propositions utilisateur
  </p>
  <p className="text-xs">
    Clé de rafraîchissement : {refreshKey} (change à chaque mise à jour des données)
  </p>
</div>
```

## Résultats

Après ces améliorations :

1. Les pastilles sont mises à jour en temps réel après une action de l'utilisateur, sans nécessiter de rechargement de la page.
2. Les options sélectionnées sont correctement restaurées lors de la réouverture de la fenêtre modale.
3. Les gardes de l'après-midi sont correctement reconnues comme telles dans la fenêtre modale.
4. Le composant se rafraîchit automatiquement lorsque les données changent, grâce au mécanisme de clé de rafraîchissement.

## Recommandations pour le futur

1. **Optimisation des souscriptions** : Limiter le nombre de documents récupérés en ajoutant des filtres supplémentaires (par exemple, par date).
2. **Mise en cache locale** : Implémenter un système de cache local pour réduire la charge sur Firebase et améliorer les performances.
3. **Gestion des erreurs** : Améliorer la gestion des erreurs et ajouter des mécanismes de reconnexion automatique en cas de perte de connexion.
4. **Tests unitaires** : Ajouter des tests unitaires pour vérifier que les souscriptions fonctionnent correctement et que les données sont correctement mises à jour.
5. **Optimisation du rendu** : Remplacer le mécanisme de rafraîchissement forcé par une approche plus fine utilisant `React.memo` et des comparaisons personnalisées pour éviter les re-rendus inutiles.
