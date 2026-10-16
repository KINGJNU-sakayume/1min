/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 저장소 이름이 `1min`이라 GitHub Pages 경로는 /1min/
export default defineConfig({
  base: '/1min/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        spike: resolve(import.meta.dirname, 'spike.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
