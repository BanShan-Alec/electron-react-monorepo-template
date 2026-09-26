import { DevToolsCard } from './components/DevToolsCard';
import { LoggingCard } from './components/LoggingCard';
import { useDiagnostics } from './hooks/useDiagnostics';

// 私有常量

// 可抽离的逻辑处理函数/组件
/**
 * 诊断域入口（feature 唯一公开面）。
 * 一个域两张卡片：Logging 与 DevTools 各自消费 useDiagnostics 中相互独立的动作通道，无共享状态。
 */
function DiagnosticsFeature() {
  // 变量声明、解构
  const {
    logStatus,
    isLoading,
    handleSendLog,
    handleOpenLogFolder,
    actionMessage,
    handleToggleDevTools,
    handleOpenDocs,
  } = useDiagnostics();

  // 组件渲染
  return (
    <>
      <LoggingCard
        logStatus={logStatus}
        isLoading={isLoading}
        onSendLog={handleSendLog}
        onOpenLogFolder={handleOpenLogFolder}
      />

      <DevToolsCard
        actionMessage={actionMessage}
        onToggleDevTools={handleToggleDevTools}
        onOpenDocs={handleOpenDocs}
      />
    </>
  );
}

export { DiagnosticsFeature };
export default DiagnosticsFeature;
