import { LoggingCard } from './components/LoggingCard';
import { useLogging } from './hooks/useLogging';

// 私有常量

// 可抽离的逻辑处理函数/组件
/**
 * 日志域入口（feature 唯一公开面）。与 devtools 平级：两侧零共享 state（见 README「Feature 规范 4」）。
 */
function LoggingFeature() {
  // 变量声明、解构
  const { logStatus, isLoading, handleSendLog, handleOpenLogFolder } = useLogging();

  // 组件渲染
  return (
    <LoggingCard
      logStatus={logStatus}
      isLoading={isLoading}
      onSendLog={handleSendLog}
      onOpenLogFolder={handleOpenLogFolder}
    />
  );
}

export { LoggingFeature };
export default LoggingFeature;
