---
title: 依赖管理（Monorepo）
description: pnpm workspace + catalog 收拢公共工具链版本，根目录依赖白名单由 CI 门禁守住，Node 与 pnpm 版本一并钉死。
---

# 依赖管理（Monorepo）

> **TL;DR**：pnpm workspace + catalog 收拢公共工具链版本，根目录依赖白名单由 CI 门禁守住，Node 与 pnpm 版本一并钉死

## 要解决的坑

一个 Electron + React 的 monorepo 长大之后，工程层面的问题会集中爆发：

- 五六个包各配各的 TypeScript，`strict` 开关和路径别名改一处漏四处；typescript、vite 这类公共依赖在每个包里各写一个版本号，升一次级要全局搜索替换
- 根目录 `package.json` 是最方便塞依赖的地方，随手一装，electron-builder 打包时整棵依赖树被卷进 `app.asar`，体积悄悄翻倍

## 本仓库的解法

### pnpm workspace 多包隔离 + catalog 统一版本

→ 源码：[pnpm-workspace.yaml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/pnpm-workspace.yaml)

```yaml
packages:
  - 'packages/*'

catalog:
  typescript: ^6.0.0
  vite: ^8.0.0
  zod: ^4.5.4
  '@types/node': ^24.19.2
  vitest: ^5.0.3
```

所有业务包收进 `packages/*`，公共工具链版本在 `catalog:` 一处声明，各包引用时只写协议名不写版本号：

→ 源码：[packages/main/package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/package.json)

```json
"devDependencies": {
  "typescript": "catalog:",
  "vite": "catalog:",
  "vitest": "catalog:",
  "zod": "catalog:"
  // ...另有 @app/preload、@app/shared 等 workspace 依赖与 Sentry、electron-log 等条目从略
}
```

升级 TypeScript 就是改 `pnpm-workspace.yaml` 一行，所有引用它的包同时生效，不存在「A 包 5.x、B 包 6.x」的版本漂移。隔离布局与安装策略同样收在 `pnpm-workspace.yaml`——pnpm 12 起 `.npmrc` 只读 registry 与 auth，其余设置一律走 workspace 文件：

→ 源码：[pnpm-workspace.yaml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/pnpm-workspace.yaml)

```yaml
nodeLinker: isolated
autoInstallPeers: true
publicHoistPattern:
  - '@node-usb/*'
  - '*usb*'

minimumReleaseAge: 1440

allowBuilds:
  '@sentry/cli': true
  'electron-winstaller': true
  esbuild: true
  es5-ext: true
  vue-demi: true
```

`nodeLinker: isolated` 让没写进 `package.json` 的「幻影依赖」在编译期就报错，唯一的例外是原生二进制包（`usb` 系）按模式提升，保证 `.node` 文件能被 electron-builder 收集到。版本锁定还有一层：根 `package.json` 的 `"packageManager": "pnpm@12.15.0"` 与 `engines` 字段（`node >= 24`、`pnpm ^12`）把「用哪个包管理器、哪个 Node」也固化下来。

### 根目录依赖白名单 + CI 门禁

→ 源码：[package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json)

```json
"dependencies": {
  "@app/main": "workspace:*"
}
```

根 `package.json` 的 `dependencies` 只允许一个包——负责装配的主进程包。electron、electron-builder、biome 这些工具链全部放 `devDependencies`，因为 electron-builder 收集生产依赖时只看 `dependencies`，根目录塞得越少，`app.asar` 越干净。

光有约定不够，门禁脚本在打包前静态拦截：

→ 源码：[scripts/verify-prebuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-prebuild.ts)

```ts
// 2. 根目录 package.json dependencies 边界校验（防退化门禁）
const rootDeps = Object.keys(rootPkg.dependencies || {});
const allowedRootDeps = ['@app/main'];

const illegalRootDeps = rootDeps.filter((dep) => !allowedRootDeps.includes(dep));
```

违规依赖直接让构建失败退出（`process.exit(1)`），错误信息里写清楚「应该挪到 devDependencies」。这个脚本挂在 CI 的 lint job 里，PR 阶段就拦下：

→ 源码：[.github/workflows/ci.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/workflows/ci.yml)

```yaml
lint:
  # ...name / runs-on / timeout-minutes 从略
  steps:
    # ...checkout 与 setup-env 两步从略
    - run: pnpm run lint
    - run: pnpm run verify:prebuild
```

依赖治理还有第三道闸——pnpm 的安装脚本审批。pnpm 12 的 `strictDepBuilds` 默认开启：没列入 `allowBuilds` 却带构建脚本的依赖会直接让安装失败（`ERR_PNPM_IGNORED_BUILDS`），而不是静默跳过——本仓库被「electron 二进制静默缺失」坑过，快速失败正是要的状态。审批清单住在 `pnpm-workspace.yaml`（见上文），新依赖撞错时用 `pnpm ignored-builds` 列出全部待审批包、`pnpm approve-builds <包名>` 逐个审批，决策落回 `allowBuilds`——供应链面上多了一层「知情同意」。

第四道闸管一个审批管不了的例外：electron 42+ 起 npm 包不带 install 生命周期脚本（二进制惰性下载），全新工作区装完不带 dist，`require('electron')` 直接报错——`allowBuilds` 对它无效，因为根本没有脚本可审批。根 `package.json` 的 postinstall 守卫每次安装后按 `dist/version` 判定，缺失或版本不符时补跑 install.js（命中机器级 zip 缓存约 2 秒）；CI 里由 e2e job 显式执行、守卫跳过：

→ 源码：[scripts/ensure-electron.mjs](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/ensure-electron.mjs)

### Node 版本与包管理器锁定

catalog 管的是依赖版本，Node 与 pnpm 本身的版本另有一套钉子。本地 Node 大版本写在 `.nvmrc`，只有一行：

→ 源码：[.nvmrc](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.nvmrc)

```text
24
```

根 `package.json` 再把范围与包管理器版本写进元数据，`packageManager` 精确到小版本：

→ 源码：[package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json)

```json
  "packageManager": "pnpm@12.15.0",
  "main": "node_modules/@app/main/dist/index.cjs",
  "engines": {
    "node": ">=24.0.0",
    "pnpm": "^12.0.0"
  },
```

`engines` 只声明支持范围（`node >= 24.0.0`、`pnpm ^12.0.0`），真正决定装哪个 pnpm 的是 `packageManager`。CI 里没有单独的 pnpm 安装步骤：composite action 先用 `actions/setup-node@v4` 装 Node 24，再 `corepack enable`，之后 `pnpm` 命令由 corepack 按 `packageManager` 字段拉起对应版本；装依赖固定走 `--frozen-lockfile`，`pnpm-lock.yaml` 与 `package.json` 对不上就直接失败，CI 不会顺手改写锁文件。`COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'` 关掉 corepack 首次下载 pnpm 时的交互确认：

→ 源码：[.github/actions/setup-env/action.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/actions/setup-env/action.yml)

```yaml
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '24'

    # pnpm 版本由根 package.json 的 packageManager 字段决定,Node 24 自带 corepack
    - name: Enable corepack
      run: corepack enable
      shell: bash

    - name: Install Dependencies
      run: pnpm install --frozen-lockfile
      shell: bash
      env:
        COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'
```

`.npmrc` 现在只剩 `registry=https://registry.npmmirror.com` 一行固定下载源，隔离布局与审批清单都已迁去 `pnpm-workspace.yaml`。Node 大版本、pnpm 精确版本、下载源都落在仓库里，换机器或换 CI runner 不会装出另一套工具链。

## 怎么抄

1. **workspace 骨架**：`pnpm-workspace.yaml` 收包、把 typescript/vite 等公共版本放进 `catalog:`，各包一律 `"catalog:"` 引用；隔离布局（`nodeLinker`）与提升模式（`publicHoistPattern`）也写在同一文件，`.npmrc` 只留 registry
2. **依赖白名单**：根 `dependencies` 只留装配包，写 `verify-prebuild` 脚本校验，挂进 CI 的 lint job；`allowBuilds` 按需放行安装脚本，撞 `ERR_PNPM_IGNORED_BUILDS` 时用 `pnpm approve-builds` 审批；electron 二进制用 postinstall 守卫兜底

注意点：

- 第三方运行时依赖只进子包的 `dependencies`（如 `packages/main` 的 `electron-updater`），根目录出现第二个 `dependencies` 条目就是门禁失败
- 公共工具链（`typescript`、`vite`、`zod`、`@types/node`、`vitest`）的版本只出现在 `pnpm-workspace.yaml` 的 `catalog:`，包内一律 `"catalog:"` 引用；业务依赖版本声明在各自的包里（如 `packages/main` 的 `electron-updater`、`usb`），同一依赖被多个包共用时应升入 catalog，避免两包各钉一个版本
