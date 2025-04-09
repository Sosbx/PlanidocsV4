#!/bin/bash

# Script pour lister les sauvegardes disponibles
# Usage: ./list_backups.sh [pattern]

PROJECT_ROOT="/Users/arkane/Documents/planidoc/Planidocs V4"
BACKUPS_DIR="${PROJECT_ROOT}/backups"
PATTERN="$1"

if [ ! -d "$BACKUPS_DIR" ]; then
  echo "Erreur: Le dossier de sauvegarde n'existe pas: $BACKUPS_DIR"
  exit 1
fi

echo "Liste des sauvegardes disponibles:"
echo "=================================="

if [ -z "$PATTERN" ]; then
  # Lister toutes les sauvegardes de dossiers (groupées)
  echo "SAUVEGARDES GROUPÉES:"
  find "$BACKUPS_DIR" -maxdepth 1 -type d -not -path "$BACKUPS_DIR" | sort -r | while read -r backup_dir; do
    dir_name=$(basename "$backup_dir")
    file_count=$(find "$backup_dir" -type f | wc -l | tr -d '[:space:]')
    timestamp=${dir_name%%_*}
    date_formatted=$(date -r "${backup_dir}" "+%d/%m/%Y %H:%M:%S")
    message=${dir_name#*_}
    
    echo "📁 ${date_formatted}: ${message} (${file_count} fichiers)"
  done

  # Lister les fichiers individuels sauvegardés
  echo -e "\nSAUVEGARDES INDIVIDUELLES:"
  find "$BACKUPS_DIR" -maxdepth 1 -type f | sort -r | while read -r backup_file; do
    file_name=$(basename "$backup_file")
    date_formatted=$(date -r "${backup_file}" "+%d/%m/%Y %H:%M:%S")
    
    echo "📄 ${date_formatted}: ${file_name}"
  done
else
  # Recherche avec un motif
  echo "Recherche de sauvegardes pour le motif: $PATTERN"
  echo "DOSSIERS CORRESPONDANTS:"
  find "$BACKUPS_DIR" -maxdepth 1 -type d -not -path "$BACKUPS_DIR" -name "*${PATTERN}*" | sort -r | while read -r backup_dir; do
    dir_name=$(basename "$backup_dir")
    file_count=$(find "$backup_dir" -type f | wc -l | tr -d '[:space:]')
    timestamp=${dir_name%%_*}
    date_formatted=$(date -r "${backup_dir}" "+%d/%m/%Y %H:%M:%S")
    message=${dir_name#*_}
    
    echo "📁 ${date_formatted}: ${message} (${file_count} fichiers)"
  done

  echo -e "\nFICHIERS CORRESPONDANTS:"
  find "$BACKUPS_DIR" -type f -name "*${PATTERN}*" | sort -r | while read -r backup_file; do
    file_name=$(basename "$backup_file")
    date_formatted=$(date -r "${backup_file}" "+%d/%m/%Y %H:%M:%S")
    
    echo "📄 ${date_formatted}: ${file_name}"
  done
fi