#!/usr/bin/env node

/**
 * Script pour migrer console.log vers le logger centralisé
 * Usage: node scripts/migrate-console-logs.js [--dry-run] [--context=CONTEXT]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// Arguments
const isDryRun = process.argv.includes('--dry-run');
const contextArg = process.argv.find(arg => arg.startsWith('--context='));
const specificContext = contextArg ? contextArg.split('=')[1] : null;

// Mapping des contextes par dossier/fichier
const CONTEXT_MAPPING = {
  // Par dossier
  'auth': 'AUTH',
  'planning': 'PLANNING', 
  'exchange': 'EXCHANGE',
  'shiftExchange': 'EXCHANGE',
  'directExchange': 'EXCHANGE',
  'users': 'USERS',
  'context/auth': 'AUTH',
  'context/planning': 'PLANNING',
  'context/shiftExchange': 'EXCHANGE',
  'context/directExchange': 'EXCHANGE',
  'lib/firebase': 'FIREBASE',
  'api': 'API',
  
  // Par type de fichier
  'Repository.ts': 'REPOSITORY',
  'Context.tsx': 'CONTEXT',
  'Hook.ts': 'HOOK',
  'Service.ts': 'SERVICE'
};

// Fonction pour échapper les caractères spéciaux dans les template literals
function escapeForTemplate(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

// Fonction pour nettoyer et formater les arguments
function cleanArguments(args) {
  if (!args || args.trim() === '') return '';
  return args.trim().replace(/,\s*$/, ''); // Enlever les virgules en fin
}

// Patterns de remplacement améliorés
const REPLACEMENT_PATTERNS = [
  // Template literals avec interpolation
  {
    pattern: /console\.(log|error|warn|info)\((['"`])([^'"`]*\$\{[^}]*\}[^'"`]*)\2(?:,?\s*([^)]*))?\)/g,
    replacement: (match, method, quote, message, args) => {
      const context = inferContext(message);
      const logLevel = method === 'log' ? 'debug' : method;
      const cleanArgs = cleanArguments(args);
      const cleanMessage = escapeForTemplate(message);
      
      if (cleanArgs) {
        return `logger.${logLevel}('${context}', \`${cleanMessage}\`, ${cleanArgs})`;
      }
      return `logger.${logLevel}('${context}', \`${cleanMessage}\`)`;
    }
  },
  
  // Chaînes simples avec guillemets simples
  {
    pattern: /console\.(log|error|warn|info)\('([^']*)'(?:,?\s*([^)]*))?\)/g,
    replacement: (match, method, message, args) => {
      const context = inferContext(message);
      const logLevel = method === 'log' ? 'debug' : method;
      const cleanArgs = cleanArguments(args);
      const escapedMessage = message.replace(/'/g, "\\'");
      
      if (cleanArgs) {
        return `logger.${logLevel}('${context}', '${escapedMessage}', ${cleanArgs})`;
      }
      return `logger.${logLevel}('${context}', '${escapedMessage}')`;
    }
  },
  
  // Chaînes simples avec guillemets doubles
  {
    pattern: /console\.(log|error|warn|info)\("([^"]*)"(?:,?\s*([^)]*))?\)/g,
    replacement: (match, method, message, args) => {
      const context = inferContext(message);
      const logLevel = method === 'log' ? 'debug' : method;
      const cleanArgs = cleanArguments(args);
      const escapedMessage = message.replace(/"/g, '\\"');
      
      if (cleanArgs) {
        return `logger.${logLevel}('${context}', "${escapedMessage}", ${cleanArgs})`;
      }
      return `logger.${logLevel}('${context}', "${escapedMessage}")`;
    }
  },
  
  // Appels console sans guillemets (variables, expressions)
  {
    pattern: /console\.(log|error|warn|info)\(([^'"`][^)]*)\)/g,
    replacement: (match, method, args) => {
      const logLevel = method === 'log' ? 'debug' : method;
      const cleanArgs = cleanArguments(args);
      return `logger.${logLevel}('APP', ${cleanArgs})`;
    }
  }
];

// Fonction pour inférer le contexte depuis le message
function inferContext(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('auth') || msg.includes('login') || msg.includes('logout')) return 'AUTH';
  if (msg.includes('planning') || msg.includes('period') || msg.includes('assignment')) return 'PLANNING';
  if (msg.includes('exchange') || msg.includes('bourse') || msg.includes('garde')) return 'EXCHANGE';
  if (msg.includes('firebase') || msg.includes('firestore')) return 'FIREBASE';
  if (msg.includes('user') || msg.includes('utilisateur')) return 'USERS';
  if (msg.includes('error') || msg.includes('erreur')) return 'ERROR';
  if (msg.includes('config') || msg.includes('phase')) return 'CONFIG';
  if (msg.includes('export') || msg.includes('pdf') || msg.includes('excel')) return 'EXPORT';
  if (msg.includes('notification') || msg.includes('toast')) return 'UI';
  if (msg.includes('perf') || msg.includes('performance')) return 'PERF';
  if (msg.includes('network') || msg.includes('request')) return 'NETWORK';
  
  return 'APP';
}

// Fonction pour déterminer le contexte par fichier
function getFileContext(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath);
  
  // Vérifier les mappings spécifiques
  for (const [pattern, context] of Object.entries(CONTEXT_MAPPING)) {
    if (relativePath.includes(pattern)) {
      return context;
    }
  }
  
  // Contexte par défaut basé sur le dossier principal
  const mainDir = relativePath.split('/')[0];
  switch (mainDir) {
    case 'features': return relativePath.split('/')[1]?.toUpperCase() || 'FEATURE';
    case 'context': return 'CONTEXT';
    case 'lib': return 'LIB';
    case 'api': return 'API';
    case 'utils': return 'UTILS';
    case 'pages': return 'PAGE';
    case 'components': return 'COMPONENT';
    default: return 'APP';
  }
}

// Fonction pour traiter un fichier
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let hasChanges = false;
  let addImport = false;
  
  // Appliquer les patterns de remplacement
  for (const { pattern, replacement } of REPLACEMENT_PATTERNS) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      hasChanges = true;
      addImport = true;
      
      if (typeof replacement === 'function') {
        newContent = newContent.replace(pattern, replacement);
      } else {
        newContent = newContent.replace(pattern, replacement);
      }
    }
  }
  
  // Ajouter l'import du logger si nécessaire
  if (addImport && !content.includes('from \'../utils/logger\'') && !content.includes('from \'../../utils/logger\'')) {
    // Calculer le chemin relatif vers utils/logger
    const relativePath = path.relative(path.dirname(filePath), path.join(SRC_DIR, 'utils', 'logger'));
    const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
    const cleanImportPath = importPath.replace(/\\/g, '/').replace('.ts', '');
    
    // Ajouter l'import après les autres imports
    const importRegex = /(import[^;]+;\s*)+/;
    const match = newContent.match(importRegex);
    if (match) {
      const insertPoint = match.index + match[0].length;
      newContent = newContent.slice(0, insertPoint) + 
                  `import { logger } from '${cleanImportPath}';\n` +
                  newContent.slice(insertPoint);
    } else {
      // Ajouter au début du fichier si pas d'imports
      newContent = `import { logger } from '${cleanImportPath}';\n\n` + newContent;
    }
  }
  
  return { content: newContent, hasChanges, originalContent: content };
}

// Fonction pour trouver tous les fichiers TypeScript/React
function findTSFiles(dir) {
  const files = [];
  
  function scanDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDir(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }
  
  scanDir(dir);
  return files;
}

// Main
function main() {
  console.log('🔄 Migration des console.log vers le logger centralisé...');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'MODIFICATION'}`);
  if (specificContext) {
    console.log(`Contexte spécifique: ${specificContext}`);
  }
  
  const files = findTSFiles(SRC_DIR);
  let processedFiles = 0;
  let modifiedFiles = 0;
  let totalReplacements = 0;
  
  for (const filePath of files) {
    // Filtrer par contexte si spécifié
    if (specificContext) {
      const fileContext = getFileContext(filePath);
      if (fileContext !== specificContext.toUpperCase()) {
        continue;
      }
    }
    
    try {
      const result = processFile(filePath);
      processedFiles++;
      
      if (result.hasChanges) {
        modifiedFiles++;
        const replacements = (result.originalContent.match(/console\.[a-z]+/g) || []).length;
        totalReplacements += replacements;
        
        console.log(`✅ ${path.relative(PROJECT_ROOT, filePath)} (${replacements} remplacements)`);
        
        if (!isDryRun) {
          fs.writeFileSync(filePath, result.content, 'utf8');
        }
      }
    } catch (error) {
      console.error(`❌ Erreur sur ${filePath}:`, error.message);
    }
  }
  
  console.log('\\n📊 Résultats:');
  console.log(`- Fichiers traités: ${processedFiles}`);
  console.log(`- Fichiers modifiés: ${modifiedFiles}`);
  console.log(`- Remplacements totaux: ${totalReplacements}`);
  
  if (isDryRun) {
    console.log('\\n🔍 Mode dry-run activé - aucune modification effectuée');
    console.log('Pour appliquer les changements: node scripts/migrate-console-logs.js');
  } else {
    console.log('\\n✅ Migration terminée avec succès !');
  }
}

main();