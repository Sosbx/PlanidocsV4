#!/bin/bash

# Script pour nettoyer les fichiers obsolètes après la migration de la fonctionnalité Users vers l'architecture Feature-First

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Nettoyage post-migration de la fonctionnalité Users ===${NC}"
echo -e "${YELLOW}Ce script va supprimer les fichiers obsolètes après la migration de la fonctionnalité Users vers l'architecture Feature-First.${NC}"
echo -e "${RED}ATTENTION: Ce script va supprimer des fichiers. Assurez-vous d'avoir une sauvegarde ou un commit récent.${NC}"
echo ""

read -p "Êtes-vous sûr de vouloir continuer? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${YELLOW}Opération annulée.${NC}"
    exit 1
fi

# Liste des fichiers à supprimer
FILES_TO_REMOVE=(
    "src/pages/UserPage.tsx"
    "src/components/users/StatusIndicator.tsx"
    "src/components/users/UserStatusList.tsx"
    "src/components/users/AddUserForm.tsx"
    "src/components/users/AddUserModal.tsx"
    "src/components/users/BulkAddUserForm.tsx"
    "src/components/users/EditUserModal.tsx"
    "src/components/users/UsersList.tsx"
    "src/hooks/useCachedUserData.ts"
    "src/hooks/useUserAssignments.ts"
    "src/utils/userCredentials.ts"
    "src/utils/userUtils.ts"
    "src/types/users.ts"
)

# Supprimer les fichiers
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo -e "${GREEN}✓ Fichier supprimé: $file${NC}"
    else
        echo -e "${YELLOW}! Fichier inexistant: $file${NC}"
    fi
done

echo -e "${GREEN}=== Nettoyage terminé ===${NC}"
echo -e "${YELLOW}N'oubliez pas de vérifier que l'application fonctionne correctement après ce nettoyage.${NC}"
