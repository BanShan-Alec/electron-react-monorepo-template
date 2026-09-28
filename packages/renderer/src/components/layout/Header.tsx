import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Badge, Segmented } from 'antd';
import { memo } from 'react';

// 私有常量
const APP_VERSION = 'v3.1.0';

// 可抽离的逻辑处理函数/组件

const _Header = (props: IHeaderProps) => {
  useLingui();
  // 变量声明、解构
  const { activeTab, onTabChange } = props;

  // 组件状态

  // 网络IO

  // 数据转换
  const tabOptions = [
    { label: t`总览看板`, value: 'dashboard' },
    { label: t`架构全貌`, value: 'architecture' },
  ];

  // 逻辑处理函数
  const handleTabChange = (value: string | number) => {
    onTabChange(value as HeaderTab);
  };

  // 组件Effect

  // 组件渲染
  return (
    <header className="drag-region bg-background-container border-b border-border px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Electron + Vite + Fullstack IPC
            </h1>
            <Badge count={APP_VERSION} color="var(--color-primary)" />
          </div>
          <p className="text-xs text-foreground-secondary mt-0.5">
            企业级端到端类型安全桌面客户端脚手架
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Segmented
        className="no-drag"
        value={activeTab}
        options={tabOptions}
        onChange={handleTabChange}
      />
    </header>
  );
};

// props 类型定义
export type HeaderTab = 'dashboard' | 'architecture';

interface IHeaderProps {
  activeTab: HeaderTab;
  onTabChange: (tab: HeaderTab) => void;
}

const Header = memo(_Header);

export { Header };
export default Header;
