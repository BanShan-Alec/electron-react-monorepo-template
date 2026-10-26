# 产物冒烟测试（dist 启动验证）

打包命令返回成功，只说明 electron-builder 走完了流程；产物能不能启动、React 能不能挂载，要真实拉起二进制才知道。这一步在每次打包后自动执行，跑不起来的环境显式跳过而不是静默失败。

## 要解决的坑

- 打包「成功」不等于「能用」：装完启动白屏、asar 结构错误，全靠发出去以后用户报障
- 交叉编译产物、无显示服务等跑不起来的环境，直接判失败会把环境限制误报成产物损坏

## 本仓库的解法

### 1. 打包链固定串入 postbuild 验真

→ 源码：[scripts/build.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/build.ts)

```ts
// 4. Verify packaged artifact integrity & run smoke check unless --skip-verify is specified
if (!values['skip-verify']) {
  try {
    await verifyPostbuild({ distDir: getDistDir(ROOT_DIR) });
  } catch (verifyError) {
    console.error('❌ Post-packaging verification failed:', verifyError);
    process.exit(1);
  }
}
```

`build:dir` / `build:win` / `build:mac` / `build:linux` 全部经 `scripts/build.ts` 触发，electron-builder 完成后默认调用 `verifyPostbuild`；只有显式传 `--skip-verify` 才跳过。产物目录固定是仓库根下的 `dist`：

→ 源码：[build/lib/repo-paths.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/repo-paths.ts)

```ts
/** 打包产物目录：固定 <root>/dist（不支持环境变量覆盖） */
export function getDistDir(rootDir: string): string {
  return path.join(rootDir, 'dist');
}
```

验真失败时 `scripts/build.ts` 直接 `process.exit(1)`，打包流程不会再往下走；也可以脱离打包单独重跑 `pnpm verify:postbuild`。

### 2. 跨平台发现解包产物

`verifyPostbuild` 先用 `detectUnpackedArtifact` 在 dist 下找解包产物与 `app.asar`。Windows 认 `dist/win-unpacked/` 里第一个非 uninstall 的 `.exe`：

```ts
// 1. Windows 检测 (dist/win-unpacked/)
const winUnpackedDir = path.join(distDir, 'win-unpacked');
if (fs.existsSync(winUnpackedDir)) {
  const files = fs.readdirSync(winUnpackedDir);
  const exeName = files.find(
    (f: string) => f.endsWith('.exe') && !f.toLowerCase().includes('uninstall'),
  );
  const asarPath = path.join(winUnpackedDir, 'resources', 'app.asar');
  if (exeName && fs.existsSync(asarPath)) {
    return {
      executablePath: path.join(winUnpackedDir, exeName),
      asarPath,
      platform: 'win32',
    };
  }
}
```

macOS 依次探测 `dist/mac/` 与 `dist/mac-arm64/`，从 `.app` 包内取 `Contents/MacOS` 下第一个条目作为可执行文件，并读取 `Contents/Resources/app.asar`；Linux 探测 `dist/linux-unpacked/`，排除 `chrome-sandbox` 与 `chrome_crashpad_handler`，挑带可执行位、文件名不含点号的文件。各分支返回同样结构的 `{ executablePath, asarPath, platform }`。

→ 源码：[scripts/verify-postbuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-postbuild.ts)

找不到任何解包产物就直接报错，不会静默放过：

```ts
const artifact = detectUnpackedArtifact(distDir);
if (!artifact) {
  throw new Error(
    `[verify-postbuild] 未在 ${distDir} 找到解包产物（支持 win-unpacked / mac / linux-unpacked）。请先完成打包构建。`,
  );
}
```

`asarPath` 随后交给体积门禁（默认 10MB）使用；门禁本体归安全维度，见[分包与体积门禁（asar 硬门禁）](/security/bundle-budget)，这里只做启动冒烟。

### 3. 宿主与显示守卫：跑不起来就显式跳过

```ts
// 2. 跨平台宿主兼容性守卫：若当前环境无法直接拉起目标二进制（例如 Linux 交叉编译构建了 Windows exe），安全跳过运行时测试
if (process.platform !== artifact.platform) {
  console.warn(
    `⚠️ [verify-postbuild] 目标平台 (${artifact.platform}) 与当前宿主平台 (${process.platform}) 不一致，跳过真实进程启动测试。`,
  );
  return;
}

// 无显示服务环境守卫（如无 Xvfb 的 Linux 纯命令行服务器或容器）
if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  console.warn(
    '⚠️ [verify-postbuild] 检测到当前 Linux 环境无可用 DISPLAY/WAYLAND 桌面显示服务，跳过运行时进程拉起测试。',
  );
  return;
}
```

两道守卫都发生在体积门禁之后：跳过只影响「拉起进程」，体积校验仍然生效。

### 4. 真实拉起产物，断言 #root 挂载

```ts
const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-smoke-test-'));

try {
  const app = await electron.launch({
    executablePath: artifact.executablePath,
    args: [
      `--user-data-dir=${tempUserDataDir}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    timeout: 30000,
  });

  try {
    console.log('⏳ [verify-postbuild] 等待主窗口就绪...');
    const page = await app.firstWindow();
    const title = await page.title();
    console.log(`🪟 [verify-postbuild] 主窗口捕获成功: title="${title}"`);

    console.log('⏳ [verify-postbuild] 校验 #root 界面渲染...');
    await page.waitForSelector('#root', { timeout: 15000 });
    console.log('✅ [verify-postbuild] React 渲染容器 #root 已成功挂载！');
  } finally {
    await app.close();
    console.log('🛑 [verify-postbuild] 应用程序已正常优雅退出。');
  }
} finally {
  try {
    fs.rmSync(tempUserDataDir, { recursive: true, force: true });
  } catch {
    // 忽略临时目录清理异常
  }
}
```

`electron.launch` 用 `executablePath` 指向解包产物（不是源码入口 `.`），每次新建临时 `user-data-dir` 规避单例锁；`app.close()` 与临时目录删除都放在 `finally` 里，启动超时或断言失败也会收尾。断言只有一条：`#root` 在 15 秒内出现——React 渲染容器挂上即冒烟通过，白屏的包走不到发布环节。

## 怎么抄

1. 打包统一走 `scripts/build.ts`（`build:dir` / `build:win` / `build:mac` / `build:linux`），让 postbuild 默认执行；不要绕过它直接调 electron-builder
2. 单独重跑用 `pnpm verify:postbuild`，先确认 `dist/` 里已有解包产物，否则脚本直接抛错
3. 冒烟只锁「产物能启动 + `#root` 挂载」；交互与协议行为交给[端到端测试（Playwright）](/testing/e2e-electron)
4. 交叉编译或无显示环境用平台 / DISPLAY 守卫显式跳过启动，跳过前体积门禁已经跑过（见[分包与体积门禁（asar 硬门禁）](/security/bundle-budget)）

注意点：

- 冒烟启动的是 `dist/win-unpacked`、`dist/mac*`、`dist/linux-unpacked` 里的解包二进制，不是安装包本身；NSIS / dmg / deb 的安装流程不在这一步的验证范围
- 临时 `user-data-dir` 每次新建，避免单例锁；`app.close()` 与目录删除都在 `finally` 里，启动失败也会收尾
- 断言只有一个 `#root` 选择器（15 秒上限），不校验页面内容；白屏会被拦下，渲染错误内容不会
- `--skip-verify` 是逃生门：默认打包链会真跑，日常发版不要跳过
