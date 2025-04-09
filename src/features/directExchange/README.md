# Feature d'Échanges Directs

Cette fonctionnalité permet aux utilisateurs d'échanger directement leurs gardes avec d'autres médecins, sans passer par le processus de la bourse aux gardes.

## Structure du dossier

La fonctionnalité est organisée selon une architecture orientée feature, avec les sous-dossiers suivants :

- **components/** : Composants React spécifiques aux échanges directs
  - `DirectExchangeContainer.tsx` : Composant principal qui orchestre la fonctionnalité
  - `index.ts` : Exporte tous les composants

- **hooks/** : Hooks React spécifiques aux échanges directs
  - `useDirectExchangeFilters.ts` : Gestion des filtres d'affichage
  - `useDirectExchangeModals.ts` : Gestion des modals (fenêtres de dialogue)
  - `useDirectExchangeData.ts` : Chargement et gestion des données
  - `useDirectExchangeActions.ts` : Actions sur les échanges (proposer, supprimer, etc.)
  - `useDirectProposalActions.ts` : Actions sur les propositions (accepter, rejeter, etc.)
  - `index.ts` : Exporte tous les hooks

- **utils/** : Fonctions utilitaires spécifiques aux échanges directs
  - `directExchangeUtils.ts` : Fonctions de formatage, conversion, etc.
  - `index.ts` : Exporte toutes les fonctions utilitaires

- **types.ts** : Types TypeScript spécifiques aux échanges directs
- **index.ts** : Point d'entrée qui exporte tous les éléments de la fonctionnalité

## Utilisation

Pour utiliser cette fonctionnalité dans une page ou un composant :

```tsx
import { DirectExchangeContainer } from '../features/directExchange';

const DirectExchangePage: React.FC = () => {
  return <DirectExchangeContainer />;
};
```

Pour utiliser les hooks ou les utilitaires :

```tsx
import { useDirectExchangeFilters, useDirectExchangeData } from '../features/directExchange';
import { formatPeriodForDisplay } from '../features/directExchange/utils';

const MyComponent: React.FC = () => {
  const { filterOptions, filterProps } = useDirectExchangeFilters();
  const { directExchanges, loading } = useDirectExchangeData(null);
  
  // ...
  
  return (
    <div>
      {/* ... */}
      <span>{formatPeriodForDisplay('M')}</span>
      {/* ... */}
    </div>
  );
};
```

## Interactions avec d'autres modules

Cette fonctionnalité interagit principalement avec :

- **API Firebase** : Pour la persistance des données
- **Context utilisateur** : Pour l'authentification et les informations utilisateur
- **Context période de planning** : Pour les informations sur la période courante
