const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    ssr: true,
    sourcemap: process.env.MODE === 'development' ? 'inline' : 'hidden',
    minify: process.env.MODE === 'development' ? false : 'oxc',
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
