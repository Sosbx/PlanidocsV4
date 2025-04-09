# Améliorations de la gestion des périodes et de la persistance des propositions

Ce document détaille les améliorations apportées à la gestion des périodes et à la persistance des propositions dans le système d'échange de gardes.

## Problèmes identifiés

1. **Affichage des pastilles non mis à jour en temps réel** : Les pastilles indiquant qu'une garde est proposée au don/échange/remplacement n'étaient pas mises à jour immédiatement après une action de l'utilisateur.

2. **Problème de persistance des propositions pour les gardes de l'après-midi** : Lorsqu'un utilisateur cliquait sur une garde de l'après-midi pour laquelle il avait déjà proposé une option d'échange/remplacement/cession, les propositions n'étaient pas persistantes dans la fenêtre modale et toutes les options étaient désactivées. Cependant, pour les gardes du matin et du soir, les options étaient correctement activées selon ce qui avait été sélectionné initialement.

## Causes des problèmes

1. **Problème de standardisation des périodes** : Les périodes n'étaient pas correctement standardisées lors de la recherche de correspondances entre les gardes proposées et les gardes disponibles.

2. **Problème de correspondance des gardes** : L'algorithme de recherche de correspondances ne prenait pas en compte les différentes représentations possibles des périodes (par exemple, "AM", "après-midi", "afternoon", etc.).

3. **Absence de mécanisme de récupération manuelle** : En cas d'échec de la recherche automatique de correspondances, il n'y avait pas de mécanisme de récupération manuelle pour trouver les gardes correspondantes.

## Solutions apportées

### 1. Amélioration de l'indexation des gardes disponibles

Dans le hook `useShiftMatching.ts`, nous avons amélioré l'indexation des gardes disponibles pour prendre en compte à la fois les périodes standardisées et les périodes originales :

```typescript
// Créer un index secondaire avec la période originale pour les cas où la standardisation échoue
const secondaryIndexKey = `${assignmentDate}|${periodValue}`;
if (secondaryIndexKey !== indexKey) {
  if (!availableShiftsIndex.has(secondaryIndexKey)) {
    availableShiftsIndex.set(secondaryIndexKey, []);
  }
  availableShiftsIndex.get(secondaryIndexKey)?.push({
    key,
    assignment,
    shiftType: assignment.shiftType || '',
    timeSlot: assignment.timeSlot || '',
    originalPeriod: periodValue,
    standardizedPeriod: assignmentPeriod
  });
  
  addLog(`Garde indexée (secondaire): ${key} - Date: ${assignmentDate}, Période originale: ${periodValue}, Période standardisée: ${assignmentPeriod}`);
}
```

### 2. Amélioration de la recherche de correspondances

Nous avons amélioré l'algorithme de recherche de correspondances pour prendre en compte à la fois les périodes standardisées et les périodes originales :

```typescript
// Rechercher d'abord une correspondance exacte dans l'index
const exactMatchKey = `${proposedDateNormalized}|${proposedPeriod}`;
const exactMatches = availableShiftsIndex.get(exactMatchKey);

// Rechercher également avec la période originale non standardisée
const originalPeriodMatchKey = `${proposedDateNormalized}|${proposedShift.period}`;
const originalPeriodMatches = availableShiftsIndex.get(originalPeriodMatchKey);

// Combiner les résultats des deux recherches
const combinedMatches = [
  ...(exactMatches || []),
  ...(originalPeriodMatches || []).filter(match => 
    // Éviter les doublons
    !exactMatches?.some(exactMatch => exactMatch.key === match.key)
  )
];
```

### 3. Ajout d'un système de score pour les correspondances

Nous avons ajouté un système de score pour évaluer la qualité des correspondances et choisir la meilleure :

```typescript
// Calculer un score de correspondance
let score = 0;

// Points pour la correspondance de période
if (match.standardizedPeriod === proposedPeriod) {
  score += 10; // Correspondance de période standardisée
} else if (match.originalPeriod === proposedShift.period) {
  score += 8; // Correspondance de période originale
} else if (arePeriodsEquivalent(match.originalPeriod, proposedShift.period)) {
  score += 6; // Périodes équivalentes
}

// Ajouter des points pour le type de garde
if (match.shiftType === proposedShift.shiftType) {
  score += 3;
}

// Ajouter des points pour le timeSlot
if (match.timeSlot === proposedShift.timeSlot) {
  score += 2;
}
```

### 4. Ajout d'un mécanisme de récupération manuelle

En cas d'échec de la recherche automatique de correspondances, nous avons ajouté un mécanisme de récupération manuelle pour trouver les gardes correspondantes :

```typescript
// Tentative de récupération manuelle des gardes
console.log('Tentative de récupération manuelle des gardes...');

// Rechercher manuellement dans userAssignments pour trouver des correspondances
const manualMatches: string[] = [];

proposal.proposedShifts.forEach(proposedShift => {
  // Standardiser la période pour la recherche
  const standardizedPeriod = standardizePeriod(proposedShift.period);
  
  Object.entries(userAssignments).forEach(([key, assignment]) => {
    if (assignment && assignment.date === proposedShift.date) {
      const assignmentPeriod = standardizePeriod(assignment.period || assignment.type || 'M');
      
      // Vérifier si les périodes correspondent
      if (assignmentPeriod === standardizedPeriod || 
          arePeriodsEquivalent(assignmentPeriod, standardizedPeriod)) {
        console.log(`Correspondance manuelle trouvée: ${key}`);
        manualMatches.push(key);
      }
    }
  });
});

if (manualMatches.length > 0) {
  console.log('Correspondances manuelles trouvées:', manualMatches);
  setSelectedUserShifts(manualMatches);
}
```

### 5. Amélioration des logs de débogage

Nous avons ajouté des logs de débogage détaillés pour faciliter l'identification des problèmes :

```typescript
// Ajouter des logs détaillés pour le débogage des périodes
proposal.proposedShifts.forEach((shift, index) => {
  console.log(`Garde proposée #${index + 1}:`, {
    date: shift.date,
    period: shift.period,
    shiftType: shift.shiftType,
    timeSlot: shift.timeSlot
  });
});

// Afficher les détails de chaque correspondance pour le débogage
matchingResult.matchDetails.forEach((detail, index) => {
  console.log(`Détail de correspondance #${index + 1}:`, {
    proposedShift: detail.proposedShift,
    matchedKey: detail.matchedKey,
    score: detail.score,
    matchType: detail.matchType
  });
});
```

## Résultats

Après ces améliorations :

1. Les pastilles sont correctement mises à jour après une action de l'utilisateur.
2. Les propositions sont persistantes dans la fenêtre modale pour toutes les périodes, y compris l'après-midi.
3. Les options sont correctement activées selon ce qui avait été sélectionné initialement, quelle que soit la période.
4. Le système est plus robuste face aux différentes représentations des périodes.

## Recommandations pour le futur

1. **Standardisation complète des périodes** : Standardiser toutes les périodes dans la base de données pour éviter les problèmes de correspondance.
2. **Mise en place de tests unitaires** : Ajouter des tests unitaires pour vérifier que les correspondances fonctionnent correctement pour toutes les périodes.
3. **Amélioration de l'interface utilisateur** : Ajouter des indicateurs visuels pour montrer que les propositions sont en cours de chargement.
