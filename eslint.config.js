import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Configuration pour les variables non utilisées
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      // Règle pour encourager l'utilisation du fuseau horaire Europe/Paris
      'no-restricted-syntax': [
        'warn',
        {
          selector: "NewExpression[callee.name='Date']:not([arguments.length=0])",
          message: "Attention: new Date() utilise maintenant automatiquement le fuseau horaire Europe/Paris. Pour les cas spéciaux, utilisez les fonctions de timezoneUtils.ts"
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='parse']",
          message: "Date.parse() peut donner des résultats incohérents. Utilisez parseParisDate() de timezoneUtils.ts pour garantir le fuseau horaire Europe/Paris"
        }
      ],
      // Règles pour détecter l'utilisation de méthodes locales
      'no-restricted-properties': [
        'error',
        {
          object: 'Date.prototype',
          property: 'toLocaleDateString',
          message: 'Utilisez formatParisDate() ou formatDateAs() pour garantir le fuseau horaire Europe/Paris'
        },
        {
          object: 'Date.prototype',
          property: 'toLocaleTimeString',
          message: 'Utilisez formatParisDate() pour garantir le fuseau horaire Europe/Paris'
        },
        {
          object: 'Date.prototype',
          property: 'toLocaleString',
          message: 'Utilisez formatParisDate() pour garantir le fuseau horaire Europe/Paris'
        },
        {
          property: 'toLocaleDateString',
          message: 'Utilisez formatParisDate() ou formatDateAs() pour garantir le fuseau horaire Europe/Paris'
        },
        {
          property: 'toLocaleTimeString',
          message: 'Utilisez formatParisDate() pour garantir le fuseau horaire Europe/Paris'
        },
        {
          property: 'toLocaleString',
          message: 'Utilisez formatParisDate() pour garantir le fuseau horaire Europe/Paris'
        },
        {
          property: 'setHours',
          message: 'Utilisez startOfDayParis() ou endOfDayParis() pour garantir le fuseau horaire Europe/Paris'
        },
        {
          property: 'setMinutes',
          message: 'Attention: cette méthode modifie la date en utilisant le fuseau horaire local'
        },
        {
          property: 'setSeconds',
          message: 'Attention: cette méthode modifie la date en utilisant le fuseau horaire local'
        },
        {
          property: 'getHours',
          message: 'Attention: cette méthode retourne l\'heure dans le fuseau horaire local. Utilisez formatParisDate() pour obtenir l\'heure Paris'
        },
        {
          property: 'getMinutes',
          message: 'Attention: cette méthode retourne les minutes dans le fuseau horaire local'
        }
      ],
    },
  }
);
