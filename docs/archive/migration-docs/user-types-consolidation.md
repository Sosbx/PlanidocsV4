# Consolidation des types d'utilisateur

Ce document décrit les modifications apportées pour consolider les types d'utilisateur et résoudre les conflits liés à la gestion des utilisateurs.

## Problèmes identifiés

1. **Multiples définitions du type `User`** :
   - Dans `src/types/users.ts` : Une interface simple avec une propriété `role` (singulier)
   - Dans `src/features/auth/types.ts` : Un alias pour `AuthUser`
   - Dans `src/features/users/types.ts` : Un alias pour `ManagementUser` avec une propriété `roles` (pluriel)

2. **Incohérence dans les imports** :
   - Certains fichiers importaient `User` depuis l'ancienne structure
   - D'autres fichiers importaient `User` depuis la nouvelle structure Feature-First

3. **Transition entre ancien et nouveau format de rôles** :
   - Ancien format : propriété `role` unique de type string ('admin', 'user', 'manager')
   - Nouveau format : propriété `roles` de type `UserRoleFlags` avec des booléens (`isAdmin`, `isUser`, `isManager`, etc.)

## Modifications apportées

1. **Consolidation des types** :
   - Modification de `src/types/users.ts` pour réexporter les types depuis `src/features/users/types.ts`
   - Modification de `src/features/auth/types.ts` pour réexporter les types depuis `src/features/users/types.ts`
   - Ajout de commentaires de dépréciation pour indiquer que ces fichiers sont conservés pour la compatibilité

2. **Mise à jour des imports** :
   - Modification de `src/lib/firebase/users.ts` pour importer `User` depuis `src/features/users/types.ts`
   - Ajout de l'import de `ensureUserRoles` dans `src/lib/firebase/users.ts`

3. **Application de `ensureUserRoles` partout** :
   - Modification de `getUserByEmail`, `getUserByLogin` et `getUsers` dans `src/lib/firebase/users.ts` pour utiliser `ensureUserRoles`
   - Amélioration de la fonction `ensureUserRoles` pour la rendre plus robuste

4. **Amélioration de la fonction `ensureUserRoles`** :
   - Ajout de vérifications pour éviter les erreurs avec des objets null ou undefined
   - Ajout de vérifications pour s'assurer que toutes les propriétés attendues sont présentes
   - Ajout de logique pour mettre à jour les propriétés manquantes ou incorrectes

## Conseils pour éviter les conflits à l'avenir

1. **Utiliser une seule source de vérité** :
   - Importer les types depuis `src/features/users/types.ts` uniquement
   - Éviter de créer de nouvelles définitions du type `User`

2. **Toujours utiliser `ensureUserRoles`** :
   - Appliquer cette fonction à tous les objets utilisateur récupérés depuis Firestore
   - Cela garantit que tous les objets utilisateur ont la structure attendue

3. **Éviter d'utiliser directement la propriété `role`** :
   - Utiliser `user.roles.isAdmin`, `user.roles.isUser`, etc. au lieu de `user.role === 'admin'`
   - Cela garantit que le code fonctionne avec le nouveau format de rôles

4. **Documenter les changements** :
   - Ajouter des commentaires dans le code pour expliquer les choix de conception
   - Mettre à jour la documentation lorsque des modifications sont apportées

## Prochaines étapes

1. **Nettoyer les anciens fichiers** :
   - Une fois que tous les imports ont été mis à jour, supprimer les fichiers obsolètes
   - Cela simplifiera la base de code et réduira les risques de confusion

2. **Mettre à jour les tests** :
   - S'assurer que tous les tests utilisent le nouveau format de rôles
   - Ajouter des tests pour vérifier que `ensureUserRoles` fonctionne correctement

3. **Mettre à jour la documentation** :
   - Créer un guide pour les développeurs sur la façon d'utiliser la nouvelle structure
   - Expliquer clairement la hiérarchie des rôles et comment elle est utilisée dans l'application
