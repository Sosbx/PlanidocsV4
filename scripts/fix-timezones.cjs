#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns à remplacer
const replacements = [
  {
    pattern: /new Date\(\)/g,
    replacement: 'createParisDate()',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['createParisDate'] }
  },
  {
    pattern: /\.toDate\(\)/g,
    replacement: 'firebaseTimestampToParisDate($&)',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['firebaseTimestampToParisDate'] },
    customReplace: (match, fullLine) => {
      // Extraire l'expression avant .toDate()
      const regex = /(\w+(?:\.\w+)*?)\.toDate\(\)/;
      const result = regex.exec(fullLine);
      if (result) {
        return fullLine.replace(regex, `firebaseTimestampToParisDate(${result[1]})`);
      }
      return fullLine;
    }
  },
  {
    pattern: /startOfMonth\(/g,
    replacement: 'startOfMonthParis(',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['startOfMonthParis'] }
  },
  {
    pattern: /endOfMonth\(/g,
    replacement: 'endOfMonthParis(',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['endOfMonthParis'] }
  },
  {
    pattern: /startOfDay\(/g,
    replacement: 'startOfDayParis(',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['startOfDayParis'] }
  },
  {
    pattern: /endOfDay\(/g,
    replacement: 'endOfDayParis(',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['endOfDayParis'] }
  },
  {
    pattern: /addMonths\(/g,
    replacement: 'addMonthsParis(',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['addMonthsParis'] }
  },
  {
    pattern: /subMonths\(/g,
    replacement: 'subMonthsParis(',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['subMonthsParis'] }
  },
  {
    pattern: /format\(([^,]+),/g,
    replacement: 'formatParisDate($1,',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['formatParisDate'] }
  },
  {
    pattern: /parse\(/g,
    replacement: 'parseParisDate(',
    importNeeded: { from: '@/utils/timezoneUtils', imports: ['parseParisDate'] }
  }
];

// Fichiers à exclure
const excludePatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/timezoneUtils.ts',
  '**/scripts/**',
  '**/backups/**',
  '**/*.json',
  '**/*.md',
  '**/*.css',
  '**/*.html'
];

// Fonction pour ajouter les imports nécessaires
function addImports(content, importsNeeded) {
  const imports = new Map();
  
  // Collecter tous les imports nécessaires
  importsNeeded.forEach(imp => {
    if (!imports.has(imp.from)) {
      imports.set(imp.from, new Set());
    }
    imp.imports.forEach(i => imports.get(imp.from).add(i));
  });
  
  // Vérifier les imports existants
  const existingImports = new Map();
  const importRegex = /import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importedItems = match[1].split(',').map(i => i.trim());
    const from = match[2];
    existingImports.set(from, new Set(importedItems));
  }
  
  // Ajouter les nouveaux imports
  let newImports = [];
  imports.forEach((items, from) => {
    const existing = existingImports.get(from) || new Set();
    const toAdd = [...items].filter(i => !existing.has(i));
    
    if (toAdd.length > 0) {
      if (existing.size > 0) {
        // Mettre à jour l'import existant
        const allItems = [...existing, ...toAdd];
        const regex = new RegExp(`import\\s*{[^}]+}\\s*from\\s*['"]${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
        content = content.replace(regex, `import { ${allItems.join(', ')} } from '${from}'`);
      } else {
        // Ajouter un nouvel import
        newImports.push(`import { ${toAdd.join(', ')} } from '${from}';`);
      }
    }
  });
  
  // Insérer les nouveaux imports après les imports existants
  if (newImports.length > 0) {
    const lastImportMatch = content.match(/^import[^;]+;$/m);
    if (lastImportMatch) {
      const lastImportIndex = content.lastIndexOf(lastImportMatch[0]) + lastImportMatch[0].length;
      content = content.slice(0, lastImportIndex) + '\n' + newImports.join('\n') + content.slice(lastImportIndex);
    } else {
      // Si aucun import n'existe, les ajouter au début
      content = newImports.join('\n') + '\n\n' + content;
    }
  }
  
  return content;
}

// Fonction pour traiter un fichier
function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const importsNeeded = [];
  
  // Appliquer les remplacements
  replacements.forEach(replacement => {
    if (replacement.customReplace) {
      // Traitement ligne par ligne pour les remplacements complexes
      const lines = content.split('\n');
      const newLines = lines.map(line => {
        if (replacement.pattern.test(line)) {
          modified = true;
          if (replacement.importNeeded) {
            importsNeeded.push(replacement.importNeeded);
          }
          return replacement.customReplace(line.match(replacement.pattern)[0], line);
        }
        return line;
      });
      content = newLines.join('\n');
    } else {
      // Remplacement simple
      const matches = content.match(replacement.pattern);
      if (matches) {
        modified = true;
        if (replacement.importNeeded) {
          importsNeeded.push(replacement.importNeeded);
        }
        content = content.replace(replacement.pattern, replacement.replacement);
      }
    }
  });
  
  // Ajouter les imports si nécessaire
  if (modified && importsNeeded.length > 0) {
    content = addImports(content, importsNeeded);
  }
  
  // Sauvegarder si modifié
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }
  
  return false;
}

// Fonction principale
function main() {
  console.log('🔍 Searching for timezone issues...\n');
  
  // Trouver tous les fichiers TypeScript et TSX
  const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: excludePatterns,
    absolute: true
  });
  
  console.log(`Found ${files.length} files to check\n`);
  
  let fixedCount = 0;
  files.forEach(file => {
    if (processFile(file)) {
      fixedCount++;
    }
  });
  
  console.log(`\n✨ Done! Fixed ${fixedCount} files.`);
  
  // Afficher les instructions post-migration
  console.log('\n📋 Post-migration checklist:');
  console.log('1. Run: npm install glob (if not already installed)');
  console.log('2. Review the changes with: git diff');
  console.log('3. Run: npm run lint');
  console.log('4. Run: npm run build');
  console.log('5. Test the application thoroughly');
  console.log('\n⚠️  Manual review required for:');
  console.log('- Complex date manipulations');
  console.log('- Date comparisons');
  console.log('- External API date handling');
}

// Exécuter le script
main();