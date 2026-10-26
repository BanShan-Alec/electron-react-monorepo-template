---
title: 编译配置继承（Tsconfig）
description: "`@app/tsconfig` 提供 base/node/react 三档，各包 tsconfig 只剩 extends 与 include。"
---

# 编译配置继承（Tsconfig）

> **TL;DR**：`@app/tsconfig` 提供 base/node/react 三档，各包 tsconfig 只剩 extends 与 include

## 要解决的坑

- 五六个包各配各的 TypeScript，`strict` 开关和路径别名改一处漏四处；typescript、vite 这类公共依赖在每个包里各写一个版本号，升一次级要全局搜索替换

## 本仓库的解法

### 3. @app/tsconfig 继承包：编译配置一处定义

→ 源码：[packages/tsconfig/package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/tsconfig/package.json)

```json
{
  "name": "@app/tsconfig",
  "private": true,
  "files": ["base.json", "node.json", "react.json"]
}
```

tsconfig 本身也被做成一个 workspace 包，三个 JSON 就是三档配置：

→ 源码：[packages/tsconfig/base.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/tsconfig/base.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "isolatedModules": true,
    "moduleResolution": "Bundler",
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

`base.json` 管全局共识（`strict`、路径别名），`node.json` 和 `react.json` 各自 extends 它、只补运行时差异——Node 侧加 `types: ["node", "vite/client"]`，React 侧降 target 到 ES2023、开 DOM lib 和 `jsx: react-jsx`。各包的 tsconfig 不再抄配置，extends 之外只剩 `include` 范围和少量自身差异：

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

main、preload、pr-review 用 `node.json`，renderer 用 `react.json`，shared 和根目录用 `base.json`。差异全部收敛在 `include` 与个别 `compilerOptions` 上（如 renderer 的 `verbatimModuleSyntax`、main 的 `noEmit`）——preload 和 shared 干脆只剩 extends 加 include，`strict` 与 `paths` 没有一个包自己重复声明。`paths` 别名指向各包的 **源码** 目录（`../main/src/*`）而不是 dist，跨包跳转和类型检查都读最新代码，改了 shared 立刻在所有引用方生效。

## 怎么抄

1. **tsconfig 包**：建 `@app/tsconfig`，base/node/react 三档，`paths` 别名指向各包 `src`；所有包 tsconfig 只剩一行 `extends`
