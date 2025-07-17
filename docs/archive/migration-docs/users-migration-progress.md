# Migration de la fonctionnalité Users

Ce document suit la progression de la migration de la fonctionnalité Users vers l'architecture Feature-First.

## Composants migrés

- [x] StatusIndicator.tsx
- [x] UserStatusList.tsx
- [x] AddUserForm.tsx
- [x] AddUserModal.tsx
- [x] BulkAddUserForm.tsx
- [x] EditUserModal.tsx
- [x] UsersList.tsx

## Hooks migrés

- [x] useCachedUserData.ts
- [x] useUserAssignments.ts

## Utilitaires migrés

- [x] userCredentials.ts
- [x] userUtils.ts

## Pages migrées

- [x] UserPage.tsx

## Types migrés

- [x] types.ts

## Problèmes à résoudre

1. ✅ Incompatibilité entre les types User et UserExtended :
   - Résolu en créant une fonction d'adaptateur `adaptUserExtendedToUser` qui convertit UserExtended en User.
   - Cette fonction est utilisée dans les fonctions d'exportation pour convertir les données avant de les passer aux fonctions qui attendent le type User.

2. Problèmes avec les propriétés :
   - Dans User, il y a hasValidatedPlanning pour indiquer si l'utilisateur a validé son planning, alors que dans UserExtended, il y a status qui peut être 'active', 'inactive' ou 'pending'.
   - Dans User, roles est un objet avec des propriétés booléennes, alors que dans UserExtended, role est une énumération.
   - Ces différences sont gérées dans la fonction d'adaptateur.

## Prochaines étapes

1. ✅ Résoudre les problèmes de types pour UserStatusList.tsx
2. ✅ Migrer le composant AddUserForm.tsx
3. ✅ Migrer les composants AddUserModal.tsx et BulkAddUserForm.tsx
4. ✅ Migrer le composant EditUserModal.tsx
5. ✅ Migrer le composant UsersList.tsx
6. ✅ Migrer le hook useCachedUserData.ts
7. ✅ Migrer le hook useUserAssignments.ts
8. ✅ Migrer l'utilitaire userCredentials.ts
9. ✅ Migrer l'utilitaire userUtils.ts
10. ✅ Migrer les pages (UserPage.tsx)
11. ✅ Mettre à jour les imports dans les fichiers qui utilisent ces composants, hooks, utilitaires et pages
12. ✅ Créer un script de nettoyage pour les fichiers obsolètes (src/scripts/cleanup-users-migration.sh)
13. ✅ Nettoyer les anciens fichiers une fois que tous les imports ont été mis à jour
14. ✅ Exécuter les tests pour s'assurer que tout fonctionne correctement
15. ✅ Exécuter les scripts de nettoyage (cleanup-obsolete-folders.sh, cleanup-hooks.sh, cleanup-after-migration.sh) une fois que toutes les fonctionnalités ont été migrées
