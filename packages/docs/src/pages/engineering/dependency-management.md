---

title: 依赖管理（Monorepo）
description: pnpm workspace + catalog 收拢版本，确立根目录 dependencies 仅限 @app/main 的单一门禁真源与主进程外置派生规则。
---

# 依赖管理（Monorepo）

> **TL;DR**：公共依赖在 `pnpm-workspace.yaml` 的 `catalog:` 集中定版；根目录 `dependencies` 硬性限定仅允许 `@app/main`（门禁唯一归属本页）；主进程 `vite.config.ts` 自动把 `packages/main/package.json` 的 `dependencies` 派生为 `external`，无需手改配置。

## 1. 边界与依赖归属原则

本页负责 Monorepo 依赖分层归属、`pnpm-workspace.yaml` 版本与供应链策略，以及「根目录依赖白名单门禁」的单一真源规范。本页不负责环境变量管理（见 [环境变量管理](/engineering/env-vars)）、ASAR 物理体积预算与打包产物扫描（见 [分包与体积门禁](/security/bundle-budget)）、Electron Fuses 与打包配置（见 [应用打包](/delivery/packaging)），也不负责 CI 多路调度（见 [CI 并行门禁](/delivery/ci-gates)）。

- **根目录（`package.json`）**：`dependencies` 只允许 `@app/main`；跨包工程工具与全局构建脚本依赖放 `devDependencies`。
- **主进程纯 JS 工具库（如 `electron-log`、`electron-store`、`zod`）**：装入 `packages/main` 的 `devDependencies`（`pnpm --filter @app/main add -D <pkg>`），由 `ssr.noExternal: true` 直接内联进 `dist/index.cjs`。
- **主进程运行时外部依赖 / 原生模块（如 `usb`、`electron-updater`）**：装入 `packages/main` 的 `dependencies`（`pnpm --filter @app/main add <pkg>`）。
- **渲染层前端库**：装入 `packages/renderer`（`pnpm --filter @app/renderer add <pkg>`），由 Vite 独立打包。

想系统理解 `catalog:` 协议如何在安装期锁版并在发布期还原真实版本区间，可参考 [pnpm Catalogs 官方文档](https://pnpm.io/catalogs)。

## 2. 核心机制与唯一门禁

### Workspace 版本收拢与供应链防护

`pnpm-workspace.yaml` 统一管理 `catalog:` 版本字典、`isolated` 严格隔离模式、`publicHoistPattern` 原生模块提升，以及 `minimumReleaseAge: 1440`（禁止安装发布未满 24 小时的包）与 `allowBuilds` 构建脚本白名单：

→ 源码：[pnpm-workspace.yaml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/pnpm-workspace.yaml)

```yaml
# 节选：workspace 范围、catalog 与供应链策略
packages:
  - "packages/*"

catalog:
  typescript: ^6.0.0
  vite: ^8.3.5
  zod: ^4.5.4
  react: ^19.3.1
  vitest: ^5.1.0

nodeLinker: isolated
autoInstallPeers: true
publicHoistPattern:
  - "@node-usb/*"
  - "*usb*"
minimumReleaseAge: 1440
allowBuilds:
  "@sentry/cli": true
  "electron-winstaller": true
  esbuild: true
```

### 根目录依赖白名单门禁（单一真源）

为防止根目录被顺手塞入业务依赖导致 `electron-builder` 递归卷入 `app.asar`，`verifyPrebuild` 在校验失败时向 `errors` 数组推入违规项并返回 `{ valid, errors }`，由 CLI 入口与打包脚本 [scripts/build.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/build.ts) 据 `!valid` 执行 `process.exit(1)` 中断流程：

→ 源码：[scripts/verify-prebuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-prebuild.ts)

```ts
// 节选：verifyPrebuild() 中的根目录 dependencies 边界校验
const rootDeps = Object.keys(rootPkg.dependencies || {});
const allowedRootDeps = ['@app/main'];

const illegalRootDeps = rootDeps.filter((dep) => !allowedRootDeps.includes(dep));
if (illegalRootDeps.length > 0) {
  errors.push(
    `[根目录依赖违规] 根 package.json 的 dependencies 中检测到非法依赖: ${JSON.stringify(illegalRootDeps)}。\n` +
      `  -> 规范要求: 根目录 dependencies 严格仅允许 ['@app/main']，` +
      `任何其他子包（如 @app/renderer, @app/preload）或第三方依赖必须置于 devDependencies，` +
      `以防止 electron-builder 扫描依赖树时将非主进程模块卷入 app.asar 导致体积膨胀。`,
  );
}
// ...
return { valid, errors };
```

### 主进程 External 自动派生与二进制惰性安装

`packages/main/vite.config.ts` 在构建期直接读取 `packages/main/package.json` 的 `dependencies` 并拼接为 `rolldownOptions.external`（外加 `'electron'`），因此新增外部依赖无需手改 Vite 配置：

→ 源码：[packages/main/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/vite.config.ts)

```ts
// 节选：external 由 packages/main/package.json 自动派生
const pkgPath = path.resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const runtimeDependencies = Object.keys(pkg.dependencies ?? {});
// ...
rolldownOptions: {
  external: ['electron', ...runtimeDependencies],
```

自 Electron 42+ 起，npm 包移除自带安装脚本；根目录 [package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json) 通过 `postinstall` 脚本（`cross-env ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ install-electron`）在依赖安装后按需拉取 Electron 二进制。

## 3. 校验判据与桌面端避坑清单

- **门禁验证命令**：在仓库根目录执行 `pnpm verify:prebuild`，退出码为 `0` 且输出 `根目录 dependencies 边界校验通过` 即达标；若因 `allowBuilds` 阻断新依赖安装（`ERR_PNPM_IGNORED_BUILDS`），先运行 `pnpm ignored-builds` 审查再执行 `pnpm approve-builds <pkg>`。
- **切勿将 `ELECTRON_MIRROR` 写入 `.npmrc` 或全局环境变量**：`@electron/get` 会优先读取该变量，在打包 macOS DMG 时连带劫持 `dmgbuild` 等辅助工具下载地址导致 404 失败，镜像前缀仅限在 `postinstall` 单行注入。
- **Native 原生模块必须放行提升**：含 `.node` 动态库的包（如 `@node-usb/*`）除装在 `packages/main` 的 `dependencies` 外，还需在 `pnpm-workspace.yaml` 的 `publicHoistPattern` 放行，否则打包期无法正确解包拷贝。
