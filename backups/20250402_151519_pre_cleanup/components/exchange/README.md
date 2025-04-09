# Composants d'échange de gardes

Ce dossier contient les composants et hooks pour la gestion des échanges de gardes entre médecins.

## Structure

```
exchange/
├── components/                # Sous-composants réutilisables
│   ├── ExchangeModalHeader.tsx
│   ├── ExchangeModalOperationTypes.tsx
│   ├── ExchangeModalShiftSelector.tsx
│   ├── ExchangeModalCommentField.tsx
│   └── ExchangeModalFooter.tsx
├── hooks/                     # Hooks personnalisés
│   └── useShiftMatching.ts
├── types/                     # Types et interfaces
│   └── exchangeTypes.ts
└── index.ts                   # Point d'entrée pour les exports
```

## Composants principaux

Le composant ProposedExchangeModal a été supprimé.

## Sous-composants

### ExchangeModalHeader

Affiche les informations de la garde (type, période, date, utilisateur).

### ExchangeModalOperationTypes

Gère l'affichage et la sélection des types d'opération (reprendre/échanger).

### ExchangeModalShiftSelector

Affiche la liste des gardes disponibles pour l'échange et gère la sélection/désélection des gardes.

### ExchangeModalCommentField

Champ de commentaire pour la proposition.

### ExchangeModalFooter

Boutons d'action (annuler, valider) et messages d'aide pour les propositions existantes.

## Hooks

### useShiftMatching

Implémente l'algorithme de correspondance entre les gardes proposées et disponibles, et fournit des fonctions utilitaires pour la standardisation des périodes et dates.

## Utilisation

Le composant ProposedExchangeModal a été supprimé et ne peut plus être utilisé.

## Avantages de la refactorisation

1. **Séparation des préoccupations** : Chaque composant a une responsabilité unique et bien définie
2. **Testabilité améliorée** : Les composants plus petits sont plus faciles à tester
3. **Réutilisabilité** : Les composants peuvent être réutilisés dans d'autres parties de l'application
4. **Maintenabilité** : Les bugs sont plus faciles à localiser et à corriger
5. **Lisibilité** : Le code est plus facile à comprendre et à maintenir

## Résolution des problèmes

La refactorisation a résolu plusieurs problèmes :

1. **Problème d'affichage des boutons** : Lorsque l'utilisateur recliquait sur une garde après avoir validé un échange, les boutons n'étaient pas correctement affichés.
2. **Problème de correspondance des gardes** : L'algorithme de correspondance a été amélioré pour mieux identifier les gardes proposées.
3. **Gestion des propositions combinées** : Ajout d'une gestion explicite pour les propositions de type 'both' (qui combinent reprise et échange).
