#!/bin/bash

# Script pour nettoyer les hooks obsolètes après la migration vers la nouvelle architecture

# Vérifier si les hooks ont été migrés avant de les supprimer
check_migration_status() {
  echo "Vérification de l'état de la migration des hooks..."
  
  # Vérifier si les nouveaux hooks existent
  if [ ! -d "src/features/shiftExchange/hooks" ]; then
    echo "❌ Migration incomplète : le dossier src/features/shiftExchange/hooks n'existe pas"
    exit 1
  fi
  
  # Vérifier si les hooks spécifiques ont été migrés
  required_files=(
    "src/features/shiftExchange/hooks/useBagPhase.ts"
    "src/features/shiftExchange/hooks/useShiftExchangeData.ts"
    "src/features/shiftExchange/hooks/useShiftInteraction.ts"
    "src/features/shiftExchange/hooks/useConflictCheck.ts"
    "src/features/shiftExchange/hooks/index.ts"
  )
  
  for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
      echo "❌ Migration incomplète : le hook $file n'existe pas"
      exit 1
    fi
  done
  
  echo "✅ Vérification réussie : tous les hooks nécessaires ont été migrés"
}

# Supprimer les anciens hooks
cleanup_old_hooks() {
  echo "Suppression des anciens hooks..."
  
  # Créer une sauvegarde des hooks avant de les supprimer
  backup_dir="backups/$(date +%Y%m%d_%H%M%S)_pre_hooks_cleanup"
  mkdir -p "$backup_dir/hooks"
  
  # Copier les hooks dans la sauvegarde
  if [ -f "src/hooks/useConflictCheck.ts" ]; then
    cp src/hooks/useConflictCheck.ts "$backup_dir/hooks/"
  fi
  
  echo "✅ Sauvegarde créée dans $backup_dir"
  
  # Supprimer les anciens hooks
  rm -f src/hooks/useConflictCheck.ts
  
  echo "✅ Hooks obsolètes supprimés"
}

# Fonction principale
main() {
  echo "=== Nettoyage des hooks obsolètes ==="
  
  # Vérifier si nous sommes dans le bon répertoire
  if [ ! -d "src" ] || [ ! -d "src/hooks" ]; then
    echo "❌ Erreur : exécutez ce script depuis la racine du projet"
    exit 1
  fi
  
  # Vérifier l'état de la migration
  check_migration_status
  
  # Demander confirmation avant de supprimer
  read -p "Êtes-vous sûr de vouloir supprimer les anciens hooks ? (o/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Oo]$ ]]; then
    cleanup_old_hooks
    echo "✅ Nettoyage terminé avec succès"
  else
    echo "❌ Opération annulée"
    exit 0
  fi
}

# Exécuter la fonction principale
main
