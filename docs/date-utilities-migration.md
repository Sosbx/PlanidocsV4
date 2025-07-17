# Guide de Migration vers les Nouvelles Utilitaires de Dates

## Vue d'ensemble

Ce guide documente la migration vers le nouveau module centralisé de gestion des dates (`src/utils/dates/`). Cette refactorisation améliore la maintenabilité, la performance et la cohérence dans toute l'application.

## Changements Principaux

### 1. Structure du Module

```
src/utils/dates/
├── dateFormats.ts      # Formats de dates centralisés
├── dateHelpers.ts      # Fonctions utilitaires principales
├── dateComparison.ts   # Fonctions de comparaison
├── periodHelpers.ts    # Gestion des périodes (M, AM, S)
├── index.ts           # Point d'entrée unique
└── README.md          # Documentation
```

### 2. Import Simplifié

**Avant:**
```typescript
import { format } from 'date-fns';
import { frLocale } from '../utils/dateLocale';
import { formatParisDate, parseParisDate, createParisDate } from '../utils/timezoneUtils';
import { formatPeriod } from '../utils/dateUtils';
```

**Après:**
```typescript
import { 
  formatDate, 
  parseDate, 
  createDate, 
  formatDateAs, 
  getPeriodName,
  frLocale 
} from '../utils/dates';
```

### 3. Patterns de Migration Courants

#### A. Formatage de Dates

**Ancien pattern:**
```typescript
// Format court
formatParisDate(date, 'dd/MM', { locale: frLocale })
formatParisDate(date, 'd MMM', { locale: frLocale })

// Format long
formatParisDate(date, 'EEEE d MMMM yyyy', { locale: frLocale })

// Format pour fichiers
formatParisDate(date, 'dd-MM-yyyy', { locale: frLocale })
```

**Nouveau pattern:**
```typescript
// Utiliser formatDateAs pour les formats courants
formatDateAs(date, 'short')   // '5 Jan'
formatDateAs(date, 'medium')  // '05 Jan 2024'
formatDateAs(date, 'long')    // 'Lundi 5 Janvier 2024'
formatDateAs(date, 'file')    // '05-01-2024'

// Ou utiliser les constantes DATE_FORMATS
formatDate(date, DATE_FORMATS.SHORT_DATE_MONTH)
```

#### B. Parsing des Clés de Cellule

**Ancien pattern:**
```typescript
const parts = cellKey.split('-');
const dateStr = parts.slice(0, 3).join('-');
const period = parts[3] as Period;
const date = parseParisDate(dateStr);
```

**Nouveau pattern:**
```typescript
const cellData = parseCellKey(cellKey);
if (cellData) {
  const { date, period } = cellData;
  // date est déjà une string 'YYYY-MM-DD'
  // period est typé comme 'M' | 'AM' | 'S'
}
```

#### C. Vérification de Date Passée

**Ancien pattern:**
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const isPast = dateObj < today;
```

**Nouveau pattern:**
```typescript
const isPast = isPastDate(dateObj);
```

#### D. Gestion des Périodes

**Ancien pattern:**
```typescript
const PERIOD_NAMES = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};
const periodName = PERIOD_NAMES[period];
```

**Nouveau pattern:**
```typescript
const periodName = getPeriodName(period);
```

#### E. Export de Dates

**Ancien pattern:**
```typescript
// Pour PDF
formatParisDate(date, 'dd MMMM yyyy', { locale: frLocale })

// Pour Excel
formatParisDate(date, 'dd/MM/yyyy')

// Pour CSV
formatParisDate(date, 'yyyy-MM-dd')
```

**Nouveau pattern:**
```typescript
formatDateForExport(date, 'pdf')   // '05 janvier 2024'
formatDateForExport(date, 'excel') // '05/01/2024'
formatDateForExport(date, 'csv')   // '2024-01-05'
formatDateForExport(date, 'ics')   // '20240105'
```

### 4. Fichiers Déjà Migrés

- ✅ `src/utils/csvExport.ts`
- ✅ `src/utils/icsExport.ts`
- ✅ `src/components/modals/CommentModal.tsx`
- ✅ `src/features/directExchange/components/ExchangeModal.tsx`
- ✅ `src/features/planning/components/GeneratedPlanningTable.tsx` (partiel)
- ✅ `src/features/planning/utils/dateRangeDetector.ts`

### 5. Fichiers à Migrer

- [ ] `src/features/planning/components/DesktopTable.tsx`
- [ ] `src/features/planning/components/MobileTable.tsx`
- [ ] `src/features/planning/components/DailyPlanningView.tsx`
- [ ] `src/features/shiftExchange/components/ShiftExchangeCalendarView.tsx`
- [ ] `src/features/directExchange/components/ProposedShiftModal.tsx`
- [ ] `src/features/directExchange/components/ExchangeProposalsModal.tsx`
- [ ] `src/utils/pdfExport.ts`
- [ ] `src/utils/excelExport.ts`
- [ ] Et autres fichiers utilisant des dates...

### 6. Bénéfices de la Migration

1. **Performance**: Réduction des conversions redondantes
2. **Maintenabilité**: Un seul endroit pour modifier les formats
3. **Type Safety**: Meilleure gestion des types TypeScript
4. **Cohérence**: Formats unifiés dans toute l'application
5. **Lisibilité**: Code plus clair et concis

### 7. Notes de Migration

- Les fonctions existantes dans `dateUtils.ts` sont marquées comme `@deprecated` mais restent fonctionnelles
- Le module `timezoneUtils.ts` reste inchangé et est réexporté via le nouveau module
- Tous les formats de dates sont maintenant centralisés dans `DATE_FORMATS`
- La capitalisation des mois/jours est automatique avec `formatDateCapitalized`

### 8. Exemple Complet de Migration

**Fichier avant migration:**
```typescript
import { format } from 'date-fns';
import { frLocale } from '../utils/dateLocale';
import { formatParisDate, parseParisDate } from '../utils/timezoneUtils';

const formatDate = (date: string) => {
  const parsed = parseParisDate(date);
  return formatParisDate(parsed, 'dd MMM yyyy', { locale: frLocale });
};

const isToday = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() === today.getTime();
};
```

**Fichier après migration:**
```typescript
import { formatDateAs, isToday } from '../utils/dates';

const formatDate = (date: string) => {
  return formatDateAs(date, 'medium');
};

// isToday est maintenant importé directement
```

## Prochaines Étapes

1. Migrer progressivement les fichiers restants
2. Supprimer les imports non utilisés de `date-fns` direct
3. Remplacer les patterns répétitifs par les nouvelles fonctions
4. Mettre à jour les tests unitaires si nécessaire