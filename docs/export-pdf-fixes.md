# Corrections des Exports PDF - Résumé

## Problèmes corrigés

### 1. Erreur getAllDesiderata - "Cannot read properties of undefined (reading 'indexOf')"

**Problème** : La fonction `getAllDesiderata` était appelée avec les mauvais paramètres dans `useExport.ts`.

**Solution** : 
- Correction des appels à `getAllDesiderata` pour passer les bons paramètres : `(userId, includeArchived, currentPeriodOnly, associationId)`
- Ajout de la conversion des desiderata au format attendu par `exportPlanningToPDF`
- Pour l'export groupé, récupération des desiderata utilisateur par utilisateur

### 2. PDF sans la même présentation que "Mon planning"

**Problème** : Le code générait un PDF simple qui ne reprenait pas le format de la page "Mon planning".

**Solution** :
- Suppression de toute la logique de génération PDF personnalisée
- Utilisation systématique de `exportPlanningToPDF` depuis `pdfExport.ts`
- Ajout du paramètre `returnDocument` dans `exportPlanningToPDF` pour retourner le document sans le télécharger (utile pour les ZIP)

## Fichiers modifiés

### 1. `/src/features/planning/hooks/useExport.ts`
- Correction des appels à `getAllDesiderata` avec les bons paramètres
- Ajout de la conversion des desiderata au bon format
- Récupération individuelle des desiderata pour chaque utilisateur lors de l'export groupé

### 2. `/src/utils/generatedPlanningExport.ts`
- Simplification de `exportGeneratedPlanningToPDF` pour toujours utiliser `exportPlanningToPDF`
- Remplacement de `createPlanningPDFWithDesiderata` par `createPlanningPDFForZip` qui utilise `exportPlanningToPDF`
- Suppression de la fonction `generateSimplePDF` obsolète

### 3. `/src/utils/pdfExport.ts`
- Ajout du paramètre optionnel `returnDocument` dans `ExportPlanningOptions`
- Modification de `exportPlanningToPDF` pour retourner le document si `returnDocument` est true

### 4. `/src/utils/lazyExporters.ts`
- Simplification de la logique d'export PDF
- Suppression de l'appel à `.save()` car `exportGeneratedPlanningToPDF` gère le téléchargement

### 5. `/src/features/planning/pages/GeneratedPlanningPage.tsx`
- Mise à jour du wrapper pour supporter les nouveaux paramètres des fonctions d'export

## Avantages de cette approche

1. **Cohérence** : Tous les PDF utilisent exactement la même présentation
2. **Maintenabilité** : Un seul endroit où le format PDF est défini (`pdfExport.ts`)
3. **Réutilisabilité** : La même fonction sert pour tous les types d'export
4. **Simplicité** : Moins de code dupliqué, moins de risques de bugs

## Résultat

Les exports PDF fonctionnent maintenant correctement :
- L'export sans desiderata affiche uniquement les gardes assignées
- L'export avec desiderata affiche les préférences avec les mêmes couleurs que l'interface
- La présentation est identique à celle de la page "Mon planning"
- Plus d'erreurs lors de la récupération des desiderata