import {
  type LanguageMode,
  resolveLocale,
  type SupportedLocale,
} from '@app/shared/constants/preferences';
import { app } from 'electron';

/**
 * 主进程原生 UI 文案（托盘菜单 / 系统通知）。
 *
 * 渲染层文案走 Lingui（packages/renderer/src/locales）；主进程不引 i18n 框架，
 * 只为这十来条原生 UI 文案维护一份中英对照，避免 `isZh ? ... : ...` 散落在业务代码里。
 */
interface MainMessages {
  trayShowMainWindow: string;
  trayCheckUpdates: string;
  trayQuit: string;
  trayTooltipSuffix: string;
  notifDownloadTimeout: string;
  notifDownloadReady: string;
  notifBackgroundDownload: string;
}

const MAIN_MESSAGES: Record<SupportedLocale, MainMessages> = {
  'zh-CN': {
    trayShowMainWindow: '显示主窗口',
    trayCheckUpdates: '检查更新',
    trayQuit: '退出应用',
    trayTooltipSuffix: '桌面客户端',
    notifDownloadTimeout: '后台更新下载超时，已中止任务。',
    notifDownloadReady: '新版本已下载完毕，点击立即安装。',
    notifBackgroundDownload: '应用已关闭，正在后台下载更新...',
  },
  'en-US': {
    trayShowMainWindow: 'Show main window',
    trayCheckUpdates: 'Check for updates',
    trayQuit: 'Quit',
    trayTooltipSuffix: 'Desktop client',
    notifDownloadTimeout: 'Background update timed out. Task aborted.',
    notifDownloadReady: 'Update downloaded. Click to install.',
    notifBackgroundDownload: 'App closed. Downloading the update in the background…',
  },
};

export type MainMessageKey = keyof MainMessages;

export function mainMessage(mode: LanguageMode, key: MainMessageKey): string {
  // 原生 UI 拿不到渲染层的 navigator.language，用 Electron 的 OS 语言解析
  const locale = resolveLocale(mode, app.isReady() ? app.getLocale() : '');
  return MAIN_MESSAGES[locale][key];
}
