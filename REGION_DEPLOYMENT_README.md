# Problème de déploiement des fonctions Firebase en Europe

## Contexte

Nous avons tenté de déployer la fonction Cloud Firebase `sendReminderEmail` dans la région Europe (`europe-west1`), mais malgré plusieurs tentatives, la fonction est toujours déployée dans la région US (`us-central1`).

## Solutions tentées

1. **Configuration dans firebase.json**
   - Utilisation de `"region": "europe-west1"`
   - Utilisation de `"regions": ["europe-west1"]`

2. **Spécification de la région dans le code**
   - Tentative d'utilisation de `functions.region('europe-west1')`
   - Tentative de création d'une variable `europeFunction = functions.region('europe-west1')`

3. **Options de ligne de commande**
   - Tentative d'utilisation de `--region=europe-west1`

## État actuel

Le code client a été adapté pour utiliser cette URL.

## Solutions alternatives à explorer

1. **Mise à jour de Firebase CLI**
   - Vérifier si une version plus récente de Firebase CLI résout le problème

2. **Utilisation de la console Firebase**
   - Essayer de modifier la région de la fonction via la console Firebase

3. **Utilisation de Google Cloud CLI**
   - Essayer de déployer la fonction directement avec `gcloud` au lieu de `firebase`

4. **Création d'un nouveau projet**
   - Créer un nouveau projet Firebase avec la région Europe spécifiée dès le début

## Impact sur le projet

L'utilisation de la région US au lieu de la région Europe peut avoir les impacts suivants :

1. **Latence** : Les utilisateurs européens peuvent subir une latence légèrement plus élevée
2. **Conformité RGPD** : Les données peuvent être stockées aux États-Unis, ce qui peut poser des problèmes de conformité
3. **Coûts** : Les coûts peuvent varier légèrement entre les régions

Pour l'instant, nous utilisons la fonction déployée en US, mais nous continuerons à chercher une solution pour le déploiement en Europe.
