# 功能域组织（Features）

> **TL;DR**：渲染层一个业务域一个自包含目录，域间禁止互相 import，删功能就是删目录。

## 要解决的坑

Electron 项目最容易长歪的地方就是组织方式：

- 渲染层按文件类型分目录，`components/`、`hooks/` 全局大池子，删一个功能要跨目录追捕文件，永远删不干净

## 本仓库的解法

### 2. 领域驱动组织：features/ 一个域一个目录，删功能就是删目录

→ 源码：[packages/renderer/src/features/counter/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/counter/index.tsx)

```tsx
/**
 * 计数器域入口（feature 唯一公开面）：自行持有 hook 并渲染卡片，壳层只负责摆放。
 */
function CounterFeature() {
  // 变量声明、解构
  const { count, step, setStep, isUpdating, handleIncrement, handleDecrement, handleReset } =
    useCounter();

  // 组件渲染
  return (
    <CounterCard
      count={count}
      step={step}
      onStepChange={setStep}
      isUpdating={isUpdating}
      onIncrement={handleIncrement}
      onDecrement={handleDecrement}
      onReset={handleReset}
    />
  );
}
```

每个域都是同一个形状：

```
features/counter/
├── index.tsx                    # 唯一公开面：调 hook + 渲染卡片，只做胶水
├── components/CounterCard/      # 私有：纯展示，props 进 callback 出，不碰 IPC
└── hooks/useCounter.ts          # 私有：IPC 副作用 + 状态，返回 view model
```

当前 `features/` 下共 12 个域：architecture、calculator、counter、dashboard、devtools、logging、native-dialogs、ping、settings、system-info、updater、usb。组织规则三条：

- **按所有权切**：只服务一个域的代码进 `features/<domain>/`；被第二个域真实消费才上提到 `components/`、`hooks/`、`lib/`、`stores/`，不预抽取
- **域间禁止互相 import**：唯一例外是 `dashboard` 组合编排域。删一个功能 = 删一个目录 + 撤掉壳层一行引用
- **依赖方向单向**：`entries → features → 跨域层`，壳层只做路由摆放

→ 源码：[packages/renderer/src/entries/home/App.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/entries/home/App.tsx)

```tsx
<Switch>
  <Route path="/dashboard">
    <DashboardFeature />
  </Route>
  <Route path="/architecture">
    <ArchitectureFeature />
  </Route>
  {/* 默认根路径与未知路径统一重定向到 /dashboard */}
  <Route path="/*">
    <Redirect to="/dashboard" replace />
  </Route>
</Switch>
```

壳层对 feature 的全部认知只有两个具名导出——`DashboardFeature` 组合了哪些卡片、`ArchitectureFeature` 渲染什么，壳层一概不感知。规则真源：`packages/renderer/AGENTS.md`（分层依据与 Feature 规范）。

## 怎么抄

承接[分层架构（Controller / Service）](/architecture/layering)的第 1–4 步，本页是渲染层与上架的后续步骤：

5. **renderer 建域目录**：`features/<domain>/`（`index.tsx` + `hooks/` + `components/`），IPC 请求走 `lib/ipc.ts` 请求层
6. **上架**：主窗口域在 `App.tsx` 路由或 dashboard 加一行；独立窗口域再加一个 MPA 入口与窗口模块

删域反向操作：删 features 目录、删 controller/service 文件、撤 `registerAllControllers()` 一行——边界都落在目录和注册表上，删除是机械动作。

注意点：

- 不预抽取共享层：第二个消费者真实出现才上提 `components/`、`hooks/`、`lib/`、`stores/`
- feature 之间禁止互相 import，跨域组合一律收敛到 dashboard；`features/<domain>/` 下默认不嵌套第二层，确需子域用 `sections/` 且深度上限两层
