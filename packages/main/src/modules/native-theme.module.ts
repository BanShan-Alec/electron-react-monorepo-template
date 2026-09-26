import type { AppConfig } from '@app/shared/schemas/config';
import { nativeTheme } from 'electron';
import type { AppModule } from '../AppModule';
import type { ModuleContext } from '../ModuleContext';
import { getAppConfigStore } from './config.module';
import { getLogManager } from './log.module';

/**
 * 系统级主题同步（nativeTheme）
 * AppConfig['theme'] 的 'system' | 'light' | 'dark' 与 Electron nativeTheme.themeSource 枚举一一对应，直接透传。
 * 同步后：原生对话框/标题栏/滚动条及渲染层 prefers-color-scheme 均由应用主题驱动。
 */

// 私有常量

// 可抽离的逻辑处理函数/组件
export function applyNativeThemeSource(theme: AppConfig['theme']): void {
  try {
    nativeTheme.themeSource = theme;
    getLogManager().mainLogger.info(`[NativeTheme] themeSource synced -> ${theme}`);
  } catch (err) {
    getLogManager().mainLogger.error('[NativeTheme] Failed to sync themeSource:', err);
  }
}

export class NativeThemeModule implements AppModule {
  enable({ app }: ModuleContext): void {
    // nativeTheme 须在 app.whenReady() 后操作；配置模块先于本模块初始化，store 已可读
    app.whenReady().then(() => {
      applyNativeThemeSource(getAppConfigStore().get('theme'));

      nativeTheme.on('updated', () => {
        getLogManager().mainLogger.info(
          `[NativeTheme] Updated, shouldUseDarkColors=${nativeTheme.shouldUseDarkColors}`,
        );
      });
    });
  }
}

export function createNativeThemeModule(): NativeThemeModule {
  return new NativeThemeModule();
}
