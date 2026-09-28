import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

/**
 * 应用级主题联动（跨 feature 的壳层职责，故置于 hooks/ 而非任一域）：
 * 1. resolvedTheme 写入 documentElement.dataset.theme，激活 tokens.css 变量并切换 antd 算法；
 * 2. themeMode 为 'system' 时跟随 OS 偏好变化（监听必须配套清理，防止泄漏与重复触发）。
 */

// 私有常量
const LIGHT_QUERY = '(prefers-color-scheme: light)';

// 可抽离的逻辑处理函数/组件
export function useTheme() {
  const themeMode = useAppStore((state) => state.themeMode);
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const setThemeMode = useAppStore((state) => state.setThemeMode);

  // 组件Effect
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  useEffect(() => {
    if (themeMode !== 'system') {
      return;
    }
    const mediaQuery = window.matchMedia(LIGHT_QUERY);
    const handleChange = () => {
      setThemeMode('system');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [themeMode, setThemeMode]);
}
