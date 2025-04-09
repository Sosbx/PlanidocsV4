#!/bin/bash

# Script pour nettoyer complètement le dossier bag

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Nettoyage complet du dossier bag ===${NC}"

# Vérifier si nous sommes dans le bon répertoire
if [ ! -d "src" ] || [ ! -d "src/components/bag" ]; then
  echo -e "${RED}❌ Erreur : exécutez ce script depuis la racine du projet${NC}"
  exit 1
fi

# Créer une sauvegarde des fichiers avant de les supprimer
create_backup() {
  echo "Création d'une sauvegarde..."
  
  backup_dir="backups/$(date +%Y%m%d_%H%M%S)_bag_folder_backup"
  mkdir -p "$backup_dir"
  
  cp -r src/components/bag/* "$backup_dir/"
  
  echo -e "${GREEN}✅ Sauvegarde créée dans $backup_dir${NC}"
}

# Supprimer le dossier bag
cleanup_folder() {
  echo "Suppression du dossier bag..."
  
  rm -rf src/components/bag
  
  echo -e "${GREEN}✅ Dossier bag supprimé${NC}"
}

# Fonction principale
main() {
  # Demander confirmation avant de supprimer
  read -p "Êtes-vous sûr de vouloir supprimer le dossier bag ? (o/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Oo]$ ]]; then
    create_backup
    cleanup_folder
    echo -e "${GREEN}✅ Nettoyage terminé avec succès${NC}"
  else
    echo -e "${YELLOW}❌ Opération annulée${NC}"
    exit 0
  fi
}

# Exécuter la fonction principale
main
