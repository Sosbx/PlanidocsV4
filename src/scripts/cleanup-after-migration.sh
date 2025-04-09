#!/bin/bash

# Script pour nettoyer les anciens fichiers après la migration vers l'architecture Feature-First
# Ce script supprime les fichiers qui ont été migrés vers la nouvelle structure

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Nettoyage des fichiers après la migration ===${NC}"
echo "Ce script va supprimer les anciens fichiers qui ont été migrés vers la nouvelle structure."
echo "Assurez-vous d'avoir une sauvegarde avant de continuer."
echo ""

# Demander confirmation
read -p "Êtes-vous sûr de vouloir continuer ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${YELLOW}Opération annulée.${NC}"
    exit 1
fi

# Créer un répertoire de sauvegarde
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)_pre_cleanup"
mkdir -p $BACKUP_DIR

echo -e "${BLUE}Sauvegarde des fichiers dans $BACKUP_DIR...${NC}"

# Hooks migrés
echo -e "${YELLOW}Sauvegarde des hooks...${NC}"
mkdir -p $BACKUP_DIR/hooks
cp -r src/hooks/* $BACKUP_DIR/hooks/

# Components migrés
echo -e "${YELLOW}Sauvegarde des components...${NC}"
mkdir -p $BACKUP_DIR/components
cp -r src/components/* $BACKUP_DIR/components/

# Supprimer les hooks migrés
echo -e "${RED}Suppression des hooks migrés...${NC}"
rm -rf src/hooks/useAuth.ts
rm -rf src/hooks/useDesiderata.ts
rm -rf src/hooks/useDesiderataState.ts
rm -rf src/hooks/usePlanningPeriod.ts
rm -rf src/hooks/useShiftAssignments.ts
rm -rf src/hooks/useUserAssignments.ts
rm -rf src/hooks/useCachedUserData.ts
rm -rf src/hooks/shiftExchange
rm -rf src/hooks/exchange

# Supprimer les components migrés
echo -e "${RED}Suppression des components migrés...${NC}"
rm -rf src/components/auth
rm -rf src/components/bag
rm -rf src/components/exchange
rm -rf src/components/planning
rm -rf src/components/users

# Supprimer les contexts migrés
echo -e "${RED}Suppression des contexts migrés...${NC}"
rm -rf src/context/BagPhaseContext.tsx
rm -rf src/context/ExchangeContext.tsx
rm -rf src/context/PlanningContext.tsx
rm -rf src/context/PlanningPeriodContext.tsx
rm -rf src/context/UserContext.tsx

# Supprimer les pages migrées
echo -e "${RED}Suppression des pages migrées...${NC}"
rm -rf src/pages/AdminShiftExchangePage.tsx
rm -rf src/pages/DirectExchangePage.tsx
rm -rf src/pages/GeneratedPlanningPage.tsx
rm -rf src/pages/LoginPage.tsx
rm -rf src/pages/PlanningPreviewPage.tsx
rm -rf src/pages/ShiftExchangePage.tsx
rm -rf src/pages/UserPage.tsx
rm -rf src/pages/UserPlanningPage.tsx
rm -rf src/pages/ValidatedPlanningsPage.tsx

echo -e "${GREEN}Nettoyage terminé !${NC}"
echo -e "${YELLOW}Les fichiers ont été sauvegardés dans $BACKUP_DIR${NC}"
echo -e "${YELLOW}Vérifiez que l'application fonctionne correctement après le nettoyage.${NC}"
