import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { AppProviders } from '@/components/layout/AppProviders';
import { UpdaterFeature } from '@/features/updater';
import { initSentry } from '@/lib/sentry';

initSentry();
// 生命周期叙事：入口启动即落盘（preload 先于页面脚本执行，logger 全局已就绪）
logger.info('App started', { entry: 'updater' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <UpdaterFeature />
    </AppProviders>
  </StrictMode>,
);
