#!/bin/bash

# Script pour compiler et exécuter le script de correction des propositions d'échange

# Vérifier si npx est disponible
if ! command -v npx &> /dev/null; then
    echo "npx n'est pas disponible. Veuillez installer Node.js et npm."
    exit 1
fi

# Définir le chemin du script TypeScript
SCRIPT_PATH="src/scripts/fixExchangeProposalScript.ts"
OUTPUT_DIR="dist/scripts"
OUTPUT_PATH="$OUTPUT_DIR/fixExchangeProposalScript.js"

# Créer le répertoire de sortie s'il n'existe pas
mkdir -p $OUTPUT_DIR

echo "Compilation du script TypeScript..."
npx tsc --esModuleInterop --resolveJsonModule --target ES2020 --module CommonJS --outDir $OUTPUT_DIR $SCRIPT_PATH

if [ $? -ne 0 ]; then
    echo "Erreur lors de la compilation du script."
    exit 1
fi

echo "Exécution du script..."
if [ "$1" != "" ]; then
    # Si un ID de proposition est fourni, le passer au script
    node $OUTPUT_PATH "$1"
else
    # Sinon, exécuter le script sans arguments
    node $OUTPUT_PATH
fi

echo "Terminé."
