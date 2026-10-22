# 项目配置项与配置方式

当前工程的配置已经按「一层一个 owner」收拢，不再是到处散落。下面按**生效链路 → 速查表 → 配置分层 → 各层怎么配 → 踩坑**来讲。

---

## 一、配置生效链路（先看这个）

**开发态 `pnpm start`**
`cross-env MODE=development` → [build/env.ts](../build/env.ts) 读 `.env`（外部优先）→ [scripts/dev.ts](../scripts/dev.ts) 按 `config` 起 Vite dev server（端口 / CDP / inspect）→ 构建 preload/main → 主进程启动 → preload 注入 `window.__APP_ENV__` → 渲染进程消费。

**打包 `pnpm build:app`**
默认 production → `verify:prebuild`（名称/根依赖）→ 构建全包 → electron-builder 用 `package.json` 身份与 `repository.url` 打包 → `verify:postbuild`（asar 阈值 + 真机冒烟）→ 生成 `app-update.yml` 供 OTA。

**测试**
`pnpm test` 走 `.config/vitest.config.ts`（别名从 `packages/tsconfig/base.json` 派生）；`pnpm test:e2e` 走 `.config/playwright.config.ts`，直接拉起 Electron，不经过 dev server。

**已打包运行**
身份与发布源在构建期固化；`app-update.yml` 由 electron-builder 生成；用户偏好由 `ConfigStore` 写入 `userData`。

---

## 二、常见改动速查

| 想改什么 | 改哪里 | 怎么生效 |
| :--- | :--- | :--- |
| 应用显示名 | 根 `package.json` `productName` | 重新构建 |
| App ID / 仓库 | `appId` / `repository.url` | 重新打包 |
| API 地址 | `.env` `API_BASE_URL` 或运行时 `APP_API_BASE_URL` | 构建 / 重启 |
| Sentry | `.env` DSN，CI 配 `SENTRY_AUTH_TOKEN` | 打包生效 |
| asar 阈值 | `.env` `MAX_ASAR_SIZE_MB` | 下次打包 |
| 主进程新依赖 | `pnpm --filter @app/main add` | external 自动跟随 |
| 外链白名单 | `shared/constants/security.ts` | 重建 main |
| 打包平台/图标 | `build/electron-builder.ts`、`build/resources/` | 重新打包 |
| Vite dev server 端口 | `scripts/dev.ts` 的 `config.rendererPort` | 重启 `pnpm start` |
| CDP 端口 | `scripts/dev.ts` 的 `config.rendererCdpPort`（注释即关闭） | 重启 |
| 主进程 inspect 端口 | `scripts/dev.ts` 的 `config.mainInspectPort`（默认注释） | 重启 |
| 开发/生产构建模式 | `package.json` scripts 的 `MODE` | 重启 / 重新构建 |
| E2E 超时与并发 | `.config/playwright.config.ts` | 下次运行 e2e |
| CI 必过检查 | GitHub 分支保护 + `.github/CICD.md` | 仓库设置 |

---

## 三、配置分层总览

| 层 | 位置 | 管什么 | 生效时机 |
| :--- | :--- | :--- | :--- |
| 应用身份 / OTA 坐标 | 根 `package.json` | 应用名、appId、版本、GitHub 仓库 | 构建期 + 打包期 |
| 构建期基础设施 | `build/*.ts` | 环境加载、路径、external、Sentry、打包 | 构建期 |
| 环境差异 | `.env` / shell / CI | DSN、发布通道、API 地址、阈值 | 构建期内联 + 运行时覆盖 |
| 开发态编排 | [scripts/dev.ts](../scripts/dev.ts) 的 `config` | dev server 端口、CDP/inspect 开关、watch 与重启 | `pnpm start` / `start:dist` |
| 工具链 | `.config/`、各 `vite.config.ts`、`tsconfig`、Lingui、workflows | Lint/测试/编译/CI | 工具运行时 |
| 运行时常量 | `shared/constants`、`main/src/constants` | 窗口几何、启动时值、超时、日志策略 | 编译进产物 |
| 用户偏好 | `userData/app-config.json` | 主题、语言、托盘、自动更新 | 运行时持久化 |

原则：**一个值只有一个 owner**。工具自己的 schema 文件（electron-builder / Vite / Playwright / Biome）保留原位，只把「值」抽出来共享。

---

## 四、应用身份与 OTA 坐标（根 `package.json`）

由 [app-identity.ts](../build/app-identity.ts) 统一解析，构建器、主进程、渲染进程都从这里取。

| 字段 | 作用 | 改动影响 |
| :--- | :--- | :--- |
| `name` | 产物文件名、OTA 资产名 | 必须全小写中划线，`verify:prebuild` 会拦 |
| `productName` | 窗口标题、托盘、快捷方式、Header | 还决定 `userData` / 日志目录名，改了会“搬家” |
| `appId` | Windows AUMID、macOS Bundle ID | 发布后不要随便改，影响通知归属与安装身份 |
| `version` | 安装包版本、Sentry release | 走 `changelogen` 发版流程 |
| `repository.url` | OTA 发布源（owner/repo） | 自动解析，不再支持 `.env` 覆盖 |

**怎么配**：直接改根 `package.json` → `pnpm build:app`。开发态窗口标题也会跟着变（标题由 renderer 构建期注入 `productName`）。

---

## 五、环境变量（`.env` / shell / CI）

### 加载链路

1. `pnpm start` / `build:app` 先经 [env.ts](../build/env.ts) 的 `loadRepoEnv()` 读根 `.env`。
2. 外部注入（shell / CI / cross-env）**优先于** `.env`，由 `applyRepoEnv()` 补入，不会反向覆盖。
3. 主进程构建时把白名单键内联成 `__ENV_DEFAULTS__`；preload 再经 `--app-meta` 注入 `window.__APP_ENV__` 给渲染进程。

### 当前 `.env` 里有什么

| 键 | 作用 | 说明 |
| :--- | :--- | :--- |
| `ENV_PREFIX` | 运行时覆盖前缀，默认 `APP_` | 外部覆盖要写 `APP_API_BASE_URL` 这种形式 |
| `DISTRIBUTION_CHANNEL` | OTA 通道（latest/beta） | 运行时可被 `APP_DISTRIBUTION_CHANNEL` 覆盖 |
| `SENTRY_DSN` | 崩溃上报 | 打包态才启用 |
| `SENTRY_ORG` / `SENTRY_PROJECT` | 构建期 SourceMap 上传 | 仅在 CI 提供 `SENTRY_AUTH_TOKEN` 时实际使用 |
| `API_BASE_URL` / `SYSTEM_CODE` | 模板扩展点 | 目前只注入 `window.__APP_ENV__`，没有业务请求层消费 |
| `MAX_ASAR_SIZE_MB` | 打包后 asar 体积门禁，默认 10 | 当前产物约 2.91 MB |
| `VITE_CONFIG_NATIVE_IGNORE_WARNING` | 关掉 Vite config loader 警告 | 由 Vite 自己读取，不是死键 |

**只在 shell / CI 用的键**（不要写进 `.env`）：`MODE`、`DIST_DIR`、`BENCHMARK`、`DEMO_MODE`、`DEFAULT_BRANCH`、`DISPLAY`。

**CI Secrets**（GitHub 仓库设置里配）：`SENTRY_AUTH_TOKEN`、`OCR_LLM_*`、`GH_TOKEN/GITHUB_TOKEN`、macOS/Windows 签名变量。注意 `.env` 目前是**故意入库**的（你的决定），所以不要往里面加新 secret。

### 新增一个环境变量的三条路径

1. **只给主进程运行时用**：`.env.example` 加键 → `packages/main/src/env.d.ts` 的 `EnvKey` 加键 → `packages/main/vite.config.ts` 的 `ALLOWED_ENV_KEYS` 加键 → 代码里 `getEnv('XXX')`。
2. **只给构建期用**：加到 `.env`，通过 `build/env.ts` 的 `getRepoEnvValue()` 读，不碰主进程类型。
3. **要给渲染进程用**：扩展 `shared/types/env.ts` 的 `AppRuntimeEnv` + `env-packer` → 主进程 `getRuntimeEnvSnapshot()` 加字段 → 渲染进程读 `window.__APP_ENV__`。

优先级始终是：`APP_XXX`（外部注入） > `.env` 的 `XXX`（构建期内联） > 代码 fallback。

---

## 六、构建期配置（`build/`）

| 文件 | 管什么 | 怎么改 |
| :--- | :--- | :--- |
| [app-identity.ts](../build/app-identity.ts) | 身份/版本/repo 解析 | 一般不用动，改根 `package.json` |
| [env.ts](../build/env.ts) | 唯一 env 加载器 | 无需逐文件改 |
| [repo-paths.ts](../build/repo-paths.ts) | 仓库根、dist 目录 | `DIST_DIR` 可覆盖 dist |
| [main-externals.ts](../build/main-externals.ts) | 主进程 external | **不用手改**：`pnpm --filter @app/main add` 后自动外置；装成 `-D` 则自动内联 |
| [sentry-config.ts](../build/sentry-config.ts) | release 名 `${name}@${version}`、DSN | 改命名模板在这里 |
| [vite-lib.ts](../build/vite-lib.ts) | main/preload 公共构建默认值 | sourcemap/minify/outDir 在这里 |
| [tsconfig-paths.ts](../build/tsconfig-paths.ts) | Vitest alias | 真源是 `packages/tsconfig/base.json` |
| [electron-builder.ts](../build/electron-builder.ts) | 安装包目标、图标、artifactName、NSIS | 平台/产物策略在这里 |

当前打包目标：Windows `nsis x64`、macOS `dmg + zip`、Linux `deb`；图标在 `build/resources/`；产物命名 `${name}-${version}-${os}-${arch}.${ext}`。

---

## 七、开发态配置

开发编排全部在 [scripts/dev.ts](../scripts/dev.ts)，核心是一个可注释的 `config` 对象：

| 配置项 | 默认值 | 作用 |
| :--- | :--- | :--- |
| `rendererPort` | `5173` | Vite renderer dev server 端口；`strictPort` 下被占用会交给 port-guard 处理 |
| `rendererCdpPort` | `9222` | 传给 Electron 的 `--remote-debugging-port`，供外部 CDP 客户端连接 |
| `mainInspectPort` | 默认注释关闭（示例 `9229`） | 主进程 `--inspect-brk` 断点端口；注释掉即关闭 |

相关行为：

- **MODE**：`pnpm start` 注入 `development`，`pnpm start:dist` 注入 `production`；`scripts/dev.ts` 的 Vite build mode 跟随 `MODE`。
- **端口占用**：启动前 `ensurePortsAvailable` 逐个探测；交互环境提示是否结束占用进程，非交互环境直接失败，不会静默复用旧实例。
- **VITE_DEV_SERVER_URL**：renderer server listen 后写回 `process.env`；主进程仅在 `MODE=development` 时加载 dev server。`start:dist` 仍会启动 dev server，但主进程按 production 行为加载 renderer dist。
- **监听构建**：preload / main 以 watch 模式构建；main 重建后重启 Electron，preload 重建触发渲染进程全量刷新。
- **Vite server**：`strictPort`、`host: true`、HMR overlay 关闭；端口值由上面的 `config` 注入。
- **调试开关**：`mainInspectPort`、`rendererCdpPort` 注释掉即关闭对应能力，启动日志与命令行参数会一起跳过。

---

## 八、运行时常量

运行时常量直接编译进产物，按归属分三层；**具体有哪些参数、取值多少属于业务范畴，会随产品迭代变化，本文不枚举，以源码为准**。

1. **跨端共享层**（`packages/shared/src/constants/`）：需要被多个进程或 E2E 共同引用的值与契约。新增跨端值时放这里，禁止在其它包复制同一数值。
2. **主进程专属层**（`packages/main/src/constants/`）：只有主进程消费的实现参数，不进入跨端契约。
3. **用户级运行配置**（`ConfigStore`）：通过设置页 / IPC 修改、持久化在 `userData` 的用户偏好，不需要重新构建。

修改方式：

- 前两层改完必须重建对应包；shared 变更会经依赖传递，建议 `pnpm build` 或至少重建 main / renderer。
- 第三层运行时生效，无需重建；注意 `userData` 目录名由 `productName` 派生。

---

## 九、工具链配置

| 载体 | 管什么 | 备注 |
| :--- | :--- | :--- |
| `.config/biome.json` | 格式化 + Lint | 行宽 100、禁桶文件 |
| `.config/vitest.config.ts` | 单测/基准 | alias 自动从 tsconfig 派生 |
| `.config/playwright.config.ts` | E2E | 超时 45s、单 worker |
| `.config/commitlint.config.ts` / `changelog.config.ts` | 提交规范 / 发版分类 | |
| `packages/tsconfig/base.json` | 路径别名唯一真源 | `@app/*`、`@shared/*`、`@/*` |
| 各包 `vite.config.ts` | 入口、插件、构建目标 | main/preload 共用 `vite-lib.ts` |
| `packages/renderer/lingui.config.ts` | 语言目录与 catalog | **语言列表仍是这里独立一份**，新增语言要同时改它和 `preferences.ts` |
| `.github/workflows/*` | CI/发布 | Node 24、分支 main、required checks 4 个 |
| `pnpm-workspace.yaml` / catalog | 依赖版本收敛 | |

---

## 十、几个容易踩的点

1. **`.env` 是构建期默认值**，不是运行时读取文件；运行时想覆盖必须用 `APP_<KEY>`。
2. **渲染进程不读 `.env`**：Vite 只暴露 `VITE_` 前缀，本项目统一走 `window.__APP_ENV__`。
3. **`MODE` ≠ `app.isPackaged`**：前者是开发/生产行为语义，后者是物理打包态；`start:dist` 是「未打包但生产行为」。
4. **运行时常量是编译期的**：改了 shared/main constants 必须重建对应包，`pnpm start` 下的热更新不会自动带上主进程常量。
5. **`.env` 已入库**：新增 secret 不要写进去，放 GitHub Secrets。
6. **改 `productName` 会迁移用户数据目录**（`userData`、日志、`app-config.json`、`window-state.json`），发版前要想清楚。
7. **新增语言**目前要动三处：`preferences.ts`、`lingui.config.ts`、`src/locales/<locale>/messages.po`。
8. **工具 schema 文件不要合并**：electron-builder / Vite / Playwright / Biome 的文件位置是工具强制的，能抽的是值，不是文件。
