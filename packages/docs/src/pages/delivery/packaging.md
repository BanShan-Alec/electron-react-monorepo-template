# 应用打包（electron-builder）

> **TL;DR**：electron-builder 用 TypeScript 写配置，应用身份收敛到根 `package.json`，三平台 target 由同一 CLI 入口分发

## 要解决的坑

- 打包配置写死在 JSON 里：appId、产物名、发布坐标散落多处，改个应用名要跨文件对齐；产物命名不规范这类问题，直到 GitHub Release 寻址 404 才暴露
- 依赖收进 asar 全靠默认行为：渲染层依赖混进主进程包、node_modules 里的 README/测试/类型声明全进安装包，体积悄悄膨胀没人发现

## 动态打包：TypeScript 配置 + 按平台出包

→ 源码：[build/electron-builder.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/electron-builder.ts)

electron-builder 支持直接用 TypeScript 写配置，于是打包规则也能类型检查、能复用逻辑：

```ts
const config: Configuration = {
  // ...（directories / publish / generateUpdatesFilesForAllChannels /
  //      nsis / extraResources / 三平台 icon 等键见源文件）
  appId: APP_IDENTITY.appId,
  productName: APP_IDENTITY.productName,
  win: { target: [{ target: 'nsis', arch: ['x64'] }] },
  mac: { target: ['dmg', 'zip'] },
  linux: { target: ['deb'] },
  // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder placeholder template
  artifactName: '${name}-${version}-${os}-${arch}.${ext}',
  asarUnpack: ['**/*.node'],
  files: [
    'LICENSE*',
    '!node_modules/@app/**',
    ...getListOfFilesFromEachWorkspace(['main', 'preload', 'renderer']),
    '!**/*.map', // 严禁将 SourceMap 源码映射文件打包进 asar，彻底防止源码泄露
    // ...（node_modules 冗余文件排除规则见源文件）
  ],
};
```

`appId` / `productName` 不写死在打包配置里，而是收敛到应用身份单一事实源：

→ 源码：[build/lib/app-identity.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/app-identity.ts)

```ts
export const APP_IDENTITY: AppIdentity = {
  name: rootPkg.name || 'electron-app',
  version: rootPkg.version || '1.0.0',
  productName: rootPkg.productName || rootPkg.name || 'Electron React Template',
  appId: rootPkg.appId || `com.template.${rootPkg.name || 'electron-app'}`,
  repositoryOwner: owner || '',
  repositoryName: repo || '',
};
```

它静态导入根目录 `package.json`，并从 `repository.url` 解析出 OTA 发布源坐标——`.env` 不参与身份与仓库坐标，应用身份跟随代码仓库而非部署环境。打包配置、主进程编译期注入、渲染层窗口标题三处消费同一份数据。

产物命名用 `${name}`（package.json 的小写 name）而非 `${productName}`：`artifactName` 上方的注释写明，GitHub Releases 上传时空格会被自动转成点号，导致 `latest.yml` 校验与下载 404。这是打包配置里少有的「写错当时不出错、发版才炸」的点。

workspace 产物精确放行，不整包塞：

```ts
allFilesToInclude.push({
  from: `packages/${dirName}`,
  to: `node_modules/${name}`,
  filter: [...workspacePkg.files, '!**/*.map'],
});
```

`getListOfFilesFromEachWorkspace` 逐个读子包 `package.json` 的 `files` 字段生成规则——「哪些文件需要进 asar」由子包自己声明，构建配置不硬编码文件清单。

三平台不重复维护：[scripts/build.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/build.ts) 用 `parseArgs` 接 `--dir` / `--win` / `--mac` / `--linux` / `--x64` / `--arm64`，一处分发成 electron-builder 选项。本地 `pnpm build:win` 与 CI 的 `pnpm run build:win -- -p never` 走同一入口，不存在「本地一套命令、CI 一套命令」。

## 怎么抄

- **打包**：electron-builder 换 TS 配置；应用身份（appId / productName / repository.url）收敛进根 `package.json`，构建与运行时都从这一份解析；三平台 target 用 CLI 参数切换，本地与 CI 走同一入口

注意点：

- 根 `package.json` 的 `name` 是产物寻址根：只用小写字母、数字、中划线、下划线，空格 / 大写 / 点号会让 `latest.yml` 与安装包下载 404（verify-prebuild 第 1 条门禁盯的就是它）
- 根 `dependencies` 只允许 `@app/main`；新增运行时依赖需人工确认是否加进主进程 external 显式清单（`packages/main/vite.config.ts` 的 `rolldownOptions.external`：electron / usb / electron-updater）——verify-prebuild 注释明确原「dependencies 与 external 双向对齐」门禁已删除，这一步没有自动化兜底
