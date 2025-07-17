# Module de Dates Centralisé

Ce module fournit des fonctions utilitaires pour la manipulation des dates dans l'application Planidocs.
Toutes les dates sont gérées automatiquement en fuseau horaire Europe/Paris.

## Structure du Module

### 📁 `dateFormats.ts`
Contient tous les formats de dates utilisés dans l'application.

```typescript
import { DATE_FORMATS, formatDateForExport } from './dates';

// Formats prédéfinis
DATE_FORMATS.SHORT_DATE_MONTH // 'd MMM' (ex: 5 Jan)
DATE_FORMATS.LONG_DATE        // 'EEEE d MMMM yyyy' (ex: Lundi 5 Janvier 2024)
DATE_FORMATS.ISO_DATE         // 'yyyy-MM-dd' (ex: 2024-01-05)

// Export selon le type
formatDateForExport(date, 'pdf')   // '05 janvier 2024'
formatDateForExport(date, 'excel') // '05/01/2024'
formatDateForExport(date, 'csv')   // '2024-01-05'
```

### 📁 `dateHelpers.ts`
Fonctions utilitaires pour manipuler les dates.

```typescript
import { parseCellKey, createDatePeriodKey, formatDateAs } from './dates';

// Parser une clé de cellule
const data = parseCellKey('2024-01-05-M');
// → { date: '2024-01-05', period: 'M' }

// Créer une clé
const key = createDatePeriodKey('2024-01-05', 'AM');
// → '2024-01-05-AM'

// Formater simplement
formatDateAs(date, 'short')  // '5 Jan'
formatDateAs(date, 'medium') // '05 Jan 2024'
formatDateAs(date, 'long')   // 'Lundi 5 Janvier 2024'
formatDateAs(date, 'file')   // '05-01-2024'
```

### 📁 `dateComparison.ts`
Fonctions de comparaison de dates.

```typescript
import { isToday, isPastDate, isSameDay, getDaysDifference } from './dates';

// Vérifications simples
isToday('2024-01-05')        // true/false
isPastDate('2024-01-05')     // true/false
isFutureDate('2024-01-05')   // true/false

// Comparaisons
isSameDay(date1, date2)      // true/false
getDaysDifference(date1, date2) // nombre de jours
```

### 📁 `periodHelpers.ts`
Gestion des périodes (Matin, Après-midi, Soir).

```typescript
import { getPeriodName, normalizePeriod, getAllPeriods } from './dates';

// Obtenir le nom d'affichage
getPeriodName('M')    // 'Matin'
getPeriodName('AM')   // 'Après-midi'
getPeriodName('S')    // 'Soir'

// Normaliser les variantes
normalizePeriod('matin')     // 'M'
normalizePeriod('APRES-MIDI') // 'AM'

// Obtenir les horaires
getPeriodHours('M')  // { start: '07:00', end: '12:59' }
```

## Migration depuis l'ancien code

### Avant (ancien code)
```typescript
import { format } from 'date-fns';
import { frLocale } from '../utils/dateLocale';
import { formatParisDate, parseParisDate, createParisDate } from '../utils/timezoneUtils';

// Formatage manuel
const formatted = formatParisDate(date, 'dd MMM yyyy', { locale: frLocale });

// Parsing de cellKey
const parts = cellKey.split('-');
const dateStr = parts.slice(0, 3).join('-');
const period = parts[3];
const date = parseParisDate(dateStr);

// Vérification date passée
const today = new Date();
today.setHours(0, 0, 0, 0);
const isPast = dateObj < today;
```

### Après (nouveau code)
```typescript
import { formatDateAs, parseCellKey, isPastDate } from '../utils/dates';

// Formatage simplifié
const formatted = formatDateAs(date, 'medium');

// Parsing simplifié avec validation
const cellData = parseCellKey(cellKey);
if (cellData) {
  const { date, period } = cellData;
}

// Vérification simplifiée
const isPast = isPastDate(dateObj);
```

## Avantages

1. **Cohérence**: Tous les formats sont centralisés
2. **Type-safety**: Meilleure gestion des types TypeScript
3. **Performance**: Moins de conversions redondantes
4. **Maintenabilité**: Un seul endroit pour modifier les formats
5. **Simplicité**: API plus intuitive et moins de code

## Import unique

Pour importer toutes les fonctions nécessaires :

```typescript
import { 
  // Fonctions principales
  createDate,
  formatDate,
  parseDate,
  
  // Helpers
  formatDateAs,
  parseCellKey,
  createDatePeriodKey,
  
  // Comparaisons
  isToday,
  isPastDate,
  
  // Périodes
  getPeriodName,
  PERIOD_NAMES,
  
  // Formats
  DATE_FORMATS,
  
  // Types
  type DateInput,
  type Period
} from '../utils/dates';
```