#!/usr/bin/env python3
"""
Script de migration des imports pour le projet Planidocs
Ce script parcourt tous les fichiers TypeScript/JavaScript du projet et met à jour les imports
pour les adapter à la nouvelle structure Feature-First.
"""

import os
import re
import sys
from pathlib import Path
import argparse
from typing import Dict, List, Tuple, Set

# Couleurs pour les logs
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

# Règles de migration des imports
IMPORT_RULES = [
    # Format: (regex_pattern, replacement_template, description)
    
    # Firebase config - ATTENTION: ces règles doivent être adaptées selon la profondeur du fichier
    # Pour les fichiers dans src/features/*/
    (r'from [\'"]\.\.\/lib\/firebase\/config[\'"]', 'from "../../../lib/firebase/config"', 'Firebase config (features)'),
    (r'import \{ db \} from [\'"]\.\.\/lib\/firebase\/config[\'"]', 'import { db } from "../../../lib/firebase/config"', 'Firebase db import (features)'),
    
    # Pour les fichiers dans src/context/*/
    (r'from [\'"]\.\.\/\.\.\/lib\/firebase\/config[\'"]', 'from "../../lib/firebase/config"', 'Firebase config (context)'),
    (r'import \{ db \} from [\'"]\.\.\/\.\.\/lib\/firebase\/config[\'"]', 'import { db } from "../../lib/firebase/config"', 'Firebase db import (context)'),
    (r'import \{ db \} from [\'"]\.\.\/\.\.\/\.\.\/lib\/firebase\/config[\'"]', 'from "../../lib/firebase/config"', 'Firebase db import (context)'),
    
    # Auth hooks
    (r'from [\'"]\.\.\/hooks\/useAuth[\'"]', 'from "../../../features/auth/hooks"', 'useAuth hook'),
    (r'from [\'"]\.\.\/\.\.\/hooks\/useAuth[\'"]', 'from "../../../features/auth/hooks"', 'useAuth hook'),
    (r'from [\'"]\.\.\/useAuth[\'"]', 'from "../../../features/auth/hooks"', 'useAuth hook'),
    (r'from [\'"]\.\/useAuth[\'"]', 'from "../../../features/auth/hooks"', 'useAuth hook'),
    (r'import \{ useAuth \} from [\'"]\.\.\/useAuth[\'"]', 'import { useAuth } from "../../../features/auth/hooks"', 'useAuth import'),
    (r'import \{ useAuth \} from [\'"]\.\/useAuth[\'"]', 'import { useAuth } from "../../../features/auth/hooks"', 'useAuth import'),
    
    # Planning hooks
    (r'from [\'"]\.\.\/hooks\/useDesiderata[\'"]', 'from "../../../features/planning/hooks/useDesiderata"', 'useDesiderata hook'),
    (r'from [\'"]\.\.\/\.\.\/hooks\/useDesiderata[\'"]', 'from "../../../features/planning/hooks/useDesiderata"', 'useDesiderata hook'),
    (r'from [\'"]\.\.\/useDesiderata[\'"]', 'from "../../../features/planning/hooks/useDesiderata"', 'useDesiderata hook'),
    (r'from [\'"]\.\/useDesiderata[\'"]', 'from "../../../features/planning/hooks/useDesiderata"', 'useDesiderata hook'),
    
    (r'from [\'"]\.\.\/hooks\/useDesiderataState[\'"]', 'from "../../../features/planning/hooks/useDesiderataState"', 'useDesiderataState hook'),
    (r'from [\'"]\.\.\/\.\.\/hooks\/useDesiderataState[\'"]', 'from "../../../features/planning/hooks/useDesiderataState"', 'useDesiderataState hook'),
    (r'from [\'"]\.\.\/useDesiderataState[\'"]', 'from "../../../features/planning/hooks/useDesiderataState"', 'useDesiderataState hook'),
    (r'from [\'"]\.\/useDesiderataState[\'"]', 'from "../../../features/planning/hooks/useDesiderataState"', 'useDesiderataState hook'),
    
    # Autres hooks fréquemment utilisés
    (r'from [\'"]\.\.\/hooks\/usePlanningPeriod[\'"]', 'from "../../../features/planning/hooks/usePlanningPeriod"', 'usePlanningPeriod hook'),
    (r'from [\'"]\.\.\/hooks\/useShiftAssignments[\'"]', 'from "../../../features/planning/hooks/useShiftAssignments"', 'useShiftAssignments hook'),
    (r'from [\'"]\.\.\/hooks\/useUserAssignments[\'"]', 'from "../../../features/users/hooks/useUserAssignments"', 'useUserAssignments hook'),
    (r'from [\'"]\.\.\/hooks\/useCachedUserData[\'"]', 'from "../../../features/users/hooks/useCachedUserData"', 'useCachedUserData hook'),
]

# Extensions de fichiers à traiter
FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

def find_typescript_files(root_dir: str) -> List[str]:
    """Trouve tous les fichiers TypeScript/JavaScript dans le répertoire donné."""
    files = []
    for ext in FILE_EXTENSIONS:
        for path in Path(root_dir).rglob(f'*{ext}'):
            files.append(str(path))
    return files

def process_file(file_path: str, dry_run: bool = True) -> Tuple[bool, List[str]]:
    """
    Traite un fichier pour mettre à jour les imports.
    
    Args:
        file_path: Chemin du fichier à traiter
        dry_run: Si True, n'effectue pas les modifications
        
    Returns:
        Tuple (modifié, liste des modifications)
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes = []
    
    # Appliquer chaque règle
    for pattern, replacement, description in IMPORT_RULES:
        # Chercher les correspondances
        matches = re.findall(pattern, content)
        if matches:
            # Appliquer le remplacement
            new_content = re.sub(pattern, replacement, content)
            if new_content != content:
                changes.append(f"- {description}: {len(matches)} occurrence(s)")
                content = new_content
    
    # Si des modifications ont été apportées et que ce n'est pas un dry run, écrire le fichier
    if content != original_content and not dry_run:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, changes
    
    return content != original_content, changes

def main():
    """Fonction principale."""
    parser = argparse.ArgumentParser(description='Met à jour les imports dans les fichiers TypeScript/JavaScript.')
    parser.add_argument('--dry-run', action='store_true', help='Affiche les modifications sans les appliquer')
    parser.add_argument('--dir', default='src', help='Répertoire à traiter (par défaut: src)')
    args = parser.parse_args()
    
    root_dir = args.dir
    dry_run = args.dry_run
    
    print(f"{Colors.HEADER}Migration des imports pour le projet Planidocs{Colors.ENDC}")
    print(f"Mode: {'Simulation' if dry_run else 'Application'}")
    print(f"Répertoire: {root_dir}")
    print("-" * 80)
    
    # Trouver tous les fichiers TypeScript/JavaScript
    files = find_typescript_files(root_dir)
    print(f"Nombre de fichiers trouvés: {len(files)}")
    
    # Traiter chaque fichier
    modified_files = 0
    total_changes = 0
    
    for file_path in files:
        modified, changes = process_file(file_path, dry_run)
        if modified:
            modified_files += 1
            total_changes += len(changes)
            rel_path = os.path.relpath(file_path, os.getcwd())
            print(f"\n{Colors.OKBLUE}Fichier modifié: {rel_path}{Colors.ENDC}")
            for change in changes:
                print(f"  {change}")
    
    print("\n" + "-" * 80)
    print(f"{Colors.OKGREEN}Résumé:{Colors.ENDC}")
    print(f"Fichiers analysés: {len(files)}")
    print(f"Fichiers modifiés: {modified_files}")
    print(f"Nombre total de modifications: {total_changes}")
    
    if dry_run and modified_files > 0:
        print(f"\n{Colors.WARNING}Pour appliquer ces modifications, exécutez sans l'option --dry-run{Colors.ENDC}")

if __name__ == "__main__":
    main()
