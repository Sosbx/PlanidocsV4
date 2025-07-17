# Améliorations de la Structure du Code

Ce document décrit les améliorations apportées à la structure du code pour réduire la duplication et la complexité dans le projet.

## 1. Hooks Composables

Nous avons décomposé le hook monolithique `useExchangeData` en plusieurs hooks plus petits et spécialisés, suivant le principe de séparation des préoccupations.

### Hooks créés :

- **useExchangeLoader** : Responsable uniquement du chargement des données d'échange depuis Firestore.
- **useReceivedShifts** : Gère le chargement des gardes reçues via des échanges.
- **useExchangeFilter** : Filtre les échanges selon différents critères.
- **useExchangeConflicts** : Détecte les conflits entre les gardes.
- **useComposableExchangeData** : Hook principal qui utilise tous les hooks spécialisés.

### Avantages :

- **Meilleure séparation des préoccupations** : Chaque hook a une responsabilité unique et bien définie.
- **Code plus maintenable** : Les modifications peuvent être apportées à un aspect spécifique sans affecter les autres.
- **Testabilité améliorée** : Les hooks plus petits sont plus faciles à tester individuellement.
- **Réutilisabilité accrue** : Les hooks spécialisés peuvent être réutilisés dans différents contextes.

## 2. Composants Partagés

Nous avons extrait les composants dupliqués entre les pages en composants partagés réutilisables.

### Composants créés :

- **ExchangeFilterBar** : Barre de filtrage commune pour les pages d'échange.
- **ViewModeSwitcher** : Composant pour basculer entre les vues liste et calendrier.
- **ExchangePageTemplate** : Template de page pour les pages d'échange.

### Avantages :

- **Réduction de la duplication** : Le même code n'est plus répété dans plusieurs fichiers.
- **Cohérence de l'interface** : Les composants partagés garantissent une expérience utilisateur cohérente.
- **Maintenance simplifiée** : Les modifications apportées à un composant partagé sont automatiquement appliquées partout où il est utilisé.

## 3. Pages Refactorisées

Nous avons refactorisé les pages principales pour utiliser les nouveaux hooks composables et composants partagés.

### Pages refactorisées :

- **ShiftExchangePage.refactored.tsx** : Version améliorée de la page de bourse aux gardes.
- **DirectExchangePage.refactored.tsx** : Version améliorée de la page d'échanges directs.

### Améliorations :

- **Code plus concis** : Les pages sont plus courtes et plus faciles à comprendre.
- **Logique métier mieux organisée** : La logique est déplacée dans des hooks spécialisés.
- **Interface utilisateur cohérente** : Les composants partagés garantissent une expérience utilisateur cohérente.

## Comment utiliser ces améliorations

### Utilisation des hooks composables :

```typescript
// Avant
const { 
  exchanges, 
  filteredExchanges, 
  loading, 
  userAssignments, 
  receivedShifts,
  conflictStates,
  conflictPeriodsMap,
  interestedPeriodsMap
} = useExchangeData(users, filterOptions, onFirstExchangeLoad);

// Après
const { 
  exchanges, 
  filteredExchanges, 
  loading, 
  userAssignments, 
  receivedShifts,
  conflictStates,
  conflictPeriodsMap,
  interestedPeriodsMap
} = useComposableExchangeData(users, filterOptions, onFirstExchangeLoad);
```

### Utilisation des composants partagés :

```tsx
// Avant
<div className="flex items-center gap-2">
  <button
    onClick={() => setViewMode('list')}
    className={`flex items-center gap-1 px-2 py-1 rounded-md ${
      viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
    }`}
  >
    <List className="h-4 w-4" />
    <span className="text-xs font-medium">Liste</span>
  </button>
  <button
    onClick={() => setViewMode('calendar')}
    className={`flex items-center gap-1 px-2 py-1 rounded-md ${
      viewMode === 'calendar' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
    }`}
  >
    <Calendar className="h-4 w-4" />
    <span className="text-xs font-medium">Calendrier</span>
  </button>
</div>

// Après
<ViewModeSwitcher 
  viewMode={viewMode} 
  setViewMode={setViewMode}
  showText={!isSmallScreen}
/>
```

### Utilisation du template de page :

```tsx
// Avant
return (
  <div className="max-w-7xl mx-auto px-4 py-6">
    <Toast 
      message={toast.message}
      isVisible={toast.visible}
      type={toast.type}
      onClose={() => setToast({ ...toast, visible: false })}
    />

    <div className="flex justify-between items-center mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
        <h1 className="text-2xl font-bold text-indigo-900">Bourse aux Gardes</h1>
        <div className="ml-0 sm:ml-3">
          <BagPhaseIndicator />
        </div>
      </div>
      
      <ViewModeSwitcher 
        viewMode={viewMode} 
        setViewMode={setViewMode}
        showText={!isSmallScreen}
      />
    </div>

    <PhaseInfoBanner bagPhaseConfig={bagPhaseConfig} />

    <ShiftExchangeFilters
      filterPeriod={filterPeriod}
      setFilterPeriod={setFilterPeriod}
      showOwnShifts={showOwnShifts}
      setShowOwnShifts={setShowOwnShifts}
      showMyInterests={showMyInterests}
      setShowMyInterests={setShowMyInterests}
      showDesiderata={showDesiderata}
      setShowDesiderata={setShowDesiderata}
      hidePrimaryDesiderata={hidePrimaryDesiderata}
      setHidePrimaryDesiderata={setHidePrimaryDesiderata}
      hideSecondaryDesiderata={hideSecondaryDesiderata}
      setHideSecondaryDesiderata={setHideSecondaryDesiderata}
      isInteractionDisabled={isInteractionDisabled}
      bagPhaseConfig={bagPhaseConfig}
    />

    {/* Contenu principal */}
  </div>
);

// Après
return (
  <ExchangePageTemplate
    title="Bourse aux Gardes"
    user={user}
    users={users}
    exchanges={exchanges}
    filteredExchanges={filteredExchanges}
    loading={loading}
    error={null}
    userAssignments={userAssignments}
    receivedShifts={receivedShifts}
    conflictStates={conflictStates}
    conflictPeriodsMap={conflictPeriodsMap}
    interestedPeriodsMap={interestedPeriodsMap}
    bagPhaseConfig={bagPhaseConfig}
    isInteractionDisabled={isInteractionDisabled}
    onToggleInterest={handleToggleInterest}
    filterOptions={filterOptions}
    renderCustomHeader={renderCustomHeader}
    renderCalendarView={renderCalendarView}
    isMobile={isMobile}
    isSmallScreen={isSmallScreen}
  />
);
```

## Prochaines étapes

1. **Migrer les pages existantes** : Remplacer les implémentations actuelles par les versions refactorisées.
2. **Ajouter des tests unitaires** : Profiter de la meilleure séparation des préoccupations pour ajouter des tests unitaires.
3. **Documenter les hooks et composants** : Ajouter des commentaires JSDoc pour faciliter l'utilisation des hooks et composants.
4. **Optimiser les performances** : Utiliser React.memo et useCallback pour optimiser les performances des composants partagés.
