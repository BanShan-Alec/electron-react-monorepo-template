import type React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';

export const ArchitectureView: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Flow Diagram Card */}
      <Card
        title="Fullstack 经典分层通信架构全流程"
        subtitle="遵循 specs-electron-fullstack 规范：Controller -> Service -> Result 契约"
        icon="💡"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
          <div className="flex items-start gap-3 p-3.5 bg-background-secondary/50 rounded-xl border border-border">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              1
            </div>
            <div>
              <span className="font-semibold text-xs text-foreground block">
                @app/shared 共享契约单一事实源
              </span>
              <p className="text-xs text-foreground-secondary mt-1 leading-relaxed">
                使用 Zod Schema 定义入参校验规则，派生跨端统一 TypeScript 类型与标准{' '}
                <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">
                  Result&lt;T&gt;
                </code>{' '}
                响应契约。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-background-secondary/50 rounded-xl border border-border">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              2
            </div>
            <div>
              <span className="font-semibold text-xs text-foreground block">
                Main 进程 Controller -&gt; Service 分层
              </span>
              <p className="text-xs text-foreground-secondary mt-1 leading-relaxed">
                Controller 执行 Zod 防御性参数校验与顶层异常包装，Service 专注核心业务逻辑，杜绝
                Procedure 称谓混淆。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-background-secondary/50 rounded-xl border border-border">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              3
            </div>
            <div>
              <span className="font-semibold text-xs text-foreground block">
                Preload 精准白名单桥接
              </span>
              <p className="text-xs text-foreground-secondary mt-1 leading-relaxed">
                使用{' '}
                <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">
                  contextBridge.exposeInMainWorld('api', apiBridge)
                </code>{' '}
                暴露受限安全 API 与 webUtils，杜绝渲染端渗透。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-background-secondary/50 rounded-xl border border-border">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              4
            </div>
            <div>
              <span className="font-semibold text-xs text-foreground block">
                Renderer 进程纯净消费
              </span>
              <p className="text-xs text-foreground-secondary mt-1 leading-relaxed">
                统一通过{' '}
                <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">
                  window.api
                </code>{' '}
                消费 Result 契约，享受完备 IDE 智能提示，与主进程实现 100% 物理代码隔离。
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Code Comparison Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Legacy / Coupled */}
        <div className="glass-card rounded-xl p-4 border border-danger/30 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-danger/20">
            <span className="text-xs font-bold text-foreground">❌ 传统散装 / 进程穿透方式</span>
            <Badge variant="danger" size="sm">
              代码耦合 & 契约混乱
            </Badge>
          </div>
          <pre className="text-[11px] font-mono text-foreground-secondary bg-background/80 p-3 rounded-lg overflow-x-auto leading-relaxed flex-1">
            {`// 1. 渲染端强行引用主进程类型 (打破物理隔离)
import type { AppRouter } from '@app/main/router';

// 2. 纯数字状态码或裸抛异常 (易造成前端崩溃)
throw new TRPCError({ code: 'BAD_REQUEST' });

// 3. 缺乏标准 Result 包装
// 前端无法统一判定 res.success 与语义化 code`}
          </pre>
        </div>

        {/* Fullstack Standard */}
        <div className="glass-card rounded-xl p-4 border border-success/30 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-success/20">
            <span className="text-xs font-bold text-foreground">✨ Fullstack 规范分层方式</span>
            <Badge variant="success" size="sm">
              物理隔离 & Result 契约
            </Badge>
          </div>
          <pre className="text-[11px] font-mono text-foreground-secondary bg-background/80 p-3 rounded-lg overflow-x-auto leading-relaxed flex-1">
            {`// 1. Controller 执行 Zod 防御校验并封装 Result
const res = await systemService.getSystemInfo();
return { success: true, data: res };

// 2. 语义化字符串错误码 (如 DIVIDE_BY_ZERO)
// 3. 渲染端通过 window.api 纯净消费
const res = await window.api.system.getSystemInfo();
if (res.success) {
  console.log(res.data.cpuModel);
}`}
          </pre>
        </div>
      </div>
    </div>
  );
};
