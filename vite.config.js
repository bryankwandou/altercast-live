import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        studio: resolve(__dirname, 'studio.html'),
        avatar: resolve(__dirname, 'avatar.html'),
        affiliateStudio: resolve(__dirname, 'affiliate-studio.html'),
        altercastLegacy: resolve(__dirname, 'AlterCast.html'),
      },
    },
  },
});
