# 源码映射隔离（SourceMap）

> **TL;DR**：生产构建用 `hidden` 模式生成 `.map`，Sentry 上传后删除本地文件，asar 再排除映射与类型声明

## 要解决的坑

- SourceMap 生成容易处理难：不上传就没法定位线上错误堆栈，忘排除就直接把源码发进用户安装包

## SourceMap 多重处理，源码不进安装包

→ 源码：[packages/main/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/vite.config.ts) · [packages/renderer/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/vite.config.ts)

生产环境报错要能定位堆栈，但 `.map` 文件一旦进安装包等于把源码发给用户。这条链路用三道防线同时满足两头。

第一道：构建产物用 `hidden` 模式——生成 `.map`，但不在 JS 产物末尾写 `sourceMappingURL` 注释：

```ts
// packages/main/vite.config.ts（preload 同款）
sourcemap: isDev ? 'inline' : 'hidden',

// packages/renderer/vite.config.ts
sourcemap: 'hidden',
```

renderer 配置的注释把这层意图写得很直白：仅生成 `.map` 供 Sentry 插件上传，不暴露给运行时。

第二道：Sentry Vite 插件把 `.map` 上传到错误监控平台后立即删除本地文件：

```ts
sentryVitePlugin({
  // ...
  sourcemaps: {
    filesToDeleteAfterUpload: ['dist/**/*.map'],
  },
}),
```

运行时错误上报到 Sentry 后用远端 SourceMap 反解，用户侧不持有任何映射。未配置 `authToken` 时插件自动 `disable`，此时靠第三道兜底。

第三道：electron-builder 打包规则显式排除所有映射与类型声明：

```ts
files: [
  // ...
  '!**/*.map', // 严禁将 SourceMap 源码映射文件打包进 asar，彻底防止源码泄露
  '!**/node_modules/**/*.d.ts',
  '!**/node_modules/**/*.d.cts',
  '!**/node_modules/**/*.d.mts',
],
```

类型声明虽不含实现，但暴露接口结构，一并排除。三道防线层层兜底，任何一道失效都不至于让源码进安装包。

## 怎么抄

- **SourceMap**：生产 `hidden` 模式 + 监控平台上传后删除 + asar 排除，三道防线都上
