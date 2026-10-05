# 壳资产源码外置、构建期内联与工具链时代规则

Status: accepted（2026-10-05）

首屏加载规范（[spec](../../specs/first-screen-loading.md)）v1 把就绪协调器与 Logo 全部手写内联在 `index.html`，产物形态完全正确，但源码层有三笔债：协调器是约 50 行裸 JS（无类型检查、无法 import shared 常量，与 `StartupReadyNotifier` 存在"两端字符串耦合"）；Logo 以内联 SVG 硬编码（换素材要动 HTML）；HTML 里散落 biome 抑制注释与机制解释注释。v2 裁决：**协调器与 Logo 源码外置（`src/startup/coordinator.ts`、`src/assets/startup-logo.svg`——Header 同款蓝底白雷电），由手写 Vite 插件在 `transformIndexHtml` 时编译/读取并内联；构建产物形态与 v1 逐字节等价（经典内联 `<script>` + 内联 SVG）**。

裁决的锚点是产物红线而非源码形态：D3/§6.1 要求的是**产物**零打包依赖（协调器 IIFE 自包含、先于 main.tsx、经典脚本防 Vite 抽取），源码维护在哪里不改变该约束。dev 与 build 走同一插件同一替换——已核实 Vite 8.3 dev 的 indexHtmlMiddleware 对真实磁盘入口必过 `transformIndexHtml`（[spec §10.5](../../specs/first-screen-loading.md)），无需 configureServer 中间件。

**工具链时代规则（本 ADR 随附成文）**：构建期转换一律使用 Vite 8 / Rolldown / Oxc 原生能力，禁止引入 esbuild、babel 等旧工具链依赖。选型实证：`transformWithOxc` 仅单文件转译、不打包 import（无法吸收 shared 常量）；Vite 8 不 re-export rolldown 本体；定选程序化 `build()`（`configFile:false` + `write:false` + `format:'iife'`）内存打包，零新增依赖。存量 `@rolldown/plugin-babel`（lingui）为既有用途不扩用。

## Considered Options

- **A. 维持全手写内联**：零构建机器，但源码债持续累积，shared 常量无法复用，两端耦合靠注释纪律维持——否决；
- **B. 协调器改外链 module script**：dev 省事，但产物被 Vite 抽进主 bundle，直接违反 D3（本规范 §10.3 实测结论）——否决；
- **C. 源码外置 + 手写 transformIndexHtml 插件内联（选定）**：产物形态不变、源码可维护可类型检查、shared 契约可复用；成本是 ~60 行插件与一次内存打包（按 mtime 缓存）；
- **D. 第三方内联插件（vite-plugin-svg 等）**：dev 行为参差、离线装包有 lockfile 漂移风险、逻辑太薄不值得引依赖——否决。

## Consequences

- renderer 新增 `plugins/` 目录归口专属构建期插件（`plugins/startup-shell.ts`，文件名不带 npm 发布包的 `vite-plugin-` 前缀）；`build/` 保持 electron-builder 打包配置与原生资源的单一语义。后续若出现第二个包的 vite 插件消费者，再按规则二上提共享；
- 协调器源码允许 import `@app/shared/constants/*` 纯常量，严禁打包产物/组件/样式——import 面红线由评审与 spec §4.3 参考实现把守，插件 fail-fast 仅兜占位符契约与打包成功（缺失/失败即终止构建）；
- `noImportantStyles` 抑制从 HTML 内联注释移至 `.config/biome.json` 文件级 override，HTML 源码不再承载工具注释；
- 未来给壳加资产（新 Logo、新引导脚本）的路径：改源文件或加占位符 + 插件分支，HTML 结构不再膨胀。
