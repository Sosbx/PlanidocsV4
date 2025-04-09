# Feature de Planification

Cette fonctionnalité permet de gérer les plannings, les périodes, les assignations de gardes et les desideratas.

## Structure du dossier

La fonctionnalité est organisée selon une architecture orientée feature, avec les sous-dossiers suivants :

- **components/** : Composants React spécifiques à la planification
  - `PlanningTable.tsx` : Tableau de planning
  - `PlanningPeriodSelector.tsx` : Sélecteur de période
  - `DesiderataControls.tsx` : Contrôles pour les desideratas
  - `index.ts` : Exporte tous les composants

- **hooks/** : Hooks React spécifiques à la planification
  - `usePlanningPeriod.ts` : Gestion des périodes de planning
  - `useShiftAssignments.ts` : Gestion des assignations de gardes
  - `useDesiderata.ts` : Gestion des desideratas
  - `index.ts` : Exporte tous les hooks

- **utils/** : Fonctions utilitaires spécifiques à la planification
  - `planningUtils.ts` : Fonctions de formatage, validation, etc.
  - `index.ts` : Exporte toutes les fonctions utilitaires

- **types.ts** : Types TypeScript spécifiques à la planification
- **index.ts** : Point d'entrée qui exporte tous les éléments de la fonctionnalité

## Fonctionnalités principales

### Gestion des périodes

- Création, modification et suppression de périodes
- Changement de statut des périodes (brouillon, publié, validé, archivé)

### Gestion des plannings

- Génération de plannings
- Visualisation des plannings
- Modification des assignations
- Validation des plannings

### Gestion des desideratas

- Soumission de desideratas par les utilisateurs
- Visualisation des desideratas
- Prise en compte des desideratas lors de la génération des plannings

## Utilisation

Pour utiliser cette fonctionnalité dans une page ou un composant :

```tsx
import { PlanningTable, PlanningPeriodSelector } from '../features/planning';
import { usePlanningPeriod, useShiftAssignments } from '../features/planning';

const PlanningPage: React.FC = () => {
  const { currentPeriod, periods, selectPeriod } = usePlanningPeriod();
  const { assignments, loading, updateAssignment } = useShiftAssignments(currentPeriod?.id);
  
  return (
    <div>
      <PlanningPeriodSelector 
        periods={periods} 
        selectedPeriod={currentPeriod} 
        onSelectPeriod={selectPeriod} 
      />
      <PlanningTable 
        assignments={assignments} 
        loading={loading} 
        onUpdateAssignment={updateAssignment} 
      />
    </div>
  );
};
```

## Interactions avec d'autres modules

Cette fonctionnalité interagit principalement avec :

- **API Firebase** : Pour la persistance des données
- **Context utilisateur** : Pour l'authentification et les informations utilisateur
- **Feature d'échanges directs** : Pour la gestion des échanges de gardes
- **Feature de bourse aux gardes** : Pour la gestion des échanges de gardes
