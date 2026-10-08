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
    // Vite SSR 默认将所有 node_modules 外置为 require("xxx")。
    // zod 为 devDependencies 纯编译工具，在此强制内联打包进 index.cjs，
    // 避免因 electron-builder 忽略 devDep 导致运行时报 MODULE_NOT_FOUND 崩溃。
    noExternal: ['zod'],
  },
});
