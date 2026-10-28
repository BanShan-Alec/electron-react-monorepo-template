import { theme } from 'antd';
import { BRAND_PRIMARY, type ThemeMode } from './design-tokens';

/**
 * antd 主题配置：官方算法 + 一个品牌种子。
 * 颜色不在这里逐个覆盖——只给 colorPrimary，浅深两套由算法派生；
 * 布局壳的 CSS 变量由 design-tokens.ts 用同一种子计算，两边同源。
 * controlHeightSM=28 是刻意的密度选择（antd 默认 24）。
 */

export function getAntdThemeConfig(mode: ThemeMode) {
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: BRAND_PRIMARY,
      controlHeightSM: 28,
    },
  };
}
