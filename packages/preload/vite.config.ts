import { defineConfig } from 'vite';
import { createNodeLibBuildOptions } from '../../build/vite-lib';

export default defineConfig({
  build: createNodeLibBuildOptions({
    target: 'chrome130',
    external: ['electron'],
    entryFileNames: 'index.cjs',
  }),
  ssr: {
    noExternal: true,
  },
});
