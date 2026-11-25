---

title: 配置持久化（Electron-store）
description: 运行期偏好落盘至 userData，Zod Schema 强校验、坏文件自愈与跨窗口广播。
---

# 配置持久化（Electron-store）

> **TL;DR**：用户运行时偏好（主题、语言、关闭行为、自动更新等）持久化至 `userData/config.json`；依托 Zod Schema 整体校验与默认值派生，遭遇非法 JSON 或破损字段时自动覆盖自愈，配置变更通过 IPC 广播全量窗口。

## 1. 选型理由

桌面客户端的本地配置文件（如 JSON）是不可信输入：
1. **人为或断电损坏**：用户可能手动编辑导致 JSON 语法错误，或者断电导致写入半截文件。若直接读取，应用将在启动期抛出未捕获异常并直接白屏崩溃。
2. **跨版本字段漂移**：升级新版本后新增了必填字段，旧版本的配置文件缺失该键，导致运行时类型报错。

工程通过 Zod 强类型 Schema 定义结合加载期双重自愈机制，确保配置链路坚不可摧。

## 2. 核心机制

### 单一真源 Schema 与默认值派生

→ 源码：[packages/shared/src/schemas/config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/config.ts)

```ts
export const configSchema = z.object({
  theme: z.enum(THEME_MODES).default(DEFAULT_THEME_MODE),
  minimizeToTray: z.boolean().default(true),
  closeBehaviorConfirmed: z.boolean().default(false),
  language: z.enum(LANGUAGE_MODES).default(DEFAULT_LANGUAGE),
  autoCheckUpdate: z.boolean().default(true),
  serverCounter: z.number().int().default(0),
  autoLaunch: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof configSchema>;
export const updateConfigInputSchema = configSchema.partial();
export const DEFAULT_CONFIG: AppConfig = configSchema.parse({});
```

每个字段均附带 `.default()`，默认值由 Schema 自动派生，全仓杜绝手写字面量。

### 加载期自愈策略（语法损坏覆盖 + 校验失败重置）

→ 源码：[packages/main/src/modules/config.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/config.module.ts)

1. **第一道防线（语法损坏）**：`electron-store` 构造期直接读取，若 JSON 损坏抛错，立即用 `DEFAULT_CONFIG` 覆盖写入坏文件并重试；若目录不可写则降级为纯内存模式。
2. **第二道防线（字段校验）**：文件可解析但字段不合规时，`configSchema.safeParse` 失败立即记录错误日志，并将整对象重置为默认值落盘：

```ts
private loadConfig(): AppConfig {
  if (!this.store) return { ...DEFAULT_CONFIG };
  const parsed = configSchema.safeParse(this.store.store);
  if (parsed.success) return parsed.data;

  // 校验失败即自愈：记录 issues 并整对象覆盖坏文件
  this.logError('Config reset to defaults: on-disk config failed schema validation:', parsed.error.issues);
  try {
    this.store.store = { ...DEFAULT_CONFIG };
  } catch (error) {
    this.logWarn('Config write failed:', error);
  }
  return { ...DEFAULT_CONFIG };
}
```

配置变更由 `ConfigService` 统一分发，触发原生副作用（如主题切换、托盘多语言重绘）并通过 `broadcast(IPC_CHANNELS.CONFIG_EVENT_CHANGED, updated)` 实时通知全部渲染窗口。

### 开机自启只开放给安装版副本

→ 源码：[packages/main/src/services/auto-launch.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/auto-launch.service.ts)

Windows 的登录启动项按 AppUserModelId（AUMID）落到 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`，而仓库的安装版与免安装副本共享同一个 AUMID 与 `userData`。若允许免安装副本写启动项，它会直接覆盖安装版的那一条，造成「开机拉起的是 `dist/win-unpacked` 里的联调副本，桌面快捷方式启动的安装版抢不到单实例锁而闪退」。因此 `AutoLaunchService` 在写系统启动项前先判定副本资格：

```ts
const BUILD_REPO_ROOT = typeof __BUILD_REPO_ROOT__ !== 'undefined' ? __BUILD_REPO_ROOT__ : '';

export function isInstalledCopy(): boolean {
  if (!isPackaged) return false;
  if (!BUILD_REPO_ROOT) return true;

  const exePath = path.resolve(process.execPath);
  const relative = path.relative(path.resolve(BUILD_REPO_ROOT), exePath);
  return relative.startsWith('..') || path.isAbsolute(relative);
}
```

判定看的是**构建期注入的仓库根路径**：可执行文件是否落在构建它的仓库目录内。`pnpm build:unpack` 的产物与 `pnpm build:win` 遗留的 `dist/win-unpacked` 都在仓库内，一律拒绝；装到 `Program Files` / `Applications` / `/opt` 的副本在仓库外，正常放行。

这样不扫盘（不依赖卸载器文件名是否被清理工具删掉）、不读注册表，且与构建目标无关——`--skip-build` 也不会出现「风味串味」。注入只发生在主进程 bundle：`packages/main/vite.config.ts` 的 `define` 写入 `__BUILD_REPO_ROOT__`，渲染层拿不到该常量（仓库路径不向前端暴露）。常量缺失（如早期产物、打包配置出错）时按安装版放行，并由 `AutoLaunchService` 输出一次 warn，避免无法判定时集体禁用自启，同时保留可诊断性。

不支持时 `getAutoLaunchStatus()` 返回 `isSupported: false` 并带上 `unsupportedReason`，共三种：`platform`（平台无登录项 API）、`source-run`（dev / preview 源码运行，未打包）与 `unpacked-copy`（解包目录里的就地副本）。`setAutoLaunch()` 降级为空操作且不抛错，设置页按原因给出对应文案。

## 3. 桌面端避坑注意事项

- **Service 内持有 Store 严禁在构造函数立即求值**：
  - 业务 Service（如 `CounterService`）若需读写配置，必须在具体方法调用时懒加载 `getAppConfigStore()`，切勿在模块顶层 `new Service()` 构造期直接读取，避免与主进程模块初始化时序冲突。
- **写入路径采用“整对象替换”清理死键**：
  - 写入配置时使用 `this.store.store = this.config` 进行整对象赋值，可顺带清理掉磁盘上旧版本遗留的无用垃圾字段，保持 `config.json` 干净。
- **构建期配置与运行期偏好严格分离**：
  - `userData/config.json` 仅承载用户运行期偏好，构建配置（tsconfig、Biome、Vite）属于静态资产，绝对不进用户存储目录。
- **开机自启不可交给免安装副本管理**：
  - 免安装副本与安装版共用 AUMID 与 `userData`，写入系统启动项会覆盖安装版，使开机拉起联调副本、安装版又因单实例锁抢不到而闪退。写入前必须经 `isInstalledCopy()` 判定，联调期如需验证自启行为，请装一个真实安装包再操作。
