#!/usr/bin/env python3

import os
import re
import sys

def update_imports_in_file(file_path):
    """
    Met à jour les imports de useAuth dans un fichier.
    """
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Déterminer le chemin relatif correct en fonction de la profondeur du fichier
    depth = file_path.count('/') - 1  # Ajuster pour le dossier src/
    rel_path = '../' * depth
    
    # Remplacer l'ancien import par le nouveau
    pattern = r"import\s*{\s*useAuth\s*}\s*from\s*['\"](.*/hooks/useAuth)['\"]"
    replacement = f"import {{ useAuth }} from '{rel_path}features/auth/hooks'"
    
    new_content = re.sub(pattern, replacement, content)
    
    if new_content != content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        return True
    return False

def find_files_with_import(directory, pattern):
    """
    Trouve tous les fichiers dans le répertoire qui contiennent le motif spécifié.
    """
    matching_files = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                file_path = os.path.join(root, file)
                with open(file_path, 'r') as f:
                    content = f.read()
                if re.search(pattern, content):
                    matching_files.append(file_path)
    return matching_files

def main():
    """
    Fonction principale.
    """
    # Trouver tous les fichiers qui importent useAuth depuis hooks/useAuth
    pattern = r"import\s*{\s*useAuth\s*}\s*from\s*['\"](.*/hooks/useAuth)['\"]"
    files = find_files_with_import('src', pattern)
    
    # Mettre à jour les imports dans chaque fichier
    updated_count = 0
    for file in files:
        print(f"Traitement du fichier: {file}")
        if update_imports_in_file(file):
            updated_count += 1
    
    print(f"Mise à jour terminée. {updated_count} fichiers ont été mis à jour.")

if __name__ == "__main__":
    main()
