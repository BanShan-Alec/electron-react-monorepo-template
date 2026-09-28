export const WINDOW_IDS = {
  /** 原主窗口（更名定义）：dashboard / architecture 两个 tab 的宿主 */
  HOME: 'home',
  /** 自动更新窗口：changelog + 进度 + 操作 */
  UPDATER: 'updater',
} as const;

export type WindowId = (typeof WINDOW_IDS)[keyof typeof WINDOW_IDS];
