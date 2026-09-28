import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: true,
    sourcemap: 'inline',
    outDir: 'dist',
    target: 'chrome130',
    assetsDir: '.',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rolldownOptions: {
      external: ['electron'],
      output: {
        entryFileNames: 'index.cjs',
        format: 'cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  ssr: {
    noExternal: true,
  },
});
