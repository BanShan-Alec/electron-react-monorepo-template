# Monorepo 模块化与运行时规范 (Module & Runtime Specification)

> 本文档规范了本工程在 TypeScript 模块系统、ESM 语法、Node.js 运行时边界以及各子包（main、preload、renderer、shared、pr-review 及 scripts）的编码规范与执行约束。

---

## 🎯 1. 核心设计原则

1. **全面现代化 ESM（彻底废弃 CommonJS）**：
   - 源码、构建配置与工程化脚本中**严禁手写 `require()` 与 `module.exports`**；
   - 一律使用标准的 ES 模块语法：`import ... from '...'`、`export ...`、`export default ...` 以及按需动态导入 `await import(...)`。
2. **`renderer` 纯净 Web 模式（100% 浏览器隔离）**：
   - 渲染进程面向现代浏览器环境运行，`packages/renderer/tsconfig.json` 中**禁止引入 `@types/node`**（`types: ["vite/client"]`）；
   - 构建配置（`vite.config.ts`、`tailwind.config.ts`）统一采用 Node 22+ 原生标准 **`import.meta.dirname`**，杜绝任何历史垫片（如 `createRequire` 或 `fileURLToPath`）。
3. **Node 端包保留 Node 全局符号**：
   - `packages/main`、`packages/preload` 与 `scripts/` 的模块解析基于 TypeScript 现代 **`moduleResolution: "Bundler"`** 与 Node 全局类型；
   - 允许直接消费 Node 原生全局符号（如 `__dirname`、`__filename`、`process`），无需多余垫片包装。
4. **统一脚本执行引擎（`tsx` 驱动）**：
   - 所有工程维护、验证、构建脚本统一由 **`tsx`** 驱动执行（如 `tsx scripts/dev.ts`、`tsx scripts/build.ts`、`tsx scripts/verify-deps.ts`），严禁使用散装原生 node 解释执行 TS 源码。

---

## 🏗️ 2. 子包运行时与模块规范矩阵

| 子包 / 目录 | 语法规范 | 路径解析标准 | 模块解析 (TS) | 运行时目标 |
| :--- | :--- | :--- | :--- | :--- |
| **`packages/renderer`** | **纯正 ESM** (`import`/`export`) | **`import.meta.dirname`** | `Bundler` (零 Node 全局符号) | Chromium 浏览器沙箱 |
| **`packages/main`** | **现代 ESM** (`import`/`export`) | **`__dirname`** (Node 全局符号) | `Bundler` + `types: ["node"]` | Node 22 (构建打包为 index.cjs) |
| **`packages/preload`** | **现代 ESM** (`import`/`export`) | **`__dirname`** (Node 全局符号) | `Bundler` + `types: ["node"]` | Electron contextBridge (打包为 index.cjs) |
| **`packages/shared`** | **纯净 ESM** (`import`/`export`) | 纯数据/无路径依赖 | `Bundler` (零 Node 依赖) | 跨进程纯契约 (Schema & Types) |
| **`packages/pr-review`**| **现代 ESM** (`import`/`export`) | **`__dirname`** (Node 全局符号) | `Bundler` + `types: ["node"]` | `tsx` 驱动的 CLI 工具套件 |
| **`scripts/*`** | **现代 ESM** (`import`/`export`) | **`__dirname`** (Node 全局符号) | `Bundler` + `types: ["node"]` | `tsx` 驱动的工程流水线 |

---

## 🚫 3. 代码禁令与反模式 (Anti-Patterns)

### ❌ 1. 严禁混用 CommonJS 模块语法
```ts
// ❌ 错误示范：严禁在任何 .ts 文件中使用 require 或 module.exports
const { execSync } = require('node:child_process');
const { defineConfig } = require('vite');
module.exports = defineConfig({ ... });

// ✅ 正确示范：统一使用顶层 ESM 导入与导出
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
export default defineConfig({ ... });
```

### ❌ 2. 严禁在渲染进程（Renderer）引入 Node 符号
```ts
// ❌ 错误示范：packages/renderer 源码中严禁使用 Node API
import fs from 'node:fs';
const dir = __dirname;

// ✅ 正确示范：渲染进程如需系统级能力，必须经由 preload 暴露的 window.api 契约调用
window.api.system.getPlatform();
```

### ❌ 3. 严禁使用 node 直接执行 TypeScript 脚本
```bash
# ❌ 错误示范：禁止散装原生 node 执行
node scripts/build.ts

# ✅ 正确示范：package.json 中统一映射为 tsx
tsx scripts/build.ts
```

---

## 💡 4. 常见场景实施指引

### Q1：在 Vite 配置文件中需要定位当前目录时应该怎么写？
- 如果在 **`packages/renderer/vite.config.ts`** 或 **`packages/renderer/tailwind.config.ts`**：  
  直接使用 Node 22 原生的标准属性：`import.meta.dirname`。
- 如果在 **`packages/main/vite.config.ts`** 或 **`scripts/`**：  
  直接使用原生的 `__dirname`。

### Q2：如何为主进程配置文件（如 `vite.config.ts`）引入外部模块？
直接在文件顶部使用 `import { ... } from '...'`。打包工具（Vite / Rolldown）与执行引擎（tsx）会自动完成 ESM/CJS 互操作分析，无需任何手动垫片。
