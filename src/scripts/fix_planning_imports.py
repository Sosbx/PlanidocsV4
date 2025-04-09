#!/usr/bin/env python3
import os
import re
import sys

def fix_imports(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # Définir les règles de remplacement pour les imports
    replacements = [
        # Contextes
        (r'from [\'"](\.\.\/context\/shiftExchange)[\'"]', r'from "../../../context/shiftExchange"'),
        (r'from [\'"](\.\.\/context\/planning\/PlanningContext)[\'"]', r'from "../../../context/planning/PlanningContext"'),
        
        # Composants
        (r'from [\'"](\.\.\/components\/common\/Switch)[\'"]', r'from "../components/common/Switch"'),
        (r'from [\'"](\.\.\/components\/common\/LoadingSpinner)[\'"]', r'from "../components/common/LoadingSpinner"'),
        (r'from [\'"](\.\.\/components\/planning\/PlanningTutorial)[\'"]', r'from "../components/PlanningTutorial"'),
        (r'from [\'"](\.\.\/components\/Toast)[\'"]', r'from "../../../components/Toast"'),
        (r'import (.*) from [\'"](\.\.\/components\/planning\/GeneratedPlanningTable)[\'"]', r'import \1 from "../components/GeneratedPlanningTable"'),
        
        # Types
        (r'from [\'"](\.\.\/types\/planning)[\'"]', r'from "../types"'),
        
        # Utils
        (r'from [\'"](\.\.\/utils\/timeUtils)[\'"]', r'from "../utils/timeUtils"'),
        (r'from [\'"](\.\.\/utils\/lazyExporters)[\'"]', r'from "../utils/lazyExporters"'),
        
        # Firebase
        (r'from [\'"](\.\.\/lib\/firebase\/desiderata)[\'"]', r'from "../../../lib/firebase/desiderata"'),
    ]

    # Appliquer les remplacements
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    # Écrire le contenu modifié dans le fichier
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(content)

    print(f"Imports corrigés dans {file_path}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        if os.path.exists(file_path):
            fix_imports(file_path)
        else:
            print(f"Le fichier {file_path} n'existe pas.")
    else:
        print("Usage: python fix_planning_imports.py <chemin_du_fichier>")
