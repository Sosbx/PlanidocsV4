# Implémentation de l'Export PDF avec/sans Desiderata

## Résumé des modifications

L'export PDF dans la page d'administration des plannings générés a été mis à jour pour offrir le même choix que dans la page "Mon planning" :
- **Planning seul** : Export uniquement des assignments
- **Planning avec desiderata** : Export des assignments + desiderata avec les mêmes couleurs et styles

## Fichiers modifiés

### 1. `/src/utils/generatedPlanningExport.ts`
- Ajout des paramètres `desiderata` et `showAssignmentsOnly` à `exportGeneratedPlanningToPDF`
- Réutilisation de `exportPlanningToPDF` du module `pdfExport` pour gérer les desiderata
- Mise à jour de `exportAllGeneratedPlanningsToPDFZip` pour accepter les desiderata

### 2. `/src/features/planning/components/admin/ExportPDFModal.tsx` (nouveau)
- Modal permettant de choisir entre export avec ou sans desiderata
- Interface identique à celle de la page "Mon planning"
- Affiche le nom de l'utilisateur ou "Tous les utilisateurs"

### 3. `/src/features/planning/hooks/useExport.ts`
- Ajout du paramètre `includeDesiderata` aux fonctions d'export
- Récupération automatique des desiderata via `getAllDesiderata`
- Support pour l'export individuel et l'export groupé

### 4. `/src/features/planning/components/admin/AdminPlanningContainer.tsx`
- Intégration du modal `ExportPDFModal`
- Gestion de l'état du modal et des exports en attente
- Les boutons PDF ouvrent maintenant le modal au lieu d'exporter directement

### 5. `/src/utils/lazyExporters.ts`
- Mise à jour de la signature pour gérer les nouveaux paramètres
- Gestion conditionnelle du téléchargement selon le type d'export

## Fonctionnalités

### Export individuel
1. Clic sur le bouton PDF dans la toolbar
2. Le modal s'ouvre avec le nom de l'utilisateur
3. Choix entre "Planning seul" ou "Planning avec desiderata"
4. Le PDF est généré avec les mêmes styles que l'affichage écran

### Export groupé (Tous PDF)
1. Clic sur "Tous PDF" dans la toolbar
2. Le modal s'ouvre avec "Tous les utilisateurs"
3. Choix entre exports avec ou sans desiderata
4. Un ZIP est généré avec tous les PDFs

### Caractéristiques des exports
- **Sans desiderata** : Affiche uniquement les gardes assignées
- **Avec desiderata** : 
  - Affiche les préférences primaires et secondaires
  - Utilise les mêmes couleurs que l'interface (vert/jaune)
  - Inclut les commentaires numérotés
  - Affiche les statistiques de desiderata

## Avantages
- Interface cohérente entre les pages utilisateur et admin
- Réutilisation du code existant de `pdfExport.ts`
- Les administrateurs peuvent voir les desiderata dans les exports
- Mêmes couleurs et polices que dans l'affichage écran
- Export optimisé avec chargement des desiderata uniquement si nécessaire