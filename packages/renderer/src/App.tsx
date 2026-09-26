import { App as AntdApp, ConfigProvider } from 'antd';
import { memo, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Header, type HeaderTab } from '@/components/layout/Header';
import { ArchitectureView } from '@/features/architecture/components/ArchitectureView';
import { CalculatorCard } from '@/features/calculator/components/CalculatorCard';
import { useCalculator } from '@/features/calculator/hooks/useCalculator';
import { CounterCard } from '@/features/counter/components/CounterCard';
import { useCounter } from '@/features/counter/hooks/useCounter';
import { DevToolsCard } from '@/features/diagnostics/components/DevToolsCard';
import { LoggingCard } from '@/features/diagnostics/components/LoggingCard';
import { useDiagnostics } from '@/features/diagnostics/hooks/useDiagnostics';
import { DialogCard } from '@/features/native-dialogs/components/DialogCard';
import { useNativeDialogs } from '@/features/native-dialogs/hooks/useNativeDialogs';
import { SettingsCard } from '@/features/settings/components/SettingsCard';
import { useAppConfig } from '@/features/settings/hooks/useAppConfig';
import { PingCard } from '@/features/system-info/components/PingCard';
import { SystemInfoCard } from '@/features/system-info/components/SystemInfoCard';
import { useSystemInfo } from '@/features/system-info/hooks/useSystemInfo';
import { useAppStore } from '@/stores/useAppStore';
import { getAntdThemeConfig } from '@/styles/antd-theme';

// 私有常量
const DEFAULT_TAB: HeaderTab = 'dashboard';

// 可抽离的逻辑处理函数/组件

const _App = (_props: IProps) => {
  // 变量声明、解构

  // 组件状态
  const [activeTab, setActiveTab] = useState<HeaderTab>(DEFAULT_TAB);
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);

  // 网络IO
  const systemInfo = useSystemInfo();
  const counter = useCounter();
  const calculator = useCalculator();
  const settings = useAppConfig();
  const dialogs = useNativeDialogs();
  const diagnostics = useDiagnostics();

  // 数据转换

  // 逻辑处理函数

  // 组件Effect
  // 主题联动：将解析后的明暗态写入 documentElement，激活 tokens.css 的浅色变量并切换 antd 算法
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  // 系统主题联动：mode 为 'system' 时跟随 OS 偏好变化（监听必须配套清理，防止泄漏与重复触发）
  useEffect(() => {
    if (themeMode !== 'system') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      setThemeMode('system');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [themeMode, setThemeMode]);

  // 组件渲染
  return (
    <ErrorBoundary>
      <ConfigProvider theme={getAntdThemeConfig(resolvedTheme)}>
        <AntdApp>
          <div className="h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
            {/* App Header & Navigation */}
            <Header activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Main Content Area */}
            <main className="flex-1 min-h-0 p-6 max-w-7xl mx-auto w-full overflow-y-auto stable-scrollbar">
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* System Info & Ping */}
                  <PingCard
                    latency={systemInfo.pingLatency}
                    serverTime={systemInfo.serverTime}
                    isPinging={systemInfo.isPinging}
                    onPing={systemInfo.handlePing}
                  />

                  <SystemInfoCard
                    systemInfo={systemInfo.systemInfo}
                    isLoading={systemInfo.isFetchingInfo}
                    onRefresh={systemInfo.fetchSystemInfo}
                  />

                  {/* Counter & State Persistence */}
                  <CounterCard
                    count={counter.count}
                    step={counter.step}
                    onStepChange={counter.setStep}
                    isUpdating={counter.isUpdating}
                    onIncrement={counter.handleIncrement}
                    onDecrement={counter.handleDecrement}
                    onReset={counter.handleReset}
                  />

                  {/* Safe RPC Calculator */}
                  <CalculatorCard
                    a={calculator.a}
                    b={calculator.b}
                    op={calculator.op}
                    onAChange={calculator.setA}
                    onBChange={calculator.setB}
                    onOpChange={calculator.setOp}
                    result={calculator.result}
                    error={calculator.error}
                    isLoading={calculator.isLoading}
                    onCalculate={calculator.calculate}
                  />

                  {/* App Settings & ConfigStore */}
                  <SettingsCard
                    appConfig={settings.appConfig}
                    onUpdate={settings.handleUpdateConfig}
                    onReset={settings.handleResetConfig}
                    isLoading={settings.isLoading}
                  />

                  {/* Native Dialogs */}
                  <DialogCard
                    selectedPath={dialogs.selectedPath}
                    statusMessage={dialogs.statusMessage}
                    isLoading={dialogs.isLoading}
                    onOpenFile={dialogs.handleOpenFile}
                    onOpenDirectory={dialogs.handleOpenDirectory}
                    onSaveFile={dialogs.handleSaveFile}
                    onShowInFolder={dialogs.handleShowInFolder}
                  />

                  {/* Logging & Rotation */}
                  <LoggingCard
                    logStatus={diagnostics.logStatus}
                    isLoading={diagnostics.isLoading}
                    onSendLog={diagnostics.handleSendLog}
                    onOpenLogFolder={diagnostics.handleOpenLogFolder}
                  />

                  {/* DevTools & External Links */}
                  <DevToolsCard
                    actionMessage={diagnostics.actionMessage}
                    onToggleDevTools={diagnostics.handleToggleDevTools}
                    onOpenDocs={diagnostics.handleOpenDocs}
                  />
                </div>
              )}

              {activeTab === 'architecture' && <ArchitectureView />}
            </main>
          </div>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
};

// props 类型定义
type IProps = Record<string, never>;

const App = memo(_App);

export { App };
export default App;
