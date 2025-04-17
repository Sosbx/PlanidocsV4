# Module de Planning

Ce module fournit une solution complète pour la gestion des plannings, avec des fonctionnalités de visualisation, d'import/export et de navigation temporelle.

## Structure du module

```
planning/
├── components/           # Composants UI
│   ├── admin/            # Composants pour l'administration
│   │   ├── PeriodSelector.tsx       # Sélection de période
│   │   ├── ImportDropZone.tsx       # Zone de glisser-déposer pour l'import
│   │   ├── PlanningToolbar.tsx      # Barre d'outils
│   │   ├── UserSelector.tsx         # Sélection d'utilisateur
│   │   └── AdminPlanningContainer.tsx # Conteneur pour la vue admin
│   └── shared/           # Composants partagés
│       ├── PlanningGrid.tsx         # Grille de planning
│       ├── PeriodNavigation.tsx     # Navigation entre périodes
│       ├── PlanningContainer.tsx    # Conteneur de base
│       └── UserPlanningContainer.tsx # Conteneur pour la vue utilisateur
├── context/              # Contextes React
│   └── PlanningViewContext.tsx      # Contexte pour la vue temporelle
├── hooks/                # Hooks personnalisés
│   ├── usePlanningView.ts           # Gestion des vues temporelles
│   └── useImportExport.ts           # Import/export de plannings
├── pages/                # Pages
│   ├── UserPlanningPage.tsx         # Page de planning utilisateur
│   └── GeneratedPlanningPage.tsx    # Page de planning généré
└── types/                # Types TypeScript
    └── viewTypes.ts                 # Types pour les vues temporelles
```

## Fonctionnalités principales

### Vues temporelles

Le module permet de visualiser les plannings selon différentes périodes :
- Mois
- Quadrimestre (4 mois)
- Semestre (6 mois)
- Année
- Personnalisée

La navigation entre les périodes est gérée par le hook `usePlanningView` et le contexte `PlanningViewContext`.

### Import/Export

Le module permet d'importer et d'exporter des plannings dans différents formats :
- Import de fichiers CSV
- Export en PDF
- Export en CSV

Ces fonctionnalités sont gérées par le hook `useImportExport`.

### Conteneurs

Le module fournit deux types de conteneurs :
- `PlanningContainer` : Conteneur de base pour afficher un planning
- `UserPlanningContainer` : Conteneur pour la vue utilisateur
- `AdminPlanningContainer` : Conteneur pour la vue administrateur

## Utilisation

### Vue utilisateur

```tsx
import { UserPlanningContainer, PlanningViewProvider } from 'features/planning';

const UserPlanningPage = () => {
  // ...
  return (
    <PlanningViewProvider initialView="month">
      <UserPlanningContainer
        assignments={assignments}
        exchanges={exchanges}
        directExchanges={directExchanges}
        replacements={replacements}
        desiderata={desiderata}
        userId={userId}
        showDesiderata={showDesiderata}
        onToggleDesiderata={handleToggleDesiderata}
        bagPhaseConfig={bagPhaseConfig}
        onCellClick={handleCellClick}
        periodId={periodId}
        users={users}
        loadExporters={loadExporters}
        plannings={plannings}
      />
    </PlanningViewProvider>
  );
};
```

### Vue administrateur

```tsx
import { AdminPlanningContainer, PlanningViewProvider } from 'features/planning';

const AdminPlanningPage = () => {
  // ...
  return (
    <PlanningViewProvider initialView="month">
      <AdminPlanningContainer
        users={users}
        selectedUserId={selectedUserId}
        onUserChange={handleUserChange}
        onPreviousUser={handlePreviousUser}
        onNextUser={handleNextUser}
        assignments={assignments}
        exchanges={exchanges}
        directExchanges={directExchanges}
        replacements={replacements}
        desiderata={desiderata}
        showDesiderata={showDesiderata}
        onToggleDesiderata={handleToggleDesiderata}
        bagPhaseConfig={bagPhaseConfig}
        onCellClick={handleCellClick}
        uploadPeriodId={uploadPeriodId}
        plannings={plannings}
        saveGeneratedPlanning={saveGeneratedPlanning}
        loadExporters={loadExporters}
        showImportZone={true}
      />
    </PlanningViewProvider>
  );
};
```

### Utilisation du hook usePlanningView

```tsx
import { usePlanningView } from 'features/planning';

const MyComponent = () => {
  const {
    viewType,
    dateRange,
    monthsToShow,
    setViewType,
    setCustomRange,
    setMonthsToShow,
    navigateNext,
    navigatePrevious,
    resetToToday,
    jumpToDate
  } = usePlanningView('month');

  // ...
};
```

### Utilisation du hook useImportExport

```tsx
import { useImportExport } from 'features/planning';

const MyComponent = () => {
  const {
    isProcessing,
    error,
    handleFileUpload,
    handleExportPDF,
    handleExportCSV,
    handleExportAllPDF,
    handleExportAllCSV
  } = useImportExport({
    uploadPeriodId,
    users,
    onSuccess: (message) => {
      // ...
    },
    onError: (message) => {
      // ...
    },
    saveGeneratedPlanning,
    loadExporters,
    plannings,
    startDate,
    endDate
  });

  // ...
};
```

## Améliorations futures

- Ajout de vues supplémentaires (semaine, jour)
- Filtrage avancé des plannings
- Statistiques sur les plannings
- Synchronisation avec des calendriers externes (Google Calendar, Outlook)
