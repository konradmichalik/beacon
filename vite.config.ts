import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.description || 'Beacon'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __DEMO_MODE__: JSON.stringify(!!process.env.BEACON_DEMO)
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
