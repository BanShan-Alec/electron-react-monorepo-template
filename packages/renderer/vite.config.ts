import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import tailwindConfig from './tailwind.config.ts';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  // 路径别名单一事实源：根 tsconfig.json + Vite 官方原生 tsconfigPaths（零插件）
  tsconfig: '../../tsconfig.json',
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // port 从 scripts/dev.ts 的 RENDERER_PORT 常量注入
    strictPort: true,
    host: true,
  },
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
});
