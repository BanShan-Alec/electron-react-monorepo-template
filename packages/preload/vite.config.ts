import path from 'node:path';
import { resolveModuleExportNames } from 'mlly';
import { defineConfig, type Plugin } from 'vite';

export default defineConfig({
  build: {
    ssr: true,
    sourcemap: 'inline',
    outDir: 'dist',
    target: 'chrome130',
    assetsDir: '.',
    lib: {
      entry: ['src/exposed.ts', 'virtual:browser.js'],
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron'],
      output: [
        {
          entryFileNames: '[name].js',
          format: 'cjs',
        },
      ],
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  ssr: {
    noExternal: true,
  },
  plugins: [mockExposed()],
});

/**
 * This plugin creates a browser (renderer) version of `preload` package.
 */
function mockExposed(): Plugin {
  const virtualModuleId = 'virtual:browser.js';
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  return {
    name: 'electron-main-exposer',
    resolveId(id) {
      if (id.endsWith(virtualModuleId)) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const entryPath =
          typeof __dirname !== 'undefined'
            ? path.resolve(__dirname, './src/index.ts')
            : path.resolve('packages/preload/src/index.ts');
        const exportedNames = await resolveModuleExportNames(entryPath);
        return exportedNames.reduce((s, key) => {
          return (
            s +
            (key === 'default'
              ? `export default globalThis['${btoa(key)}'];\n`
              : `export const ${key} = globalThis['${btoa(key)}'];\n`)
          );
        }, '');
      }
    },
  };
}
