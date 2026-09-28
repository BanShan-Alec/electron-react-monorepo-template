import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppProviders } from './components/layout/AppProviders';
import { UpdaterFeature } from './features/updater';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <UpdaterFeature />
    </AppProviders>
  </StrictMode>,
);
