# 原生 C++ 模块接入与打包指南（以 USB 为例）

> 本文系统梳理在本项目中引入、编译、开发与打包原生 Node.js C++ 插件（Native Addons / Prebuilds，例如 `usb`, `serialport`, `better-sqlite3`）的工业级标准流程与陷阱防范。

---

## 1. 原生依赖接入铁律与架构边界

在 Electron 多包 Monorepo 体系中，原生模块的引入受到构建工具与分发架构的双重制约：

```mermaid
flowchart TD
    subgraph Root["根目录 (Root)"]
        RootPkg["package.json<br>dependencies: 仅限 @app/main"]
    end

    subgraph MainPkg["packages/main (主进程)"]
        MainDeps["package.json<br>dependencies: 声明原生库 (例如 usb)"]
        ViteConfig["vite.config.ts<br>rolldownOptions.external: ['usb']"]
    end

    subgraph CI["自动化门禁"]
        VerifyScript["pnpm run verify:deps<br>(scripts/verify-deps.ts 严格校验)"]
    end

    MainDeps -.->|必须对齐| ViteConfig
    RootPkg -.->|依赖穿透保护| CI
    ViteConfig -.->|对齐校验| CI
```

### 1.1 核心规则
1. **安装归属**：原生模块必须作为 `packages/main` 的生产依赖（`dependencies`），严禁装在 `devDependencies` 或根目录 `dependencies`。
2. **构建排除**：由于原生模块包含平台相关的动态链接库（`.node` 文件），Rolldown / Vite 打包时无法也不应将其打包进 JS Bundle。必须在 `packages/main/vite.config.ts` 的 `rolldownOptions.external` 中明确列出。
3. **依赖门禁校验**：运行 `pnpm run verify:deps`。此脚本会自动双向比对 `packages/main/package.json` 中的 `dependencies` 与 `vite.config.ts` 中的 `external` 列表，存在任一缺失即判定失败。

---

## 2. 端到端接入全流程（以 `node-usb` 为例）

### 步骤 1：安装原生模块
在项目主进程包中安装：
```bash
pnpm --filter @app/main add usb
```

### 步骤 2：配置 Vite External 排除
编辑 `packages/main/vite.config.ts`：
```ts
export default defineConfig({
  build: {
    rolldownOptions: {
      external: [
        'electron',
        'electron-log',
        'electron-updater',
        '@sentry/electron',
        'usb', // 👈 声明为外部依赖
      ],
    },
  },
});
```

### 步骤 3：验证依赖对齐
在根目录运行门禁检查：
```bash
pnpm run verify:deps
```
若检查通过，输出为：
```text
[verify-deps] dependencies vs external check passed (strict sync)!
```

### 步骤 4：主进程安全封装 (Service & Controller)
原生模块常有底层系统异常，严禁在渲染端直接暴露，必须在服务层进行防腐与序列化处理：

1. **`UsbService`**：
   调用 `usb.getDeviceList()`，捕获系统级错误，提取设备描述符字段（`vendorId`, `productId`, `deviceDescriptor` 等），映射为纯 JS 结构。
2. **`UsbController`**：
   负责入参合法性检验与生命周期捕获，将执行结果包装为 `Result<UsbDeviceItem[]>` 返回。

### 步骤 5：Preload 桥接与渲染层呈现
在 `@app/preload` 通过 `contextBridge` 注入通道，由前端统一经由 `window.electronApi.usb.getDeviceList()` 调用，并在 React 中结合 Hook 进行渲染。

---

## 3. 生产打包与 asar 解包机制

在打包发布（`pnpm run build`）阶段，`electron-builder` 会将主进程 JS 代码打包进 `app.asar` 虚拟文件系统中。

> [!WARNING]
> Node.js 底层无法直接 `dlopen` 位于虚拟 `.asar` 内部的二进制 `.node` 文件！

为了让打包后的原生模块在用户的 Windows / macOS / Linux 机器上正常执行：

1. **自动解包规则**：
   `electron-builder` 内部已内置原生模块识别器。当检测到 `node_modules` 中包含 `.node` 模块时，会自动将其解压至 `app.asar.unpacked/` 目录；
2. **显式配置（如有特殊需求）**：
   若原生模块依赖未被识别的外部第三方 `.dll` 或 `.dylib`，需在打包配置或构建脚本中显式配置 `asarUnpack`：
   ```json
   "asarUnpack": [
     "**/node_modules/usb/**/*"
   ]
   ```

---

## 4. 常见问题排查与速查表

| 症状 / 报错现象 | 根本原因 | 解决方案 |
| :--- | :--- | :--- |
| **`Error: Cannot find module 'usb'`** (开发态) | Vite 误将 `usb` 尝试打包导致 resolve 失败 | 检查 `packages/main/vite.config.ts` 中的 `external` 列表是否添加 `'usb'`。 |
| **`NODE_MODULE_VERSION mismatch`** | 本地 Node.js 的 ABI 版本与 Electron 运行时的 ABI 版本不一致 | 运行 `pnpm rebuild` 或重新安装依赖，触发 Electron 目标版本的头文件重新编译。 |
| **`verify-deps failed`** | `packages/main/package.json` 中的依赖与 `vite.config.ts` 的 `external` 列表不一致 | 补全配置，确保生产依赖与 external 集合完全相同。 |
| **打包后找不到 `.node` 动态库** | 动态库被误锁在 asar 归档内 | 确认原生依赖位于 `packages/main/node_modules`，并核实 `app.asar.unpacked` 是否存在对应文件。 |
