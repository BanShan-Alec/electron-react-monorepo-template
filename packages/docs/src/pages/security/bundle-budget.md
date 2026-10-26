---
title: 分包与体积门禁（Chunk + Asar）
description: 第三方依赖按稳定性分块，打包前校验根依赖、打包后实测 asar 体积，超限即失败。
---

# 分包与体积门禁（Chunk + Asar）

> **TL;DR**：第三方依赖按稳定性分块，打包前校验根依赖、打包后实测 asar 体积，超限即失败。

## 要解决的坑

Electron 的默认配置是「能跑」，不是「防住」：

- 依赖树卷进安装包、分包配置悄悄退化，体积一路膨胀没人发现，直到发版

## 本仓库的解法

### 体积与加载管控：分包与 asar 硬门禁

体积劣化不需要等发布后才发现：分包从源头压体积，前置与后置门禁在打包链上一前一后实测拦截。

**渲染层分包**：第三方依赖按稳定性分块：

→ 源码：[packages/renderer/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/vite.config.ts)

```ts
build: {
  rollupOptions: {
    input: { /* home / updater 双入口 */ },
    output: {
      chunkFileNames: 'assets/[name]-[hash].js',
      manualChunks(id) {
        if (id.includes('node_modules')) {
          // 1. 最稳定核心运行时：React 系列
          if (id.includes('react') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          // 2. UI 框架：Ant Design 及其样式/图标/底层 RC 库
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) {
            return 'vendor-antd';
          }
        }
      },
    },
  },
},
```

**前置门禁**：打包前校验根 `package.json`，`dependencies` 只允许 `@app/main`——防止把整棵依赖树卷进 asar：

→ 源码：[scripts/verify-prebuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-prebuild.ts)

```ts
const rootDeps = Object.keys(rootPkg.dependencies || {});
const allowedRootDeps = ['@app/main'];

const illegalRootDeps = rootDeps.filter((dep) => !allowedRootDeps.includes(dep));
```

这一项也接在日常 CI 里（`.github/workflows/ci.yml` 的 lint 任务跑 `pnpm run verify:prebuild`）。

**后置硬门禁**：打包后解出 `app.asar` 实测体积，默认 10 MB，超限直接抛错终止：

→ 源码：[scripts/verify-postbuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-postbuild.ts)

```ts
const maxAsarSizeMb =
  options.maxAsarSizeMb ?? Number(getRepoEnvValue(repoEnv, 'MAX_ASAR_SIZE_MB') || 10);

// ...

if (asarSizeMb > maxAsarSizeMb) {
  throw new Error(
    `❌ [verify-postbuild] asar 体积超过门禁上限 (${asarSizeMb.toFixed(2)} MB > ${maxAsarSizeMb.toFixed(2)} MB)，发生体积异常膨胀防劣化失败！`,
  );
}
```

超限前还会先输出体积构成分析（按模块归类的占比 + TOP 5 最大文件），劣化原因一眼可见。两道门禁都内嵌在打包链里：

→ 源码：[scripts/build.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/build.ts)

```ts
const { valid } = await verifyPrebuild();
if (!valid) {
  process.exit(1);
}

// ... electron-builder 打包 ...

if (!values['skip-verify']) {
  try {
    await verifyPostbuild({ distDir: getDistDir(ROOT_DIR) });
  } catch (verifyError) {
    console.error('❌ Post-packaging verification failed:', verifyError);
    process.exit(1);
  }
}
```

`build:win` / `build:mac` / `build:linux` 都走这条链，Release 工作流的三平台构建因此每包必检；只有显式传 `--skip-verify` 才能跳过。

## 怎么抄

以打包为例：

1. **打包走 `scripts/build.ts` 链路**：prebuild / postbuild 门禁默认内嵌，体积超限先看构成分析，查 `manualChunks` 与根 `dependencies`

注意点：

- `--skip-verify` 是逃生门不是常规选项：只有改打包配置本身时才临时用，日常发版必须让门禁真跑
