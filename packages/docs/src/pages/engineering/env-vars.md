# 环境变量管理（dotenv）

## 要解决的坑

- 环境变量散落在各包的 `.env` 和 `process.env` 直读里：构建脚本各自推导根目录、`.env` 的值反向覆盖命令行注入，渲染进程则压根拿不到运行时配置

## 本仓库的解法

### 4. 环境变量单链路注入

环境变量最大的坑不是没值，而是「值从哪来」说不清：命令行注入的 MODE 被 `.env` 反向覆盖、构建脚本各自推导根目录、渲染进程跟进程环境变量彻底绝缘。这套解法把整条链路收成一条单向管道：

```
根 .env ──loadRepoEnv──> process.env ──白名单 define──> 主进程 getEnv()
    ──packRuntimeEnv──> --app-meta= 启动参数 ──> preload 解包 ──> window.__APP_ENV__ ──> 渲染层
```

**第一环：根 `.env` 单一加载入口。** 全仓构建脚本、Vite 配置、Sentry 配置只允许经 `build/lib/env.ts` 加载根 `.env`：

→ 源码：[build/lib/env.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/env.ts)

```ts
export function applyRepoEnv(env: RepoEnv): void {
  for (const [key, value] of Object.entries(env.values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
```

关键在「只补空位，不覆盖」：cross-env 注入的 `MODE` 和 CI Secrets 永远优先于 `.env`，优先级固定为「外部注入 > 根 .env > 默认值」。根目录由 `findRepoRoot` 向上定位（同时存在 `package.json` 与 `pnpm-workspace.yaml` 的目录），与调用方工作目录无关。

**第二环：白名单编译期快照。** 主进程 Vite 构建时只挑出允许暴露的 key 注入常量：

→ 源码：[packages/main/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/vite.config.ts)

```ts
// 严格白名单过滤：仅暴露业务需要的默认配置，杜绝全量泄露风险
const ALLOWED_ENV_KEYS = [
  'API_BASE_URL',
  'SYSTEM_CODE',
  'DISTRIBUTION_CHANNEL',
  'SENTRY_DSN',
] as const;
```

运行时读取统一走 `packages/main/src/env.ts` 的 `getEnv()`：带前缀的进程环境变量（如 `APP_API_BASE_URL`）优先，其次显式 fallback，最后才是编译期快照 `__ENV_DEFAULTS__`。`.env.example` 里定义的 `ENV_PREFIX=APP_` 让外部部署可以用带前缀变量动态覆盖任意配置。

**第三环：跨进程注入。** 渲染进程读不到 `process.env`，主进程就把快照压缩、异或掩码、Base64URL 编码后塞进窗口启动参数：

→ 源码：[packages/main/src/modules/window/index.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/index.module.ts)

```ts
additionalArguments: [getPackedEnvArgument()],
```

→ 源码：[packages/preload/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/src/index.ts)

```ts
// 运行时环境基座同步挂载：在页面执行任何脚本前从 argv 快速解包并深度冻结暴露
const metaArg = process.argv.find((arg) => arg.startsWith(APP_ENV_ARG_PREFIX));
// ...解包 runtimeEnv
contextBridge.exposeInMainWorld('__APP_ENV__', Object.freeze(runtimeEnv ?? {}));
```

preload 在页面任何脚本执行前解包完成，`Object.freeze` 保证只读；渲染层类型由 shared 统一声明：

→ 源码：[packages/renderer/src/env.d.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/env.d.ts)

```ts
declare global {
  /** Preload 通过 additionalArguments 同步解包注入的全局只读运行时环境基座 */
  const __APP_ENV__: AppRuntimeEnv;
}
```

渲染层任何地方直接读 `window.__APP_ENV__.mode`、`window.__APP_ENV__.apiBaseUrl`，有完整类型提示，不需要异步请求、不存在时序竞争。掩码混淆（XOR + Base64URL）只是防止启动参数被顺手窥探，不是加密——`AppRuntimeEnv` 里本来就不该放机密，Secret 类配置走 CI 注入与打包期插件，不进这条链路。

## 怎么抄

1. **环境链路**：根 `.env` 单一加载入口（只补空位不覆盖）→ 主进程白名单 define → 快照打包进窗口启动参数 → preload 冻结暴露 `__APP_ENV__`；小项目可先砍掉跨进程段，保留前两环

注意点：

- 新增一个环境变量要动五处手写代码：`.env.example` 声明 → 主进程 `vite.config.ts` 的 `ALLOWED_ENV_KEYS` → shared 的 `AppRuntimeEnv` 类型 → 主进程 `getRuntimeEnvSnapshot()` 组装快照 → `env-packer.ts` 的 pack/unpack 元组（两处必须同序）；渲染层类型随 shared 自动跟随，无需动手。漏了 `getRuntimeEnvSnapshot` 会在类型检查报缺属性（返回值标注了 `AppRuntimeEnv`），漏了 pack/unpack 任何一边类型系统兜不住，运行时解包直接错位
- 环境变量链路只传非机密配置；Secret 类（签名证书、auth token）走 CI Secrets 与打包期插件，永远不进启动参数
