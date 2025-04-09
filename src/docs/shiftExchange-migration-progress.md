# Migration des composants de la bourse aux gardes

Ce document suit la progression de la migration des composants de la bourse aux gardes vers la nouvelle architecture.

## Composants migrés

### Composants d'administration

Les composants d'administration pour la bourse aux gardes ont été migrés de `src/components/admin/exchange` vers `src/features/shiftExchange/components/admin` :

- ✅ `InterestedUserCard` - Carte affichant un utilisateur intéressé par un échange
- ✅ `ExchangeList` - Liste des échanges disponibles
- ✅ `ExchangeHistoryList` - Liste de l'historique des échanges
- ✅ `ExchangeHistoryComponent` - Conteneur pour l'historique des échanges (renommé pour éviter un conflit avec le type `ExchangeHistory`)

Ces composants sont maintenant exportés via `src/features/shiftExchange/components/admin/index.ts` et peuvent être importés depuis `src/features/shiftExchange/components`.

### Composants de phase

- ✅ `BagPhaseIndicator` - Indicateur de phase de la bourse aux gardes (imports mis à jour)
- ✅ `BagPhaseConfigModal` - Modal de configuration des phases

### Composants d'interface utilisateur

- ✅ `ShiftExchangeCalendarView` - Vue calendrier des échanges
- ✅ `ShiftExchangeFilters` - Filtres pour les échanges
- ✅ `ShiftExchangeStates` - États d'affichage (chargement, vide, erreur)

### Hooks

- ✅ `useBagPhase` - Hook pour la gestion de la phase de la bourse aux gardes (imports mis à jour)
- ✅ `useShiftExchangeData` - Hook pour les données de la bourse aux gardes (imports mis à jour)
- ✅ `useShiftInteraction` - Hook pour les interactions avec les gardes (imports mis à jour)
- ✅ `useConflictCheck` - Hook pour la vérification des conflits (migré depuis src/hooks)
- ✅ `useExchangeManagement` - Hook pour la gestion des échanges (migré depuis src/hooks)

## Composants migrés

### Pages principales

- ✅ `ShiftExchangePage` - Page principale de la bourse aux gardes
- ✅ `AdminShiftExchangePage` - Page d'administration de la bourse aux gardes

## Composants à migrer

### Composants principaux

- [ ] `GroupedShiftExchangeList` - Liste des échanges groupés par date

## Prochaines étapes

1. Migrer le composant `GroupedShiftExchangeList` vers `src/features/shiftExchange/components`
2. Mettre à jour les imports dans les fichiers qui utilisent ce composant
3. Exécuter les scripts de nettoyage pour supprimer les anciens fichiers
   - `src/scripts/cleanup-hooks.sh` pour supprimer les anciens hooks
   - `src/scripts/cleanup-obsolete-folders.sh` pour supprimer les anciens composants
4. Vérifier que tout fonctionne correctement après le nettoyage
