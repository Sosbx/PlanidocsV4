#!/bin/bash

# Script pour sauvegarder les fichiers importants du projet
# Usage: ./backup_important_files.sh [message]

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MESSAGE="${1:-backup_automatique}"
PROJECT_ROOT="/Users/arkane/Documents/planidoc/Planidocs V4"
BACKUP_DIR="${PROJECT_ROOT}/backups/${TIMESTAMP}_${MESSAGE}"

# Créer le dossier de sauvegarde avec timestamp
mkdir -p "$BACKUP_DIR"

# Liste des fichiers importants à sauvegarder
IMPORTANT_FILES=(
  # Pages
  "src/pages/ShiftExchangePage.tsx"
  "src/pages/AdminShiftExchangePage.tsx"
  
  # Composants
  "src/components/bag/GroupedShiftExchangeList.tsx"
  "src/components/bag/BagPhaseIndicator.tsx"
  "src/components/modals/ConflictModal.tsx"
  "src/components/planning/PermanentPlanningPreview.tsx"
  
  # Contexte et hooks
  "src/context/BagPhaseContext.tsx"
  "src/hooks/useConflictCheck.ts"
  "src/hooks/useExchangeData.ts"
  
  # Lib et utils
  "src/lib/firebase/shifts.ts"
  "src/utils/dateUtils.ts"
)

echo "Création du backup dans $BACKUP_DIR"

# Copier chaque fichier important
for file in "${IMPORTANT_FILES[@]}"; do
  SOURCE="${PROJECT_ROOT}/${file}"
  TARGET="${BACKUP_DIR}/$(basename "$file")"
  
  if [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$TARGET"
    echo "Sauvegarde: $file"
  else
    echo "Attention: Fichier non trouvé: $file"
  fi
done

echo "Sauvegarde terminée: ${#IMPORTANT_FILES[@]} fichiers"