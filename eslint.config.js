import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: 'readonly',
        __APP_NAME__: 'readonly',
        __BUILD_DATE__: 'readonly',
        __DEMO_MODE__: 'readonly'
      }
    },
    rules: {
      'svelte/require-each-key': 'warn',
      'svelte/prefer-svelte-reactivity': 'warn'
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser
      }
    }
  },
  {
    ignores: ['dist/', 'src-tauri/', 'node_modules/', '.svelte-kit/']
  }
);
