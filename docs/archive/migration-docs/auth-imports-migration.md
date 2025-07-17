# Migration des imports de useAuth

Ce document décrit les changements effectués pour migrer les imports du hook `useAuth` de l'ancienne structure vers la nouvelle structure Feature-First.

## Contexte

Dans le cadre de la migration vers l'architecture Feature-First, nous avons besoin de mettre à jour tous les imports pour utiliser la nouvelle structure. Le hook `useAuth` était précédemment importé depuis `'../../hooks/useAuth'` (ou un chemin similaire selon la profondeur du fichier), mais il est maintenant disponible dans la nouvelle structure Feature-First à `'../../features/auth/hooks'`.

## Changements effectués

1. Création d'un wrapper pour le hook `useAuth` dans la nouvelle structure :
   - Création du fichier `src/features/auth/hooks/useUsers.ts` qui réexporte le hook `useUsers` du contexte `UserContext`
   - Mise à jour du fichier `src/features/auth/hooks/index.ts` pour exporter le hook `useUsers`

2. Mise à jour des imports dans les fichiers :
   - Mise à jour manuelle du fichier `src/context/exchange/ExchangeContext.tsx` pour utiliser le hook `useAuth` depuis la nouvelle structure
   - Création d'un script Python `src/scripts/update_imports.py` pour mettre à jour automatiquement tous les imports de `useAuth` dans le projet
   - Exécution du script pour mettre à jour 33 fichiers

## Fichiers mis à jour

Le script a mis à jour les imports de `useAuth` dans 33 fichiers, notamment :

- Fichiers dans `src/context/`
- Fichiers dans `src/features/`
- Fichiers dans `src/components/`
- Fichiers dans `src/hooks/`
- Fichiers dans `src/pages/`

## Prochaines étapes

- Mettre à jour les imports des autres hooks et composants pour utiliser la nouvelle structure Feature-First
- Nettoyer les anciens fichiers une fois que toutes les fonctionnalités ont été migrées

## Problèmes résolus

- Correction manuelle de l'import dans `src/hooks/exchange/useDirectExchange.ts` qui n'avait pas été correctement mis à jour par le script
- Correction manuelle de l'import de `useDesiderata` dans `src/features/users/pages/UserPage.tsx` pour qu'il pointe vers `src/features/planning/hooks/useDesiderata.ts`
- Correction manuelle des imports de `useDesiderata` et `useDesiderataState` dans `src/hooks/useSelections.ts` pour qu'ils pointent vers les nouveaux emplacements dans la structure Feature-First
- Adaptation du code dans `src/hooks/useSelections.ts` pour transformer les données au format attendu par le hook `useDesiderata` migré
