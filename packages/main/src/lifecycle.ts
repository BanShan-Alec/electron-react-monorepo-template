import { app } from 'electron';

export const appLifecycle = {
  isQuitting: false,
};

if (typeof app?.on === 'function') {
  app.on('before-quit', () => {
    appLifecycle.isQuitting = true;
  });
}
