import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { AppProviders } from '@/components/layout/AppProviders';
import { StartupReadyNotifier } from '@/components/startup/StartupReadyNotifier';
import { initSentry } from '@/lib/sentry';
import App from './App.tsx';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <StartupReadyNotifier />
      <App />
    </AppProviders>
  </StrictMode>,
);
