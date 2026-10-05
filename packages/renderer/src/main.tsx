import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.tsx';
import { AppProviders } from './components/layout/AppProviders';
import { StartupReadyNotifier } from './components/startup/StartupReadyNotifier';
import { initSentry } from './lib/sentry';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <StartupReadyNotifier />
      <App />
    </AppProviders>
  </StrictMode>,
);
