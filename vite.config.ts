import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { qualificationSourcePlugin } from './build/qualificationSourcePlugin';
import { releaseIdentityPlugin } from './build/releaseIdentityPlugin';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [qualificationSourcePlugin(), releaseIdentityPlugin(), react(), tailwindcss()],
      test: {
        // Agent worktrees are checked out under .claude/worktrees/; never collect their copies of the suite.
        exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            // Split the three heaviest, mostly-independent third-party libraries into
            // their own chunks so a change to app code doesn't invalidate their cache,
            // and so the initial JS payload is smaller. See dist/ output sizes after
            // `npm run build` for the effect.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('node_modules/recharts')) return 'vendor-recharts';
              // d3 is a meta-package of many node_modules/d3-* submodules; topojson-client
              // (used by WorldMap alongside d3) travels with it.
              if (id.includes('node_modules/d3') || id.includes('node_modules/topojson')) return 'vendor-d3';
              if (id.includes('node_modules/mathjs')) return 'vendor-mathjs';
              return undefined;
            }
          }
        }
      }
    };
});
