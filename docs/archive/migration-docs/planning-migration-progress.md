# Migration de la fonctionnalité Planning

Ce document suit la progression de la migration de la fonctionnalité Planning vers l'architecture Feature-First.

## Composants migrés

- [x] Portal.tsx
- [x] CommentModal.tsx
- [x] PlanningCell.tsx
- [x] DesktopTable.tsx
- [x] MobileTable.tsx
- [x] DownloadButton.tsx
- [x] PlanningTransition.css
- [x] PermanentPlanningPreview.tsx
- [x] PlanningPreview.tsx
- [x] PlanningTutorial.tsx
- [x] GoogleCalendarButton.tsx
- [x] GeneratedPlanningTable.tsx

## Hooks migrés

- [x] usePlanningPeriod.ts
- [x] useShiftAssignments.ts
- [x] useDesiderata.ts
- [x] useDesiderataState.ts
- [x] useUserAssignments.ts

## Utilitaires migrés

- [x] planningUtils.ts
- [x] generatedPlanningExport.ts

## Pages migrées

- [x] GeneratedPlanningPage.tsx
- [x] PlanningPreviewPage.tsx
- [x] UserPlanningPage.tsx
- [x] ValidatedPlanningsPage.tsx

## Types migrés

- [x] types.ts

## Prochaines étapes

1. Mettre à jour les imports dans les fichiers qui utilisent ces composants, hooks, utilitaires et pages
2. Nettoyer les anciens fichiers une fois que tous les imports ont été mis à jour
3. Exécuter les tests pour s'assurer que tout fonctionne correctement
