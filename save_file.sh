#!/bin/bash

# Script pour créer une sauvegarde d'un fichier avant modification
# Usage: ./save_file.sh /chemin/vers/fichier [suffixe_optionnel]

FILE_PATH="$1"
SUFFIX="${2:-backup}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ -z "$FILE_PATH" ]; then
  echo "Erreur: Chemin du fichier non spécifié"
  echo "Usage: ./save_file.sh /chemin/vers/fichier [suffixe_optionnel]"
  exit 1
fi

if [ ! -f "$FILE_PATH" ]; then
  echo "Erreur: Le fichier $FILE_PATH n'existe pas"
  exit 1
fi

FILENAME=$(basename "$FILE_PATH")
DIRNAME=$(dirname "$FILE_PATH")
# Créer le dossier de sauvegarde s'il n'existe pas
BACKUP_DIR="${DIRNAME}/backups"
mkdir -p "$BACKUP_DIR"

BACKUP_PATH="${BACKUP_DIR}/${FILENAME}.${SUFFIX}_${TIMESTAMP}"

cp "$FILE_PATH" "$BACKUP_PATH"

if [ $? -eq 0 ]; then
  echo "Sauvegarde créée: $BACKUP_PATH"
else
  echo "Erreur lors de la création de la sauvegarde"
  exit 1
fi