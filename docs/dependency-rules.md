# Monorepo 依赖拓扑与打包隔离规范

本文档定义了本项目在 pnpm Monorepo 架构下的依赖分类标准、主进程外置（External）对齐规则及自动化 CI 门禁机制。

---

## 一、架构背景与核心原则

### 1. 为什么需要严格的依赖边界？
在 Electron Monorepo 中，`electron-builder` 在打包时会从根目录 `package.json` 的 `dependencies` 出发，沿 Node.js 运行时依赖树向下递归收集。
- **历史问题**：若根目录声明了 `@app/renderer`，或者主进程将前端子包列为运行时依赖，`electron-builder` 会把渲染进程的所有依赖（包括前端开发工具、React、Antd 等 15,000+ 个散装文件，共计 60MB+）统统抓取并压入 `app.asar`，导致打包产物体积暴增近 30 倍。
- **核心原则**：
  1. **拓扑切断**：根目录仅将主进程（`@app/main`）视为唯一的运行时依赖，物理切断 Builder 自动探测前端包依赖的链路。
  2. **分包治之**：主进程严格按运行时真实需求管理依赖；渲染进程回归通用 Web 前端惯例；构建脚本通过精确的 `FileSet` 规则搬运静态产物。

---

## 二、各层级依赖分类标准

### 1. 根目录（Root `package.json`）
- **`dependencies`（必须且仅允许一项）**：
  ```json
  "dependencies": {
    "@app/main": "workspace:*"
  }
  ```
  > ⚠️ **红线禁令**：严禁在根目录 `dependencies` 中添加 `@app/renderer`、`@app/preload` 或任何第三方库。其余子包与公共构建工具必须统一置于 `devDependencies`。

### 2. 主进程（`packages/main/package.json`）
主进程是整个 Electron 应用在 Node.js 环境下的运行宿主。
- **`dependencies` 准入标准**：
  **仅限生产环境需要通过 Node.js 原生 `require()` / `import` 动态加载的第三方库**（如 `electron-log`, `electron-updater` 或含 C++ 原生 Addon 的模块）。
- **双向对齐铁律（CI 强校验）**：
  主进程声明的每一个生产依赖，**必须**在 `packages/main/vite.config.ts` 的 `rolldownOptions.external` 列表中显式配置排除；反之，在 `external` 中排除的非 Node 内置模块，**必须**在此处的 `dependencies` 中声明。
  ```ts
  // packages/main/vite.config.ts
  rolldownOptions: {
    external: ['electron', 'electron-updater', 'electron-log'],
  }
  ```

### 3. 渲染进程（`packages/renderer/package.json`）
遵循标准 Web 前端工程通用分类习惯，开发者无需受 Electron 内部打包机制干扰：
- **`dependencies`**：**代码会流向客户端浏览器 bundle 的业务运行时库**。
  - 例如：`react`, `react-dom`, `antd`, `@ant-design/icons`, `zustand`, `ahooks`, `@sentry/electron`, `clsx`, `@lingui/react` 等。
- **`devDependencies`**：**纯构建工具、编译插件与代码规范库**。
  - 例如：`vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`, `@types/*`, `@lingui/cli` 等。

> 💡 **原理说明**：由于根目录与主进程已切断了对 `@app/renderer` 的运行时依赖拓扑，`electron-builder` 在构建时完全不会扫描 Renderer 的 `dependencies`。Renderer 的产物通过 `build/electron-builder.ts` 中的 `FileSet` 映射规则只将 Vite 编译后的 `dist` 单向挂载至 `app.asar` 的 `node_modules/@app/renderer` 下，零依赖泄露。

### 4. 预加载脚本（`packages/preload/package.json`）
Preload 脚本由 Vite 经 `ssr: { noExternal: true }` 构建为单文件 `dist/index.cjs`。
- 其业务代码与引用的 `@app/shared` 均在构建期被完全内联，运行时无需外部 Node 模块。
- 遵循前端通用实践，内部工具和共享库统一归入 `devDependencies`。

---

## 三、深层原理：Vite SSR 与 electron-builder 的逻辑冲突与桥接

在理解这套规则时，很多开发者会疑惑：*为什么主进程既配了 `rolldownOptions.external`，又在 `ssr` 下配置了 `noExternal: ['zod', /^@sentry\/.*/]`？*

这源于 **Vite SSR（面向 Web 服务端）** 与 **electron-builder（面向离线桌面端）** 天生截然相反的打包心智模型：

| 构建工具 | 核心出发点与假设 | 默认行为 |
| :--- | :--- | :--- |
| **Vite SSR** | **面向 Web 服务器（Node.js 服务端）**<br>默认假设生产服务器部署时会 `npm install`，把第三方库打包进单文件是浪费时间。 | **默认将所有 node_modules 视为外部依赖**，直接生成 `require('xxx')`（除非显式指定 `noExternal`）。 |
| **electron-builder** | **面向离线桌面端（用户本地 PC）**<br>默认假设用户电脑没有 npm/Node 环境，生产运行所需的一切必须全部打包进安装包。 | **默认仅将 `dependencies` 打入 `app.asar`**，其余 `devDependencies` 彻底修剪剔除。 |

这两套工具如果不做精确调和，就会出现两大典型陷阱：

### 1. “互相踢皮球”陷阱（导致运行时启动崩溃）
以 **`zod` 与 `@sentry/electron`** 为例（声明在 `devDependencies`）：
- **Vite SSR** 以为生产环境有 node_modules，默认不打包它，编译为 `const { z } = require("zod")`；
- **electron-builder** 发现它们在 `devDependencies` 中，打包时直接将其丢弃，不拷贝进 `app.asar`；
- **后果**：两边都没包含代码！程序在用户机器启动时执行到 `require(...)`，瞬间抛出 `Cannot find module` 报错崩溃。
- **解法**：在 `vite.config.ts` 中配置 `ssr: { noExternal: ['zod', /^@sentry\/.*/] }`，强制命令 Vite 必须在编译期将其完整 JS 源码内联打包进 `dist/index.cjs` 并执行 Tree-shaking，既能避免运行时缺失，又能避免完整依赖包直接进入 asar 造成体积膨胀（保持在 ~2.54MB）。

### 2. “争先恐后”陷阱（导致 asar 体积暴增 30 倍）
以 **`antd`** 为例（误声明在根目录或主进程的 `dependencies` 树中）：
- **Vite Client** 作为前端打包器，已经将 Antd 代码编译压缩打入了 `dist/assets/main.js`；
- **electron-builder** 看到 `dependencies` 声明，又把 Antd 及其传递依赖的 **15,000+ 个未压缩源文件（67MB+）** 全量塞入 `app.asar`；
- **后果**：同一套库在安装包里出现了两份（一份静态 bundle，一份几万个散装文件的 node_modules），体积从 2MB 暴涨至 76MB。
- **解法**：根目录切断对 `@app/renderer` 的依赖链路，Builder 仅通过 `FileSet` 搬运静态编译结果。

---

## 四、开发者操作指南（FAQ）

### Q1：如何为主进程新增第三方依赖？
1. 在主进程安装依赖：
   ```bash
   pnpm --filter @app/main add <pkg-name>
   ```
2. **同步修改配置**：打开 `packages/main/vite.config.ts`，将 `<pkg-name>` 添加到 `rolldownOptions.external` 数组中。
3. 运行校验：
   ```bash
   pnpm run verify:deps
   ```
   若未配置 `external`，CI 与本地构建均会报错拦截。

### Q2：如何为主进程新增工具类库（希望直接打包进 index.cjs）？
若引入的是轻量纯 JS 工具库（如 `zod`, `semver` 等），希望其被 Vite 编译内联以减少运行时查找：
1. 安装为开发依赖：
   ```bash
   pnpm --filter @app/main add -D <pkg-name>
   ```
2. 无需在 `vite.config.ts` 的 `external` 中排除，Vite 会自动将其编译打入主进程 bundle。

### Q3：如何为渲染进程新增前端组件库或业务工具？
按常规前端 Web 开发习惯即可，无需任何额外配置：
```bash
# 业务代码使用的库
pnpm --filter @app/renderer add lodash-es dayjs

# 仅开发期使用的 Vite 插件或类型
pnpm --filter @app/renderer add -D vite-plugin-xxx @types/xxx
```

---

## 五、自动化 CI / 本地门禁机制

为了防止后续团队协作中规则退化，项目部署了全流程闭环门禁：

| 校验门禁 | 触发时机 | 校验命令 | 核心检测内容 |
| :--- | :--- | :--- | :--- |
| **依赖拓扑检查** | PR 提交 / 本地打包前 | `pnpm run verify:deps` | 1. 根目录 `dependencies` 严格等于 `['@app/main']`<br>2. 主进程 `dependencies` 与 Vite `external` 100% 双向对齐 |
| **asar 体积门禁** | 发版构建 / 打包测试 | `pnpm run test:dist` | 校验打包出的 `app.asar` 体积不得超过 10.00 MB（防范任何意外依赖泄露） |
| **运行时 Smoke 检查** | 发版构建 / 打包测试 | `pnpm run test:dist` | 真实启动解包二进制程序，验证窗口创建、React `#root` 挂载及无报错退出 |
