import { create } from 'zustand';
import type { SupportedLocale } from '@/locales/i18n';

/**
 * 全局轻量应用状态（对齐 renderer/hooks-and-state.md 第 2 章）。
 * 主题 mode 与解析后的 resolvedTheme 分层：'system' 依赖 OS 偏好，需在 UI 层解析为具体明暗。
 */

// 私有常量
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

// 可抽离的逻辑处理函数/组件
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') {
    return mode;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
  }
  return 'dark';
}

interface AppState {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  language: SupportedLocale;
  setLanguage: (language: SupportedLocale) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeMode: 'system',
  resolvedTheme: resolveTheme('system'),
  setThemeMode: (themeMode) => set({ themeMode, resolvedTheme: resolveTheme(themeMode) }),
  language: 'zh-CN',
  setLanguage: (language) => set({ language }),
}));
