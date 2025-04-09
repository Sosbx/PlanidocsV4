#!/bin/bash

# Script pour nettoyer les dossiers obsolètes après la migration vers la nouvelle architecture

# Vérifier si les fichiers ont été migrés avant de les supprimer
check_migration_status() {
  echo "Vérification de l'état de la migration..."
  
  # Vérifier si les nouveaux fichiers existent
  if [ ! -d "src/features/shiftExchange/components/admin" ]; then
    echo "❌ Migration incomplète : le dossier src/features/shiftExchange/components/admin n'existe pas"
    exit 1
  fi
  
  # Vérifier si les fichiers spécifiques ont été migrés
  required_files=(
    "src/features/shiftExchange/components/admin/ExchangeList.tsx"
    "src/features/shiftExchange/components/admin/ExchangeHistory.tsx"
    "src/features/shiftExchange/components/admin/ExchangeHistoryList.tsx"
    "src/features/shiftExchange/components/admin/InterestedUserCard.tsx"
    "src/features/shiftExchange/components/admin/index.ts"
  )
  
  for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
      echo "❌ Migration incomplète : le fichier $file n'existe pas"
      exit 1
    fi
  done
  
  echo "✅ Vérification réussie : tous les fichiers nécessaires ont été migrés"
}

# Supprimer les anciens fichiers
cleanup_old_files() {
  echo "Suppression des anciens fichiers..."
  
  # Créer une sauvegarde des fichiers avant de les supprimer
  backup_dir="backups/$(date +%Y%m%d_%H%M%S)_pre_cleanup"
  mkdir -p "$backup_dir/components/admin/exchange"
  
  # Copier les fichiers dans la sauvegarde
  cp -r src/components/admin/exchange/* "$backup_dir/components/admin/exchange/"
  
  echo "✅ Sauvegarde créée dans $backup_dir"
  
  # Supprimer les anciens fichiers
  rm -f src/components/admin/exchange/ExchangeList.tsx
  rm -f src/components/admin/exchange/ExchangeHistory.tsx
  rm -f src/components/admin/exchange/ExchangeHistoryList.tsx
  rm -f src/components/admin/exchange/InterestedUserCard.tsx
  
  # Vérifier si le dossier est vide et le supprimer si c'est le cas
  if [ -z "$(ls -A src/components/admin/exchange)" ]; then
    rm -rf src/components/admin/exchange
    echo "✅ Dossier src/components/admin/exchange supprimé (vide)"
  else
    echo "⚠️ Le dossier src/components/admin/exchange contient encore des fichiers et n'a pas été supprimé"
    echo "Fichiers restants :"
    ls -la src/components/admin/exchange
  fi
}

# Fonction principale
main() {
  echo "=== Nettoyage des dossiers obsolètes ==="
  
  # Vérifier si nous sommes dans le bon répertoire
  if [ ! -d "src" ] || [ ! -d "src/components" ]; then
    echo "❌ Erreur : exécutez ce script depuis la racine du projet"
    exit 1
  fi
  
  # Vérifier l'état de la migration
  check_migration_status
  
  # Demander confirmation avant de supprimer
  read -p "Êtes-vous sûr de vouloir supprimer les anciens fichiers ? (o/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Oo]$ ]]; then
    cleanup_old_files
    echo "✅ Nettoyage terminé avec succès"
  else
    echo "❌ Opération annulée"
    exit 0
  fi
}

# Exécuter la fonction principale
main
