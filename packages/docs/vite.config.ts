import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { vocs } from 'vocs/vite';

// 与 vocs CLI 内部等价：CLI 只是把 react() + vocs() 塞进 configFile:false 的 Vite 实例。
// 改走 vite CLI 后 react 插件要自己带（CLI 会自动加，vite 不会）。
export default defineConfig({
  plugins: [react(), vocs()],
  // 静态产物由 waku 写到 dist/public（GitHub Pages 工作流上传的就是它）；
  // vocs CLI 也是把 vite 的 outDir 设成 'dist'，显式写死防止默认值变化。
  build: { outDir: 'dist' },
});
