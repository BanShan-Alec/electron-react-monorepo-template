import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { AppProviders } from '@/components/layout/AppProviders';
import { StartupReadyNotifier } from '@/components/startup/StartupReadyNotifier';
import { initSentry } from '@/lib/sentry';
import App from './App.tsx';

initSentry();
// 生命周期叙事：入口启动即落盘（preload 先于页面脚本执行，logger 全局已就绪）
logger.info('App started', { entry: 'home' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <Router hook={useHashLocation}>
        <StartupReadyNotifier />
        <App />
      </Router>
    </AppProviders>
  </StrictMode>,
);
