# Scripts d'aide à la migration et à la maintenance

Ce dossier contient des scripts pour aider à la migration vers l'architecture Feature-First et à la maintenance du code.

## Scripts disponibles

### 1. `migrate-feature.sh`

Script pour aider à la migration d'une fonctionnalité vers l'architecture Feature-First.

#### Usage

```bash
./migrate-feature.sh <feature-name>
```

Exemple:
```bash
./migrate-feature.sh planning
```

Ce script va:
1. Créer la structure de dossiers pour la fonctionnalité
2. Rechercher les composants, hooks, utilitaires, pages et types liés à la fonctionnalité
3. Proposer de les copier vers la nouvelle structure
4. Créer les fichiers index.ts et README.md pour la fonctionnalité

#### Étapes après l'exécution

Après avoir exécuté ce script, vous devrez:
1. Vérifier que tous les imports sont corrects dans les fichiers migrés
2. Mettre à jour les exports dans les fichiers index.ts
3. Tester que tout fonctionne correctement avant de supprimer les fichiers originaux
4. Mettre à jour la documentation dans le fichier README.md

### 2. `cleanup-after-migration.sh`

Script pour nettoyer les dossiers et fichiers obsolètes après la migration vers l'architecture Feature-First.

#### Usage

```bash
./cleanup-after-migration.sh
```

⚠️ **ATTENTION**: Ce script va supprimer des fichiers. Assurez-vous d'avoir une sauvegarde ou un commit récent.

Ce script va:
1. Supprimer les dossiers components obsolètes (admin, auth, bag, exchange, planning, users)
2. Supprimer les dossiers hooks obsolètes (exchange, shiftExchange)
3. Supprimer les fichiers hooks racine obsolètes
4. Supprimer les fichiers contexte racine obsolètes
5. Supprimer les fichiers de backup

#### Quand l'utiliser

N'utilisez ce script qu'une fois que toutes les fonctionnalités ont été migrées et que vous avez vérifié que tout fonctionne correctement.

### 3. `cleanup-hooks.sh`

Script pour nettoyer les hooks obsolètes après la migration des hooks vers l'architecture Feature-First.

#### Usage

```bash
./cleanup-hooks.sh
```

Ce script est utilisé pour nettoyer les hooks obsolètes après avoir migré les hooks vers la nouvelle structure.

### 4. `cleanup-obsolete-folders.sh`

Script pour nettoyer les dossiers obsolètes après la migration vers l'architecture Feature-First.

#### Usage

```bash
./cleanup-obsolete-folders.sh
```

Ce script est utilisé pour nettoyer les dossiers obsolètes après avoir migré les fonctionnalités vers la nouvelle structure.

## Bonnes pratiques

1. **Toujours faire un commit avant d'exécuter ces scripts** pour pouvoir revenir en arrière si nécessaire
2. **Tester l'application après chaque migration** pour s'assurer que tout fonctionne correctement
3. **Mettre à jour la documentation** pour refléter les changements
4. **Suivre le plan de migration** défini dans `src/docs/migration-plan.md`
5. **Utiliser les scripts dans l'ordre recommandé**:
   - D'abord `migrate-feature.sh` pour chaque fonctionnalité
   - Ensuite `cleanup-hooks.sh` et `cleanup-obsolete-folders.sh` pour nettoyer les fichiers obsolètes
   - Enfin `cleanup-after-migration.sh` une fois que tout a été migré

## Résolution des problèmes

Si vous rencontrez des problèmes lors de l'utilisation de ces scripts:

1. **Vérifiez les permissions**: Assurez-vous que les scripts sont exécutables (`chmod +x script.sh`)
2. **Vérifiez les chemins**: Assurez-vous que vous exécutez les scripts depuis la racine du projet
3. **Vérifiez les imports**: Les imports peuvent être cassés après la migration, vérifiez-les manuellement
4. **Consultez les logs**: Les scripts affichent des messages pour indiquer ce qu'ils font
