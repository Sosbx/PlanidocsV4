#!/bin/bash

# Script pour aider à la migration d'une fonctionnalité vers l'architecture Feature-First
# Usage: ./migrate-feature.sh <feature-name>
# Exemple: ./migrate-feature.sh planning

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier si un nom de fonctionnalité a été fourni
if [ -z "$1" ]; then
    echo -e "${RED}Erreur: Nom de fonctionnalité manquant${NC}"
    echo -e "${YELLOW}Usage: ./migrate-feature.sh <feature-name>${NC}"
    echo -e "${YELLOW}Exemple: ./migrate-feature.sh planning${NC}"
    exit 1
fi

FEATURE_NAME=$1
FEATURE_DIR="src/features/$FEATURE_NAME"

echo -e "${BLUE}=== Migration de la fonctionnalité '$FEATURE_NAME' ===${NC}"

# Créer la structure de dossiers pour la fonctionnalité
create_feature_structure() {
    echo -e "${YELLOW}Création de la structure de dossiers...${NC}"
    
    mkdir -p "$FEATURE_DIR/components"
    mkdir -p "$FEATURE_DIR/hooks"
    mkdir -p "$FEATURE_DIR/utils"
    mkdir -p "$FEATURE_DIR/pages"
    
    # Créer les fichiers de base
    if [ ! -f "$FEATURE_DIR/types.ts" ]; then
        echo "// Types pour la fonctionnalité $FEATURE_NAME" > "$FEATURE_DIR/types.ts"
        echo -e "${GREEN}✓ Fichier types.ts créé${NC}"
    fi
    
    if [ ! -f "$FEATURE_DIR/index.ts" ]; then
        echo "// Point d'entrée pour la fonctionnalité $FEATURE_NAME" > "$FEATURE_DIR/index.ts"
        echo "// Exporte l'API publique de la fonctionnalité" >> "$FEATURE_DIR/index.ts"
        echo "" >> "$FEATURE_DIR/index.ts"
        echo "// Exporter les composants" >> "$FEATURE_DIR/index.ts"
        echo "export * from './components';" >> "$FEATURE_DIR/index.ts"
        echo "" >> "$FEATURE_DIR/index.ts"
        echo "// Exporter les hooks" >> "$FEATURE_DIR/index.ts"
        echo "export * from './hooks';" >> "$FEATURE_DIR/index.ts"
        echo "" >> "$FEATURE_DIR/index.ts"
        echo "// Exporter les types" >> "$FEATURE_DIR/index.ts"
        echo "export * from './types';" >> "$FEATURE_DIR/index.ts"
        echo -e "${GREEN}✓ Fichier index.ts créé${NC}"
    fi
    
    if [ ! -f "$FEATURE_DIR/README.md" ]; then
        echo "# Fonctionnalité $FEATURE_NAME" > "$FEATURE_DIR/README.md"
        echo "" >> "$FEATURE_DIR/README.md"
        echo "## Description" >> "$FEATURE_DIR/README.md"
        echo "" >> "$FEATURE_DIR/README.md"
        echo "## Composants" >> "$FEATURE_DIR/README.md"
        echo "" >> "$FEATURE_DIR/README.md"
        echo "## Hooks" >> "$FEATURE_DIR/README.md"
        echo "" >> "$FEATURE_DIR/README.md"
        echo "## API" >> "$FEATURE_DIR/README.md"
        echo "" >> "$FEATURE_DIR/README.md"
        echo -e "${GREEN}✓ Fichier README.md créé${NC}"
    fi
    
    # Créer les fichiers index.ts pour chaque sous-dossier
    for dir in components hooks utils pages; do
        if [ ! -f "$FEATURE_DIR/$dir/index.ts" ]; then
            echo "// Exporte tous les $dir de la fonctionnalité $FEATURE_NAME" > "$FEATURE_DIR/$dir/index.ts"
            echo -e "${GREEN}✓ Fichier $dir/index.ts créé${NC}"
        fi
    done
    
    echo -e "${GREEN}✓ Structure de dossiers créée${NC}"
}

# Déplacer les composants
migrate_components() {
    echo -e "${YELLOW}Recherche des composants à migrer...${NC}"
    
    # Vérifier si le dossier des composants existe
    if [ -d "src/components/$FEATURE_NAME" ]; then
        echo -e "${BLUE}Dossier src/components/$FEATURE_NAME trouvé${NC}"
        
        # Lister les fichiers à déplacer
        FILES=$(find "src/components/$FEATURE_NAME" -name "*.tsx" -o -name "*.ts" | grep -v "index.ts")
        
        if [ -z "$FILES" ]; then
            echo -e "${YELLOW}Aucun fichier trouvé dans src/components/$FEATURE_NAME${NC}"
        else
            echo -e "${BLUE}Fichiers trouvés:${NC}"
            echo "$FILES"
            
            # Demander confirmation
            read -p "Voulez-vous déplacer ces fichiers vers $FEATURE_DIR/components? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Déplacer les fichiers
                for file in $FILES; do
                    filename=$(basename "$file")
                    cp "$file" "$FEATURE_DIR/components/$filename"
                    echo -e "${GREEN}✓ Fichier $filename copié${NC}"
                done
                
                echo -e "${YELLOW}Les fichiers ont été copiés. Vérifiez qu'ils fonctionnent correctement avant de supprimer les originaux.${NC}"
            else
                echo -e "${YELLOW}Migration des composants annulée.${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}Dossier src/components/$FEATURE_NAME non trouvé${NC}"
    fi
}

# Déplacer les hooks
migrate_hooks() {
    echo -e "${YELLOW}Recherche des hooks à migrer...${NC}"
    
    # Vérifier si le dossier des hooks existe
    if [ -d "src/hooks/$FEATURE_NAME" ]; then
        echo -e "${BLUE}Dossier src/hooks/$FEATURE_NAME trouvé${NC}"
        
        # Lister les fichiers à déplacer
        FILES=$(find "src/hooks/$FEATURE_NAME" -name "*.tsx" -o -name "*.ts" | grep -v "index.ts")
        
        if [ -z "$FILES" ]; then
            echo -e "${YELLOW}Aucun fichier trouvé dans src/hooks/$FEATURE_NAME${NC}"
        else
            echo -e "${BLUE}Fichiers trouvés:${NC}"
            echo "$FILES"
            
            # Demander confirmation
            read -p "Voulez-vous déplacer ces fichiers vers $FEATURE_DIR/hooks? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Déplacer les fichiers
                for file in $FILES; do
                    filename=$(basename "$file")
                    cp "$file" "$FEATURE_DIR/hooks/$filename"
                    echo -e "${GREEN}✓ Fichier $filename copié${NC}"
                done
                
                echo -e "${YELLOW}Les fichiers ont été copiés. Vérifiez qu'ils fonctionnent correctement avant de supprimer les originaux.${NC}"
            else
                echo -e "${YELLOW}Migration des hooks annulée.${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}Dossier src/hooks/$FEATURE_NAME non trouvé${NC}"
    fi
    
    # Rechercher les hooks au niveau racine
    echo -e "${YELLOW}Recherche des hooks racine liés à $FEATURE_NAME...${NC}"
    
    # Lister les fichiers potentiels
    FILES=$(find "src/hooks" -maxdepth 1 -name "use*$FEATURE_NAME*.ts" -o -name "use*$(tr '[:lower:]' '[:upper:]' <<< ${FEATURE_NAME:0:1})${FEATURE_NAME:1}*.ts")
    
    if [ -z "$FILES" ]; then
        echo -e "${YELLOW}Aucun hook racine lié à $FEATURE_NAME trouvé${NC}"
    else
        echo -e "${BLUE}Hooks racine potentiellement liés à $FEATURE_NAME:${NC}"
        echo "$FILES"
        
        # Demander confirmation pour chaque fichier
        for file in $FILES; do
            filename=$(basename "$file")
            read -p "Voulez-vous copier $filename vers $FEATURE_DIR/hooks? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "$file" "$FEATURE_DIR/hooks/$filename"
                echo -e "${GREEN}✓ Fichier $filename copié${NC}"
            else
                echo -e "${YELLOW}Fichier $filename ignoré${NC}"
            fi
        done
    fi
}

# Déplacer les utilitaires
migrate_utils() {
    echo -e "${YELLOW}Recherche des utilitaires à migrer...${NC}"
    
    # Vérifier si le dossier des utilitaires existe
    if [ -d "src/utils/$FEATURE_NAME" ]; then
        echo -e "${BLUE}Dossier src/utils/$FEATURE_NAME trouvé${NC}"
        
        # Lister les fichiers à déplacer
        FILES=$(find "src/utils/$FEATURE_NAME" -name "*.tsx" -o -name "*.ts" | grep -v "index.ts")
        
        if [ -z "$FILES" ]; then
            echo -e "${YELLOW}Aucun fichier trouvé dans src/utils/$FEATURE_NAME${NC}"
        else
            echo -e "${BLUE}Fichiers trouvés:${NC}"
            echo "$FILES"
            
            # Demander confirmation
            read -p "Voulez-vous déplacer ces fichiers vers $FEATURE_DIR/utils? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Déplacer les fichiers
                for file in $FILES; do
                    filename=$(basename "$file")
                    cp "$file" "$FEATURE_DIR/utils/$filename"
                    echo -e "${GREEN}✓ Fichier $filename copié${NC}"
                done
                
                echo -e "${YELLOW}Les fichiers ont été copiés. Vérifiez qu'ils fonctionnent correctement avant de supprimer les originaux.${NC}"
            else
                echo -e "${YELLOW}Migration des utilitaires annulée.${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}Dossier src/utils/$FEATURE_NAME non trouvé${NC}"
    fi
    
    # Rechercher les utilitaires au niveau racine
    echo -e "${YELLOW}Recherche des utilitaires racine liés à $FEATURE_NAME...${NC}"
    
    # Lister les fichiers potentiels
    FILES=$(find "src/utils" -maxdepth 1 -name "*$FEATURE_NAME*.ts")
    
    if [ -z "$FILES" ]; then
        echo -e "${YELLOW}Aucun utilitaire racine lié à $FEATURE_NAME trouvé${NC}"
    else
        echo -e "${BLUE}Utilitaires racine potentiellement liés à $FEATURE_NAME:${NC}"
        echo "$FILES"
        
        # Demander confirmation pour chaque fichier
        for file in $FILES; do
            filename=$(basename "$file")
            read -p "Voulez-vous copier $filename vers $FEATURE_DIR/utils? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "$file" "$FEATURE_DIR/utils/$filename"
                echo -e "${GREEN}✓ Fichier $filename copié${NC}"
            else
                echo -e "${YELLOW}Fichier $filename ignoré${NC}"
            fi
        done
    fi
}

# Déplacer les pages
migrate_pages() {
    echo -e "${YELLOW}Recherche des pages à migrer...${NC}"
    
    # Lister les fichiers potentiels
    FILES=$(find "src/pages" -maxdepth 1 -name "*$FEATURE_NAME*.tsx")
    
    if [ -z "$FILES" ]; then
        echo -e "${YELLOW}Aucune page liée à $FEATURE_NAME trouvée${NC}"
    else
        echo -e "${BLUE}Pages potentiellement liées à $FEATURE_NAME:${NC}"
        echo "$FILES"
        
        # Demander confirmation pour chaque fichier
        for file in $FILES; do
            filename=$(basename "$file")
            read -p "Voulez-vous copier $filename vers $FEATURE_DIR/pages? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "$file" "$FEATURE_DIR/pages/$filename"
                echo -e "${GREEN}✓ Fichier $filename copié${NC}"
                
                # Mettre à jour l'index.ts des pages
                echo "export { default as $(basename "$filename" .tsx) } from './$filename';" >> "$FEATURE_DIR/pages/index.ts"
                echo -e "${GREEN}✓ Index des pages mis à jour${NC}"
            else
                echo -e "${YELLOW}Fichier $filename ignoré${NC}"
            fi
        done
    fi
}

# Déplacer les types
migrate_types() {
    echo -e "${YELLOW}Recherche des types à migrer...${NC}"
    
    # Vérifier si le fichier de types existe
    if [ -f "src/types/$FEATURE_NAME.ts" ]; then
        echo -e "${BLUE}Fichier src/types/$FEATURE_NAME.ts trouvé${NC}"
        
        # Demander confirmation
        read -p "Voulez-vous copier les types vers $FEATURE_DIR/types.ts? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Lire le contenu du fichier de types
            TYPES_CONTENT=$(cat "src/types/$FEATURE_NAME.ts")
            
            # Ajouter le contenu au fichier types.ts
            echo "$TYPES_CONTENT" > "$FEATURE_DIR/types.ts"
            echo -e "${GREEN}✓ Types copiés${NC}"
        else
            echo -e "${YELLOW}Migration des types annulée.${NC}"
        fi
    else
        echo -e "${YELLOW}Fichier src/types/$FEATURE_NAME.ts non trouvé${NC}"
    fi
}

# Exécuter les étapes de migration
create_feature_structure
migrate_components
migrate_hooks
migrate_utils
migrate_pages
migrate_types

echo -e "${BLUE}=== Migration terminée ===${NC}"
echo -e "${YELLOW}N'oubliez pas de:${NC}"
echo -e "${YELLOW}1. Vérifier que tous les imports sont corrects dans les fichiers migrés${NC}"
echo -e "${YELLOW}2. Mettre à jour les exports dans les fichiers index.ts${NC}"
echo -e "${YELLOW}3. Tester que tout fonctionne correctement avant de supprimer les fichiers originaux${NC}"
echo -e "${YELLOW}4. Mettre à jour la documentation dans le fichier README.md${NC}"
