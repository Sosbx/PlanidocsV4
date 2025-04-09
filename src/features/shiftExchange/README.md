# Feature de Bourse aux Gardes

Cette fonctionnalité permet aux utilisateurs de participer à la bourse aux gardes, un processus centralisé d'échange de gardes avec plusieurs phases.

## Structure du dossier

La fonctionnalité est organisée selon une architecture orientée feature, avec les sous-dossiers suivants :

- **components/** : Composants React spécifiques à la bourse aux gardes
  - `BagPhaseIndicator.tsx` : Indicateur de la phase actuelle
  - `GroupedShiftExchangeList.tsx` : Liste des échanges groupés
  - `ShiftExchangeForm.tsx` : Formulaire de soumission d'échange
  - `index.ts` : Exporte tous les composants

- **hooks/** : Hooks React spécifiques à la bourse aux gardes
  - `useBagPhase.ts` : Gestion des phases de la bourse aux gardes
  - `useShiftExchangeData.ts` : Chargement et gestion des données
  - `useShiftExchangeActions.ts` : Actions sur les échanges
  - `useShiftMatching.ts` : Logique d'appariement des échanges
  - `index.ts` : Exporte tous les hooks

- **utils/** : Fonctions utilitaires spécifiques à la bourse aux gardes
  - `shiftExchangeUtils.ts` : Fonctions de formatage, validation, etc.
  - `index.ts` : Exporte toutes les fonctions utilitaires

- **types.ts** : Types TypeScript spécifiques à la bourse aux gardes
- **index.ts** : Point d'entrée qui exporte tous les éléments de la fonctionnalité

## Phases de la bourse aux gardes

La bourse aux gardes fonctionne selon un cycle de phases :

1. **Fermée** : La bourse est fermée, aucune action n'est possible
2. **Soumission** : Les utilisateurs peuvent soumettre des demandes d'échange
3. **Appariement** : Le système apparie les demandes compatibles
4. **Validation** : Les utilisateurs valident les appariements proposés
5. **Terminée** : La bourse est terminée, les échanges validés sont appliqués

## Utilisation

Pour utiliser cette fonctionnalité dans une page ou un composant :

```tsx
import { BagPhaseIndicator, GroupedShiftExchangeList } from '../features/shiftExchange';
import { useBagPhase, useShiftExchangeData } from '../features/shiftExchange';

const ShiftExchangePage: React.FC = () => {
  const { currentPhase, phaseInfo } = useBagPhase();
  const { exchanges, loading } = useShiftExchangeData();
  
  return (
    <div>
      <BagPhaseIndicator phase={currentPhase} phaseInfo={phaseInfo} />
      <GroupedShiftExchangeList exchanges={exchanges} loading={loading} />
    </div>
  );
};
```

## Interactions avec d'autres modules

Cette fonctionnalité interagit principalement avec :

- **API Firebase** : Pour la persistance des données
- **Context utilisateur** : Pour l'authentification et les informations utilisateur
- **Context période de planning** : Pour les informations sur la période courante
