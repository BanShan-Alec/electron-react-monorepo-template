import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: true,
    sourcemap: process.env.MODE === 'development' ? 'inline' : 'hidden',
    minify: process.env.MODE === 'development' ? false : 'oxc',
    outDir: 'dist',
    assetsDir: '.',
    target: 'node22',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rolldownOptions: {
      external: ['electron', 'electron-updater', 'electron-log'],
      output: {
        entryFileNames: '[name].cjs',
        format: 'cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  ssr: {
    noExternal: ['zod'],
  },
});
