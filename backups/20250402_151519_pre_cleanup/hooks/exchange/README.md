# Hooks d'échange

Ce dossier contient les hooks React liés aux fonctionnalités d'échange de gardes.

## Structure

La structure des hooks d'échange a été réorganisée pour améliorer la séparation des préoccupations et la maintenabilité du code :

```
src/hooks/exchange/
├── common/                  # Hooks communs utilisés par plusieurs fonctionnalités
│   ├── useShiftMatching.ts  # Hook pour la correspondance des gardes
│   └── index.ts             # Export des hooks communs
│
├── proposal/                # Hooks liés aux propositions d'échange
│   ├── useExchangeProposal.ts        # Hook principal pour les propositions d'échange
│   ├── useProposalReducer.ts         # Gestion de l'état avec un reducer
│   ├── useProposalOperations.ts      # Opérations sur l'état
│   ├── useProposalSubmission.ts      # Soumission du formulaire
│   ├── useProposalInitialization.ts  # Initialisation et utilitaires
│   └── index.ts                      # Export des hooks de proposition
│
├── direct/                  # Hooks liés aux échanges directs
│   ├── useDirectExchangeActions.ts   # Actions pour les échanges directs
│   ├── useDirectExchangeData.ts      # Gestion des données d'échange direct
│   ├── useDirectExchangeFilters.ts   # Filtres pour les échanges directs
│   ├── useDirectExchangeModals.ts    # Gestion des modals d'échange direct
│   ├── useDirectProposalActions.ts   # Actions pour les propositions directes
│   └── index.ts                      # Export des hooks d'échange direct
│
├── useDirectExchange.ts     # Hook principal pour les échanges directs
├── index.ts                 # Export de tous les hooks d'échange
└── README.md                # Documentation
```

## Utilisation

Pour utiliser les hooks d'échange, importez-les depuis le dossier `hooks/exchange` :

```typescript
// Import du hook principal d'échange
import { useExchangeProposal } from '../../hooks/exchange';

// Import d'un hook spécifique
import { useShiftMatching } from '../../hooks/exchange/common';
```

## Hooks disponibles

### Hooks de proposition d'échange

- `useExchangeProposal` : Hook principal pour gérer les propositions d'échange
- `useProposalReducer` : Gestion de l'état avec un reducer
- `useProposalOperations` : Opérations sur l'état (toggle, update, etc.)
- `useProposalSubmission` : Logique de soumission du formulaire
- `useProposalInitialization` : Fonctions d'initialisation et utilitaires

### Hooks communs

- `useShiftMatching` : Hook pour la correspondance des gardes

### Hooks d'échange direct

- `useDirectExchange` : Hook principal pour les échanges directs
- `useDirectExchangeActions` : Actions pour les échanges directs
- `useDirectExchangeData` : Gestion des données d'échange direct
- `useDirectExchangeFilters` : Filtres pour les échanges directs
- `useDirectExchangeModals` : Gestion des modals d'échange direct
- `useDirectProposalActions` : Actions pour les propositions directes
