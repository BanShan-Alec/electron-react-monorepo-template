import { StyleProvider } from '@ant-design/cssinjs';
import { I18nProvider } from '@lingui/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { usePlatform } from '@/hooks/usePlatform';
import { useTheme } from '@/hooks/useTheme';
import { dynamicActivate, getAntdLocale, i18n, type SupportedLocale } from '@/locales/i18n';
import { useAppStore } from '@/stores/useAppStore';
import { getAntdThemeConfig } from '@/styles/antd-theme';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const language = useAppStore((state) => state.language);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const setLanguage = useAppStore((state) => state.setLanguage);

  // 注入平台类名，供 CSS 做平台避让
  usePlatform();

  // 初始化并跟踪应用主题（设置 html 标签 data-theme 及 dark 类名）
  useTheme();

  // 国际化语言包按需动态激活
  useEffect(() => {
    dynamicActivate(language);
  }, [language]);

  // 初始配置拉取与跨窗口主题/多语言变更同步
  useEffect(() => {
    window.api?.config?.get?.().then((res) => {
      if (res?.success && res.data) {
        if (res.data.theme) setThemeMode(res.data.theme);
        if (res.data.language) setLanguage(res.data.language as SupportedLocale);
      }
    });

    const unsubscribe = window.api?.config?.onChanged?.((config) => {
      if (config.theme) setThemeMode(config.theme);
      if (config.language) setLanguage(config.language as SupportedLocale);
    });

    return () => {
      unsubscribe?.();
    };
  }, [setThemeMode, setLanguage]);

  return (
    <I18nProvider i18n={i18n}>
      {/*
        layer：把 cssinjs 注入的 antd 样式收进 @layer antd（层名由 cssinjs 默认提供），
        配合 index.css 首行的层序声明，使 Tailwind utilities 可直接覆盖 antd 组件样式。
      */}
      <StyleProvider layer>
        <ConfigProvider
          button={{ autoInsertSpace: false }}
          theme={getAntdThemeConfig(resolvedTheme)}
          locale={getAntdLocale(language)}
        >
          <AntdApp>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AntdApp>
        </ConfigProvider>
      </StyleProvider>
    </I18nProvider>
  );
};
