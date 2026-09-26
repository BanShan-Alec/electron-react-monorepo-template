import { PingCard } from './components/PingCard';
import { SystemInfoCard } from './components/SystemInfoCard';
import { useSystemInfo } from './hooks/useSystemInfo';

// 私有常量

// 可抽离的逻辑处理函数/组件
/**
 * 系统信息域入口（feature 唯一公开面）。
 * 一个域两张卡片：Ping 与系统信息共享 useSystemInfo 的挂载拉取生命周期。
 */
function SystemInfoFeature() {
  // 变量声明、解构
  const {
    systemInfo,
    isFetchingInfo,
    fetchSystemInfo,
    pingLatency,
    serverTime,
    isPinging,
    handlePing,
  } = useSystemInfo();

  // 组件渲染
  return (
    <>
      <PingCard
        latency={pingLatency}
        serverTime={serverTime}
        isPinging={isPinging}
        onPing={handlePing}
      />

      <SystemInfoCard
        systemInfo={systemInfo}
        isLoading={isFetchingInfo}
        onRefresh={fetchSystemInfo}
      />
    </>
  );
}

export { SystemInfoFeature };
export default SystemInfoFeature;
