#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Trouver tous les fichiers TypeScript/JavaScript
const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
  ignore: ['**/node_modules/**', '**/dist/**', '**/scripts/**']
});

let updatedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Pattern 1: import { fr } from 'date-fns/locale'
  if (content.includes("import { fr } from 'date-fns/locale'")) {
    content = content.replace(
      "import { fr } from 'date-fns/locale'",
      "import { frLocale as fr } from '../utils/dateLocale'"
    );
    modified = true;
  }

  // Pattern 2: import { fr } from 'date-fns/locale/fr'
  if (content.includes("import { fr } from 'date-fns/locale/fr'")) {
    content = content.replace(
      "import { fr } from 'date-fns/locale/fr'",
      "import { frLocale as fr } from '../utils/dateLocale'"
    );
    modified = true;
  }

  // Pattern 3: from 'date-fns/locale' avec autres imports
  const localeImportRegex = /from ['"]date-fns\/locale['"]/g;
  if (localeImportRegex.test(content)) {
    // Ajuster le chemin relatif selon la profondeur du fichier
    const depth = file.split('/').length - 2; // -1 pour src, -1 pour le fichier lui-même
    const relativePath = '../'.repeat(depth) + 'utils/dateLocale';
    
    content = content.replace(localeImportRegex, `from '${relativePath}'`);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content);
    updatedFiles++;
    console.log(`✅ Updated: ${file}`);
  }
});

console.log(`\n📊 Total files updated: ${updatedFiles}`);