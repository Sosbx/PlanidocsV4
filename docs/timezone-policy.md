# Politique de gestion des fuseaux horaires

## Vue d'ensemble

L'application Planidocs utilise exclusivement le fuseau horaire **Europe/Paris** pour toutes les opérations de date et heure. Cette politique garantit une cohérence totale pour tous les utilisateurs, quel que soit leur fuseau horaire local.

## Implémentation

### Configuration automatique

Un module de configuration (`src/config/dateConfig.ts`) remplace automatiquement le constructeur `Date` natif de JavaScript. Cette configuration est chargée au démarrage de l'application dans `main.tsx`.

**Résultat :** Toutes les instances de `new Date()` créent automatiquement des dates dans le fuseau horaire Europe/Paris.

### Exemples d'utilisation

```typescript
// ✅ Automatiquement en Europe/Paris - aucune modification nécessaire
const maintenant = new Date();
const dateSpecifique = new Date('2024-03-15');
const dateComposants = new Date(2024, 2, 15, 14, 30); // 15 mars 2024 14h30 (heure de Paris)

// ✅ Les méthodes de formatage fonctionnent normalement
console.log(maintenant.toLocaleDateString('fr-FR')); // Format français
```

### Fonctions utilitaires disponibles

Pour des cas spécifiques, les fonctions suivantes sont disponibles dans `src/utils/timezoneUtils.ts` :

- `parseParisDate(dateString)` - Parse une date au format YYYY-MM-DD
- `formatParisDate(date, format)` - Formate une date selon un format spécifique
- `toParisTime(date)` - Convertit n'importe quelle date en heure de Paris
- `createParisDate(...args)` - Crée une date explicitement en heure de Paris

### Hook React

Pour les composants React, un hook est disponible :

```typescript
import { useTimezone } from '@/hooks/useTimezone';

function MonComposant() {
  const { formatDate, createDate } = useTimezone();
  
  const dateFormatee = formatDate(new Date(), 'dd/MM/yyyy');
}
```

## Bonnes pratiques

### ✅ À faire

1. **Utiliser `new Date()` normalement** - La configuration globale s'occupe du fuseau horaire
2. **Pour les imports de dates** depuis des API externes, vérifier qu'elles sont bien converties
3. **Pour les exports** (PDF, CSV, ICS), les dates sont automatiquement en Europe/Paris

### ❌ À éviter

1. **Ne pas** essayer de gérer manuellement les fuseaux horaires
2. **Ne pas** utiliser des bibliothèques tierces de gestion de timezone sans consultation
3. **Ne pas** modifier `src/config/dateConfig.ts` sans une compréhension complète des impacts

## Cas particuliers

### Timestamps Firebase

Les timestamps Firebase sont automatiquement convertis :

```typescript
// Conversion automatique des timestamps Firebase
const date = doc.data().createdAt.toDate(); // Automatiquement en Europe/Paris
```

### Affichage pour l'utilisateur

Toutes les dates affichées dans l'interface utilisateur sont en heure de Paris. Si nécessaire, un indicateur de fuseau horaire peut être affiché avec le composant `TimezoneIndicator`.

### Imports/Exports de données

- **CSV/Excel** : Les dates sont exportées en format Europe/Paris
- **ICS (Calendrier)** : Les événements incluent l'information de timezone
- **PDF** : Les dates sont formatées selon les conventions françaises

## Débogage

Pour déboguer les problèmes de timezone :

```typescript
import { debugTimezone } from '@/utils/timezoneUtils';

debugTimezone(maDate, 'Description de ma date');
// Affiche dans la console les détails du fuseau horaire
```

## Migration

Si vous trouvez du code ancien qui gère manuellement les fuseaux horaires :

1. Supprimez la gestion manuelle du timezone
2. Utilisez simplement `new Date()` ou les fonctions utilitaires
3. Testez que les dates s'affichent correctement

## Questions fréquentes

**Q : Que se passe-t-il si un utilisateur est dans un autre fuseau horaire ?**
R : Toutes les dates sont affichées en heure de Paris, garantissant une expérience cohérente pour tous les médecins.

**Q : Comment gérer les dates provenant d'API externes ?**
R : Les dates sont automatiquement converties lors de leur création avec `new Date()`. Pour plus de contrôle, utilisez `toParisTime()`.

**Q : Les performances sont-elles impactées ?**
R : L'impact est négligeable. La conversion est effectuée une seule fois à la création de la date.

## Support

Pour toute question sur la gestion des dates et fuseaux horaires, consultez :
- Le fichier `src/utils/timezoneUtils.ts` pour les fonctions disponibles
- Le hook `useTimezone` pour l'utilisation dans les composants React
- Cette documentation pour les bonnes pratiques