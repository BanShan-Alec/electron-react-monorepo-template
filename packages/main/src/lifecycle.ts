import { app } from 'electron';

export const appLifecycle = {
  isQuitting: false,
};

app.on('before-quit', () => {
  appLifecycle.isQuitting = true;
});
