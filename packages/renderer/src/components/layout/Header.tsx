import type React from 'react';
import { Badge } from '../ui';

export interface HeaderProps {
  activeTab: 'dashboard' | 'architecture';
  onTabChange: (tab: 'dashboard' | 'architecture') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="drag-region bg-background-secondary/80 backdrop-blur-md border-b border-border px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/20 flex-shrink-0">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Electron + Vite + Fullstack IPC
            </h1>
            <Badge variant="primary" size="sm">
              v3.1.0
            </Badge>
          </div>
          <p className="text-xs text-foreground-secondary mt-0.5">
            企业级端到端类型安全桌面客户端脚手架
          </p>
        </div>
      </div>

      {/* Tabs */}
      <nav className="no-drag flex items-center bg-background/60 p-1 rounded-xl border border-border/80">
        <button
          type="button"
          onClick={() => onTabChange('dashboard')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-primary text-white shadow-sm'
              : 'text-foreground-secondary hover:text-foreground hover:bg-white/5'
          }`}
        >
          📊 功能控制台
        </button>
        <button
          type="button"
          onClick={() => onTabChange('architecture')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'architecture'
              ? 'bg-primary text-white shadow-sm'
              : 'text-foreground-secondary hover:text-foreground hover:bg-white/5'
          }`}
        >
          🛡️ 安全与架构设计
        </button>
      </nav>
    </header>
  );
};
