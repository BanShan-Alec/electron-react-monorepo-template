---

title: 编译配置继承（Tsconfig）
description: "@app/tsconfig 提供 base/node/react 三档模板，根 tsconfig 通过 Project References 串联全仓类型检查。"
---

# 编译配置继承（Tsconfig）

> **TL;DR**：全仓通过 `@app/tsconfig` 私有包集中维护 `base.json`、`node.json`、`react.json` 三档基座，根 `tsconfig.json` 以 `references` 串联 9 个工程配置，路径别名统一指向源码 `src/*` 并被 Vite / Vitest 原生复用。

## 1. 边界与继承矩阵

本页负责 `@app/tsconfig` 三档配置继承关系、根 Project References 编排与跨包源码别名真源规范。本页不负责 Biome 代码风格与导入排序（见 [代码规范与风格](/engineering/code-style)），也不负责渲染进程 Node 能力的运行时沙箱隔离实现（见 [渲染进程沙箱](/security/sandbox)）。

根 `tsconfig.json` 配置 `"files": []` 与 `references` 数组驱动全仓增量校验，其机制与 `tsc -b` 行为可参考 [TypeScript Project References 官方文档](https://www.typescriptlang.org/docs/handbook/project-references.html)。

| 继承基座                       | 核心增量选项                                                       | 实际消费工程（`extends`）                                 |
| :----------------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------- |
| **`@app/tsconfig/base.json`**  | `strict`、`isolatedModules`、`Bundler` 解析、全仓 `paths` 源码别名 | 根 `tsconfig.json`、`shared`、`scripts`、`build`、`e2e`   |
| **`@app/tsconfig/node.json`**  | 继承 `base.json`，追加 `"types": ["node", "vite/client"]`          | `packages/main`、`packages/preload`、`packages/pr-review` |
| **`@app/tsconfig/react.json`** | 继承 `base.json`，启用 `react-jsx`、`DOM` lib、`noUnusedLocals`    | `packages/renderer`、`packages/docs`                      |

> 注：`scripts`、`build`、`e2e` 直接继承 `base.json` 并按各自运行环境显式声明 `"types": ["node"]`（而非继承带 `vite/client` 的 `node.json`）；`packages/shared` 保持无平台全局类型，确保主进程与渲染层同构。

## 2. 核心配置清单

### 基础配置与跨包路径别名（单一真源）

→ 源码：[packages/tsconfig/base.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/tsconfig/base.json)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "ignoreDeprecations": "6.0",
    "paths": {
      "@app/main/*": ["../main/src/*"],
      "@app/preload/*": ["../preload/src/*"],
      "@app/renderer/*": ["../renderer/src/*"],
      "@app/shared/*": ["../shared/src/*"],
      "@shared/*": ["../shared/src/*"],
      "@/*": ["../renderer/src/*"]
    }
  }
}
```

### 根 Project References 与子包极简配置

根 `tsconfig.json` 汇总全部 9 个工程子配置，`pnpm typecheck` 通过 `tsc -b --noEmit` 一次性扫描全仓：

→ 源码：[tsconfig.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/tsconfig.json)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@app/tsconfig/base.json",
  "files": [],
  "references": [
    { "path": "./packages/main" },
    { "path": "./packages/preload" },
    { "path": "./packages/renderer" },
    { "path": "./packages/shared" },
    { "path": "./packages/pr-review" },
    { "path": "./packages/docs" },
    { "path": "./scripts" },
    { "path": "./build" },
    { "path": "./e2e" }
  ]
}
```

业务子包仅声明继承档位、局部编译差异（如 `noEmit`）与扫描范围：

→ 源码：[packages/main/tsconfig.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/tsconfig.json)

```json
{
  "extends": "@app/tsconfig/node.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*", "tests/**/*", "vite.config.ts"]
}
```

## 3. 校验判据与桌面端避坑清单

- **可执行校验判据**：新增或修改任意 `tsconfig.json` 后，在根目录执行 `pnpm typecheck`（即 `tsc -b --noEmit`），命令退出码为 `0` 且无类型错误；新增独立子包或顶层 TS 目录时，必须在根 `tsconfig.json` 的 `references` 登记，否则会被全局门禁漏检。
- **单包增量字段边界**：`packages/renderer` 与 `packages/docs` 在继承 `react.json` 基础上额外启用了 `verbatimModuleSyntax`、`erasableSyntaxOnly` 与 `noUncheckedSideEffectImports`，确保类型导入必须使用 `import type` 且避免依赖运行时枚举发射。
- **子包与脚本类型隔离**：`packages/pr-review` 继承 `node.json` 并开启 `composite: true`（`ES2022`），而 `scripts/`、`build/`、`e2e/` 直接继承 `base.json` 并按需补充 `node` / `DOM` 类型，避免把 Vite 客户端全局类型带入非 Vite 脚本。
- **别名直指源码且 Vite 原生同源**：`paths` 统一映射至 `../<pkg>/src/*` 而非 `dist/`，修改 `@app/shared` 后类型变更实时跨包生效；[packages/renderer/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/vite.config.ts) 与 [.config/vitest.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/vitest.config.ts) 已通过原生 `resolve: { tsconfigPaths: true }` 直接读取根 `tsconfig.json`，切勿再手工维护第二份 Vite `resolve.alias`。
- **渲染层 Node 类型传递边界**：`packages/renderer/tsconfig.json` 虽以 `types: ["vite/client"]` 限制全局类型，但 `vite.config.ts` 与 `src` 同属一个 TS program，Node 类型仍可能经 `vite` 传递进来；渲染层源码严禁 `import 'node:fs'` 或访问 `process`、`__dirname`。
