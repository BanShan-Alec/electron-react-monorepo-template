# 阶段二：多进程架构与安全通信

本文档说明主进程、预加载脚本与渲染进程的职责分工，以及进程间通信方式。

## 1. 解决什么问题

在 Electron 应用中，开发者经常遇到这三个问题：
- 主进程与渲染进程代码混杂，容易产生安全漏洞。
- IPC 通信参数缺少类型校验，接口变更时无法提前感知错误。
- 自定义无边框窗口无法拖拽，在 Windows 系统上缺少最大化贴靠布局。

本模板采用分层设计与类型安全 IPC，解决上述问题。

## 2. 进程分层模型

项目包含三个运行层级，各司其职：

```text
packages/renderer  (React 界面层：只负责 UI 呈现与用户交互)
       ↓ (调用 window.api)
packages/preload   (安全隔离层：通过 contextBridge 暴露有限白名单方法)
       ↓ (IPC 消息转发)
packages/main      (系统核心层：Controller 处理请求，Service 处理业务)
```

### 职责边界规则
1. 渲染进程严禁直接调用 Node.js 原生 API。
2. 预加载脚本严禁直接透传 `ipcRenderer.send`。必须包装为具体业务函数。
3. 业务逻辑与系统操作必须写在 `packages/main` 中。

## 3. 端到端类型安全 IPC 通信

编写一个 IPC 接口需要完成三个步骤：

### 步骤一：在 shared 包中定义通道与类型
打开 `packages/shared/src/types/`，定义请求参数与返回值类型，并在 `IPC_CHANNELS` 登记：

```typescript
export const IPC_CHANNELS = {
  USER_GET_PROFILE: 'user:get-profile',
} as const;

export interface UserProfile {
  id: string;
  name: string;
}
```

### 步骤二：在 main 包中实现控制器
在 `packages/main/src/controllers/` 下继承 `BaseController` 处理消息：

```typescript
export class UserController extends BaseController {
  constructor(private readonly userService: UserService) {
    super();
  }

  public registerRoutes(): void {
    this.handle(IPC_CHANNELS.USER_GET_PROFILE, async () => {
      return this.userService.getProfile();
    });
  }
}
```

### 步骤三：在 renderer 包中发起调用
在 React 组件或 Hook 中使用封装好的 `useIpc`：

```typescript
const { data, loading, run } = useIpc(
  window.api.user.getProfile,
  { manual: false }
);
```

## 4. 原生贴靠与窗口控制 (WCO)

项目默认使用 Window Controls Overlay (WCO) 原生标题栏：
- 保留系统原生最小化、最大化和关闭按钮。
- Windows 11 系统完美支持贴靠布局 (Snap Layout)。
- 可拖拽区域使用 CSS 声明：`-webkit-app-region: drag`。
- 交互按钮区域必须排除拖拽：`-webkit-app-region: no-drag`。

## 5. 避坑指南

- 永远不要在渲染进程中导入 `electron` 模块。
- 注册 IPC 事件监听时，使用 `this.handle` 而不是 `ipcMain.on`，确保调用支持异步等待。
- 窗口拖拽区域内如果包含点击按钮，必须设置 `-webkit-app-region: no-drag`，否则按钮无法点击。
