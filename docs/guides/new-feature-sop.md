# 新增业务功能端到端开发 SOP（4 阶段流水线）

> 本文系统规范如何在本项目中以**工业级、防腐蚀、类型安全**的方式开发一个新功能。  
> 无论是人类开发者还是 AI Agent，必须严格遵循 **Shared ➔ Main ➔ Preload ➔ Renderer** 的单向拓扑流水线。

---

## 1. 核心设计原则

- **契约先行**：严禁在未定义 Shared 接口前在前端随意调用未经声明的 IPC。
- **职责隔离**：
  - `Shared`: 纯数据结构、错误码与通道常量（严禁 Node/DOM 依赖，严禁 Barrel 导出）；
  - `Main`: Controller 负责入参校验与通道分发，Service 负责纯业务逻辑，统一返回 `Result<T>`；
  - `Preload`: 严禁暴露整个 `ipcRenderer`，只暴露经过类型收窄的白名单方法；
  - `Renderer`: 纯 React 展现与业务 Hook 封装，感知不到 Electron 内部底层实现。

---

## 2. 4 阶段流水线操作示范

以新增一个“系统信息获取与温度监控 (`system-monitor`)”功能为例演示全流程。

### 阶段一：`@app/shared` 定义跨端契约

1. **注册 IPC 通道常量**：
   在 [`packages/shared/src/constants/ipc-channels.ts`](file:///packages/shared/src/constants/ipc-channels.ts) 中追加：
   ```ts
   export const IPC_CHANNELS = {
     // ...既有通道
     SYSTEM_GET_METRICS: 'system:get-metrics',
   } as const;
   ```

2. **定义强类型数据契约**：
   在 `packages/shared/src/types/` 下新建 `system.ts`：
   ```ts
   export interface CpuMetric {
     usagePercentage: number;
     temperatureCelsius?: number;
     coreCount: number;
   }

   export interface SystemMetrics {
     cpu: CpuMetric;
     memoryFreeMb: number;
     memoryTotalMb: number;
   }
   ```

3. **扩充全局 API 接口**：
   在 [`packages/shared/src/types/api.ts`](file:///packages/shared/src/types/api.ts) 中的 `ElectronApi` 接口追加：
   ```ts
   import type { SystemMetrics } from './system';
   import type { Result } from './result';

   export interface ElectronApi {
     // ...既有模块
     system: {
       getMetrics(): Promise<Result<SystemMetrics>>;
     };
   }
   ```

---

### 阶段二：`@app/main` 实现业务与 IPC 控制器

1. **编写 Service 纯业务逻辑**：
   新建 `packages/main/src/services/system.service.ts`：
   ```ts
   import os from 'node:os';
   import type { SystemMetrics } from '@app/shared/types/system';

   export class SystemService {
     public getMetrics(): SystemMetrics {
       const cpus = os.cpus();
       return {
         cpu: {
           usagePercentage: 15.5,
           coreCount: cpus.length,
         },
         memoryFreeMb: Math.round(os.freemem() / 1024 / 1024),
         memoryTotalMb: Math.round(os.totalmem() / 1024 / 1024),
       };
     }
   }
   ```

2. **编写 Controller 处理请求与异常**：
   新建 `packages/main/src/controllers/system.controller.ts`：
   ```ts
   import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
   import type { Result } from '@app/shared/types/result';
   import type { SystemMetrics } from '@app/shared/types/system';
   import { ipcMain } from 'electron';
   import type { SystemService } from '../services/system.service';

   export class SystemController {
     constructor(private readonly systemService: SystemService) {}

     public register(): void {
       ipcMain.handle(
         IPC_CHANNELS.SYSTEM_GET_METRICS,
         async (): Promise<Result<SystemMetrics>> => {
           try {
             const data = this.systemService.getMetrics();
             return { success: true, data };
           } catch (error) {
             return {
               success: false,
               error: {
                 code: 'SYSTEM_METRICS_ERROR',
                 message: error instanceof Error ? error.message : String(error),
               },
             };
           }
         },
       );
     }
   }
   ```

3. **在主控制器统一装配**：
   在 `packages/main/src/controllers/index.ts` 实例化并调用 `controller.register()`。

---

### 阶段三：`@app/preload` 接入 ContextBridge 网关

编辑 [`packages/preload/src/index.ts`](file:///packages/preload/src/index.ts)，将新通道注入 `apiBridge`：
```ts
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';

const apiBridge: ElectronApi = {
  // ...既有模块
  system: {
    getMetrics: () => invokeTraced(IPC_CHANNELS.SYSTEM_GET_METRICS),
  },
};
```

---

### 阶段四：`@app/renderer` 呈现与状态编排

1. **封装领域 Hook**：
   在 `packages/renderer/src/features/system/hooks/useSystemMetrics.ts` 中封装 React Query / SWR 或标准 `useEffect`：
   ```ts
   import { useEffect, useState } from 'react';
   import type { SystemMetrics } from '@app/shared/types/system';

   export function useSystemMetrics() {
     const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
     const [loading, setLoading] = useState(false);

     const refresh = async () => {
       setLoading(true);
       const res = await window.electronApi.system.getMetrics();
       if (res.success) {
         setMetrics(res.data);
       }
       setLoading(false);
     };

     useEffect(() => {
       refresh();
     }, []);

     return { metrics, loading, refresh };
   }
   ```

2. **编写 UI 组件并接入视图**：
   在 `packages/renderer/src/features/system/components/SystemCard.tsx` 中编写卡片，并在 Dashboard 中直接消费。

---

## 3. 全量验收门禁检查

功能编码完成后，在提交前必须严格运行全套质量门禁：

```bash
# 1. 代码格式与 Lint 校验
pnpm lint

# 2. 跨包 TypeScript 静态检查
pnpm typecheck

# 3. 依赖对齐门禁校验
pnpm run verify:deps

# 4. 单元测试与端到端测试
pnpm test
```
全部指令返回状态码 `0` 后，方可按照规范创建 Pull Request。
