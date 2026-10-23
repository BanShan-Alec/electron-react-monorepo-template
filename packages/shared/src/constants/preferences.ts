/**
 * 应用偏好契约（主题 / 语言枚举与默认值单一事实源）
 *
 * 同时服务：Zod 配置 schema、主进程 ConfigStore 默认值、渲染进程 store、
 * 设置界面选项与 i18n 引导。新增语言/主题只改这里。
 */

export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const DEFAULT_THEME_MODE: ThemeMode = 'system';

/** 解析 'system' 时使用的 OS 明暗偏好媒体查询 */
export const LIGHT_COLOR_SCHEME_QUERY = '(prefers-color-scheme: light)';

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN';
