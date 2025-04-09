#!/bin/bash

# Script pour mettre à jour les imports de useAuth
# Ce script recherche et remplace les imports obsolètes du hook useAuth
# pour les faire pointer vers la nouvelle structure Feature-First

echo "Début de la mise à jour des imports useAuth..."

# Recherche des fichiers contenant l'ancien import
FILES_TO_UPDATE=$(grep -l "import.*useAuth.*from.*hooks/useAuth" --include="*.ts" --include="*.tsx" -r src/)

# Compteur pour les fichiers mis à jour
COUNT=0

for FILE in $FILES_TO_UPDATE; do
  echo "Traitement du fichier: $FILE"
  
  # Déterminer le chemin relatif correct en fonction de la profondeur du fichier
  DEPTH=$(echo "$FILE" | tr -cd '/' | wc -c)
  DEPTH=$((DEPTH - 1)) # Ajuster pour le dossier src/
  
  # Construire le chemin relatif correct
  REL_PATH=""
  for ((i=0; i<DEPTH; i++)); do
    REL_PATH="../$REL_PATH"
  done
  
  # Remplacer l'ancien import par le nouveau
  # Cas 1: import { useAuth } from '../hooks/useAuth';
  sed -i "s|import { useAuth } from '\.\./\(.*\)hooks/useAuth';|import { useAuth } from '${REL_PATH}features/auth/hooks';|g" "$FILE"
  
  # Cas 2: import { useAuth } from '../../hooks/useAuth';
  sed -i "s|import { useAuth } from '\.\./\.\./\(.*\)hooks/useAuth';|import { useAuth } from '${REL_PATH}features/auth/hooks';|g" "$FILE"
  
  # Cas 3: import { useAuth } from '../../../hooks/useAuth';
  sed -i "s|import { useAuth } from '\.\./\.\./\.\./\(.*\)hooks/useAuth';|import { useAuth } from '${REL_PATH}features/auth/hooks';|g" "$FILE"
  
  # Vérifier si le fichier a été modifié
  if [ $? -eq 0 ]; then
    COUNT=$((COUNT + 1))
  fi
done

echo "Mise à jour terminée. $COUNT fichiers ont été mis à jour."

# Traiter spécifiquement le fichier ExchangeContext.tsx qui a causé l'erreur initiale
if [ -f "src/context/exchange/ExchangeContext.tsx" ]; then
  echo "Mise à jour spécifique de src/context/exchange/ExchangeContext.tsx..."
  sed -i "s|import { useAuth } from '../../hooks/useAuth';|import { useAuth } from '../../features/auth/hooks';|g" "src/context/exchange/ExchangeContext.tsx"
  echo "Fichier ExchangeContext.tsx mis à jour."
fi

echo "Script terminé."
