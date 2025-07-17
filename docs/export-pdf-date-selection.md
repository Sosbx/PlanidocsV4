# Sélection de dates pour l'export PDF - Documentation

## Vue d'ensemble

L'administrateur peut maintenant choisir la période de dates à exporter lors de l'export PDF des plannings. Cette fonctionnalité a été intégrée directement dans le modal existant d'export PDF.

## Modifications apportées

### 1. Modal d'export PDF amélioré (`ExportPDFModal.tsx`)

Le modal comprend maintenant :
- **Sélection de dates** : Deux champs de date (début et fin)
- **Valeur par défaut** : Les 4 derniers mois (comme avant)
- **Interface intuitive** : Icône calendrier et labels clairs
- **Validation** : La date de fin ne peut pas être antérieure à la date de début

### 2. Propagation des dates personnalisées

Les dates sélectionnées sont propagées à travers toute la chaîne d'export :
- `AdminPlanningContainer` → `useImportExport` → `useExport` → fonctions d'export

### 3. Interface utilisateur

```
┌─────────────────────────────────────────┐
│  Télécharger le planning en PDF         │
│  [Nom de l'utilisateur]                 │
│                                         │
│  📅 Période à exporter                  │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Date début  │  │ Date fin    │      │
│  │ [____-__-__]│  │ [____-__-__]│      │
│  └─────────────┘  └─────────────┘      │
│  Par défaut : les 4 derniers mois       │
│                                         │
│  [Planning seul]                        │
│  [Planning avec desiderata]             │
│                                         │
└─────────────────────────────────────────┘
```

## Fichiers modifiés

1. **`/src/features/planning/components/admin/ExportPDFModal.tsx`**
   - Ajout des états pour les dates
   - Ajout des champs de sélection de dates
   - Passage des dates aux callbacks d'export

2. **`/src/features/planning/components/admin/AdminPlanningContainer.tsx`**
   - Mise à jour des handlers pour accepter les dates personnalisées
   - Passage des dates par défaut au modal

3. **`/src/features/planning/hooks/useImportExport.ts`**
   - Mise à jour de l'interface pour inclure les dates personnalisées

4. **`/src/features/planning/hooks/useExport.ts`**
   - Ajout des paramètres `customStartDate` et `customEndDate`
   - Utilisation des dates personnalisées si fournies, sinon dates par défaut

## Utilisation

1. L'administrateur clique sur le bouton d'export PDF
2. Le modal s'ouvre avec les dates par défaut (4 derniers mois)
3. L'administrateur peut modifier les dates selon ses besoins
4. Il choisit entre "Planning seul" ou "Planning avec desiderata"
5. Le PDF est généré pour la période sélectionnée

## Avantages

- **Flexibilité** : Export de n'importe quelle période
- **Simplicité** : Interface intégrée dans le flux existant
- **Cohérence** : Même comportement pour l'export individuel et groupé
- **Valeurs par défaut intelligentes** : Conserve le comportement actuel si l'utilisateur ne modifie pas les dates