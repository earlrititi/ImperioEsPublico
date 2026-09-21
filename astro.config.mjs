// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

const base = process.env.GITHUB_PAGES === 'true' ? '/Imperio_web' : '/';

// https://astro.build/config
export default defineConfig({
  base,
  output: 'server',
  redirects: {
    '/mentidero': '/foro'
  },
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  },

  adapter: vercel()
});
