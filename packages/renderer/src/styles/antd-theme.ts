import { theme } from 'antd';

/**
 * Ant Design v6 官方默认主题配置
 * 仅切换官方算法（defaultAlgorithm / darkAlgorithm），不覆盖任何设计令牌——
 * 视觉基线完全对齐 antd 原版，深浅双色 Token 均由官方算法输出。
 */

// 私有常量

// 可抽离的逻辑处理函数/组件
export type ThemeMode = 'dark' | 'light';

export function getAntdThemeConfig(mode: ThemeMode) {
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      controlHeightSM: 28,
      paddingInlineSM: 10,
    },
  };
}
