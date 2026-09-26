import { App as AntdApp, ConfigProvider } from 'antd';
import { memo, useState } from 'react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Header, type HeaderTab } from '@/components/layout/Header';
import { ArchitectureFeature } from '@/features/architecture';
import { CalculatorFeature } from '@/features/calculator';
import { CounterFeature } from '@/features/counter';
import { DiagnosticsFeature } from '@/features/diagnostics';
import { NativeDialogsFeature } from '@/features/native-dialogs';
import { SettingsFeature } from '@/features/settings';
import { SystemInfoFeature } from '@/features/system-info';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/stores/useAppStore';
import { getAntdThemeConfig } from '@/styles/antd-theme';

// 私有常量
const DEFAULT_TAB: HeaderTab = 'dashboard';

// 可抽离的逻辑处理函数/组件

/**
 * 应用壳层：只做编排（tab 状态、面板摆放、主题 Provider）。
 * 不实例化任何 feature hook、不透传 feature props——域的 state 与 IPC 一律收敛在 feature 内（见 README）。
 */
const _App = (_props: IProps) => {
  // 变量声明、解构

  // 组件状态
  const [activeTab, setActiveTab] = useState<HeaderTab>(DEFAULT_TAB);
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);

  // 主题联动：应用级职责，抽离至 hooks/useTheme.ts
  useTheme();

  // 数据转换
  const isDashboard = activeTab === 'dashboard';

  // 逻辑处理函数

  // 组件Effect

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
              {/* 两块面板均保持挂载、仅切换显隐：卸载会丢失域内状态并重复发起 IPC（README「已知取舍」） */}
              <div
                className={`grid grid-cols-1 lg:grid-cols-2 gap-5${isDashboard ? '' : ' hidden'}`}
              >
                <SystemInfoFeature />
                <CounterFeature />
                <CalculatorFeature />
                <SettingsFeature />
                <NativeDialogsFeature />
                <DiagnosticsFeature />
              </div>

              <div className={isDashboard ? 'hidden' : undefined}>
                <ArchitectureFeature />
              </div>
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
