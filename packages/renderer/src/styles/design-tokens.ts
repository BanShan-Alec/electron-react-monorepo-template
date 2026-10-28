import { theme } from 'antd';

/**
 * 颜色令牌唯一来源：antd 官方算法 + BRAND_PRIMARY 种子。
 *
 * antd 组件的颜色由 ConfigProvider 的 token 在 cssinjs 内计算，布局壳的颜色读
 * 这里写进 documentElement 的 CSS 变量。两边必须来自同一次 getDesignToken()，
 * 手抄色值会在 antd 升级或换品牌时静默漂移。
 *
 * applyTheme 必须在 createRoot 之前调用：变量先落到 <html>，React 首帧才有色。
 */

export type ThemeMode = 'light' | 'dark';

export const BRAND_PRIMARY = '#1677ff';

type ThemeTokens = ReturnType<typeof theme.getDesignToken>;

const VAR_MAP = {
  '--color-bg-primary': (t) => t.colorBgLayout,
  '--color-bg-container': (t) => t.colorBgContainer,
  '--color-bg-elevated': (t) => t.colorBgElevated,
  '--color-bg-sunken': (t) => t.colorFillAlter,
  '--color-text-primary': (t) => t.colorText,
  '--color-text-secondary': (t) => t.colorTextSecondary,
  '--color-text-muted': (t) => t.colorTextTertiary,
  '--color-text-on-primary': (t) => t.colorTextLightSolid,
  '--color-border': (t) => t.colorBorder,
  '--color-primary': (t) => t.colorPrimary,
  '--color-primary-hover': (t) => t.colorPrimaryHover,
  '--color-primary-light': (t) => t.colorPrimaryBg,
  '--color-success': (t) => t.colorSuccess,
  '--color-warning': (t) => t.colorWarning,
  '--color-danger': (t) => t.colorError,
} satisfies Record<`--color-${string}`, (tokens: ThemeTokens) => string>;

export type ThemeCssVars = { [K in keyof typeof VAR_MAP]: string };

export function buildThemeCssVars(mode: ThemeMode, seed: string = BRAND_PRIMARY): ThemeCssVars {
  const tokens = theme.getDesignToken({
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: { colorPrimary: seed },
  });

  return Object.fromEntries(
    Object.entries(VAR_MAP).map(([name, read]) => [name, read(tokens)]),
  ) as ThemeCssVars;
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle('dark', mode === 'dark');

  for (const [name, value] of Object.entries(buildThemeCssVars(mode))) {
    root.style.setProperty(name, value);
  }
}
