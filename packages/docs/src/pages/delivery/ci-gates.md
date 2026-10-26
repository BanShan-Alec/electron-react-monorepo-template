# CI 并行门禁（GitHub Actions）

## CI 五路并行门禁

→ 源码：[.github/workflows/ci.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/workflows/ci.yml) · [.github/actions/setup-env/action.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/actions/setup-env/action.yml)

CI 在 PR 与 main push 上运行五个并行 job，文件头注释声明它们均为分支保护的 required checks：`typecheck`、`lint`、`test`（Vitest 单测）、`e2e`（真实 Electron 窗口）、`docs`（文档站构建）。同一 PR 重复 push 通过 `concurrency` 组自动取消旧运行。

```yaml
e2e:
  runs-on: ubuntu-latest
  timeout-minutes: 30
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-env
    # Electron 42+ 改为首次运行时惰性下载二进制；只下载不启动，规避 Linux sandbox 限制
    - run: pnpm exec install-electron
    # electron.launch 以 package.json main 为入口,需要先产出各包的构建产物
    - run: pnpm run build
    - run: pnpm run test:e2e
```

E2E 在真实 Electron 环境跑，两个前置缺一不可：先 `install-electron` 只下载二进制不启动（规避 Linux sandbox 限制），再 `pnpm run build` 产出各包构建产物——`electron.launch` 以 `package.json` 的 `main` 为入口，没有产物就是空跑。

`lint` job 顺带跑 `verify:prebuild`，下文的静态规则在 CI 阶段就拦下，不用等到真正打包。公共环境收敛成 composite action，五个 job 复用同一套初始化：

```yaml
# .github/actions/setup-env/action.yml（节选）
- name: Enable corepack
  run: corepack enable
- name: Install Dependencies
  run: pnpm install --frozen-lockfile
  env:
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'
```

该 action 的注释写明：pnpm 版本由根 `package.json` 的 `packageManager` 字段决定、Node 24 自带 corepack；Linux 上它还会先起 Xvfb，Electron 窗口才有地方渲染。

### 打包前静态拦截（verify-prebuild）

→ 源码：[scripts/verify-prebuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-prebuild.ts)

**前置门禁**在打包开始前（0 毫秒）静态拦截两类配置违规：

1. 根 `package.json` 的 `name` 必须匹配 `/^[a-z0-9-_]+$/`——守住 [应用打包](/delivery/packaging) 里说的产物寻址规范
2. 根 `dependencies` 只允许 `['@app/main']`——防止 electron-builder 扫依赖树时把渲染层等非主进程模块卷进 asar

```ts
const rootDeps = Object.keys(rootPkg.dependencies || {});
const allowedRootDeps = ['@app/main'];
const illegalRootDeps = rootDeps.filter((dep) => !allowedRootDeps.includes(dep));
```

## 怎么抄

- **门禁**：build 脚本固定 prebuild → build → postbuild 三段。prebuild 只做静态规则（name 规范、依赖边界）
- **CI 与发版**：typecheck / lint / test / e2e / docs 五个 required check 并行，公共环境收敛成 composite action

postbuild 产物验真见 [产物冒烟测试（dist 启动验证）](/testing/artifact-smoke)。

注意点：

- CI 新增 job 后记得同步到分支保护的 required checks，否则 `pr-review merge` 的等待逻辑里不会包含它
