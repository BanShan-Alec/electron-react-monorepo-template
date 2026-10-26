# 路径稳健性（Relative-path）

> **TL;DR**：构建脚本与运行期资源都锚定模块自身位置，不依赖 `process.cwd()`。

## 要解决的坑

Electron 的默认配置是「能跑」，不是「防住」：

- 脚本从工作目录找文件，桌面快捷方式启动时 `process.cwd()` 偏移，资源全部 404

## 本仓库的解法

### 3. 路径稳健性：一切从模块自身定位

构建期与运行期的路径解析都不问「当前工作目录」，各自有稳定锚点。

**构建脚本取根**：从调用文件自己的位置向上找仓库根（同时存在 `package.json` 与 `pnpm-workspace.yaml` 的目录），找不到就抛错：

→ 源码：[build/lib/repo-paths.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/repo-paths.ts)

```ts
export function findRepoRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, 'package.json')) &&
      fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`[repo-paths] 无法从 ${fromDir} 向上定位仓库根目录`);
    }
    current = parent;
  }
}
```

打包校验脚本与 renderer 的 Vite 配置统一从这里取根（`verify-prebuild` 直接调 `findRepoRoot(__dirname)`；`build.ts` 与 `verify-postbuild` 经 `build/lib/env.ts` 的 `loadRepoEnv` 间接使用；`renderer/vite.config.ts` 用 `findRepoRoot(import.meta.dirname)`）；electron-builder 配置则用 `join(__dirname, '..')` 自行锚定——锚点不同，主旨一致：都锚定模块自身位置，都不碰 `process.cwd()`（`repo-paths.ts` 注释里写明这是仓库全局红线）。桌面快捷方式启动时工作目录不可预期，`__dirname` / `import.meta.dirname` 永远指向模块自己，所以永远不错位。

**运行期资源定位**：主进程入口用 `require.resolve` 沿 node_modules 依赖图找渲染产物与 preload，开发态才换成 dev server URL：

→ 源码：[packages/main/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/index.ts)

```ts
initApp({
  windows: {
    home: devServer
      ? new URL('src/entries/home/index.html', devServer)
      : { path: require.resolve('@app/renderer') },
    updater: devServer
      ? new URL('src/entries/updater/index.html', devServer)
      : { path: require.resolve('@app/renderer/updater') },
  },
  preload: {
    path: require.resolve('@app/preload'),
  },
  // 初始化失败只经 electron-log 记入 main.log，不弹窗不退出
}).catch((error) => {
  log.error('[initAppFailed]', error);
});
```

**运行期磁盘资源**：托盘图标这类打包后才存在的文件，用 Electron 提供的锚点（`process.resourcesPath`、`app.getAppPath()`）列出候选目录逐个探测，而不是拿 cwd 拼：

→ 源码：[packages/main/src/modules/tray.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/tray.module.ts)

```ts
if (process.resourcesPath) {
  baseDirs.push(path.join(process.resourcesPath, 'buildResources'));
}
if (app) {
  baseDirs.push(path.join(app.getAppPath(), 'build', 'resources'));
}
```

## 怎么抄

以新增构建脚本为例：

1. **路径只走稳定锚点**：构建脚本与配置从 `findRepoRoot(__dirname)` 取根；运行期资源用 `require.resolve` / `process.resourcesPath` / `app.getAppPath()` 定位

注意点：

- `process.cwd()` 红线目前靠约定执行（`repo-paths.ts` 注释与 AGENTS.md 全局红线），没有静态扫描门禁——code review 时要人工盯
