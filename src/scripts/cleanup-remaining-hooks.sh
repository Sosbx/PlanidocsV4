#!/bin/bash

# Script pour nettoyer les hooks restants qui ont été migrés
# vers la nouvelle architecture Feature-First

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Nettoyage des hooks restants ===${NC}"

# Vérifier si nous sommes dans le bon répertoire
if [ ! -d "src" ] || [ ! -d "src/hooks" ]; then
  echo -e "${RED}❌ Erreur : exécutez ce script depuis la racine du projet${NC}"
  exit 1
fi

# Vérifier que les fichiers ont bien été migrés
check_migration_status() {
  echo "Vérification de l'état de la migration..."
  
  # Liste des fichiers à vérifier
  files_to_check=(
    "useExchangeManagement.ts"
  )
  
  for file in "${files_to_check[@]}"; do
    if [ ! -f "src/features/shiftExchange/hooks/${file}" ]; then
      echo -e "${RED}❌ Migration incomplète : le fichier src/features/shiftExchange/hooks/${file} n'existe pas${NC}"
      exit 1
    fi
  done
  
  echo -e "${GREEN}✅ Vérification réussie : tous les fichiers nécessaires ont été migrés${NC}"
}

# Créer une sauvegarde des fichiers avant de les supprimer
create_backup() {
  echo "Création d'une sauvegarde..."
  
  backup_dir="backups/$(date +%Y%m%d_%H%M%S)_remaining_hooks_backup"
  mkdir -p "$backup_dir"
  
  if [ -f "src/hooks/useExchangeManagement.ts" ]; then
    cp src/hooks/useExchangeManagement.ts "$backup_dir/"
  fi
  
  echo -e "${GREEN}✅ Sauvegarde créée dans $backup_dir${NC}"
}

# Supprimer les fichiers
cleanup_files() {
  echo "Suppression des fichiers..."
  
  files_to_remove=(
    "src/hooks/useExchangeManagement.ts"
  )
  
  for file in "${files_to_remove[@]}"; do
    if [ -f "$file" ]; then
      rm "$file"
      echo -e "${GREEN}✅ Fichier supprimé : $file${NC}"
    else
      echo -e "${YELLOW}⚠️ Fichier non trouvé : $file${NC}"
    fi
  done
}

# Fonction principale
main() {
  # Vérifier l'état de la migration
  check_migration_status
  
  # Demander confirmation avant de supprimer
  read -p "Êtes-vous sûr de vouloir supprimer les anciens fichiers ? (o/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Oo]$ ]]; then
    create_backup
    cleanup_files
    echo -e "${GREEN}✅ Nettoyage terminé avec succès${NC}"
  else
    echo -e "${YELLOW}❌ Opération annulée${NC}"
    exit 0
  fi
}

# Exécuter la fonction principale
main
