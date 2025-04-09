#!/bin/bash

# Script simplifié pour mettre à jour les imports de useAuth
# Ce script recherche et remplace les imports obsolètes du hook useAuth
# pour les faire pointer vers la nouvelle structure Feature-First

echo "Début de la mise à jour des imports useAuth..."

# Liste des fichiers à traiter
FILES_TO_UPDATE=$(grep -l "import.*useAuth.*from.*hooks/useAuth" --include="*.ts" --include="*.tsx" -r src/)

# Compteur pour les fichiers mis à jour
COUNT=0

for FILE in $FILES_TO_UPDATE; do
  echo "Traitement du fichier: $FILE"
  
  # Remplacer l'ancien import par le nouveau
  sed -i "s|import { useAuth } from '.*hooks/useAuth';|import { useAuth } from '../features/auth/hooks';|g" "$FILE"
  
  # Vérifier si le fichier a été modifié
  if [ $? -eq 0 ]; then
    COUNT=$((COUNT + 1))
  fi
done

echo "Mise à jour terminée. $COUNT fichiers ont été mis à jour."
echo "Script terminé."
