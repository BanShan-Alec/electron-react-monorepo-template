import { getRuntimeEnvSnapshot, hydrateBundledRuntimeEnv } from '@app/main/env';
import { RUNTIME_ENV_KEYS, type RuntimeEnvKey } from '@app/shared/constants/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    isReady: vi.fn(() => true),
    getVersion: vi.fn(() => '1.14.0'),
    getName: vi.fn(() => 'Electron React Template'),
  },
}));

describe('runtime env hydration and snapshot', () => {
  const savedEnv: Partial<Record<RuntimeEnvKey, string | undefined>> = {};

  beforeEach(() => {
    for (const key of RUNTIME_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of RUNTIME_ENV_KEYS) {
      const prev = savedEnv[key];
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  });

  it('fills undefined ELECTRON_APP_* slots from bundled defaults', () => {
    hydrateBundledRuntimeEnv({
      ELECTRON_APP_API_BASE_URL: 'https://api.example.com',
      ELECTRON_APP_SYSTEM_CODE: 'ELECTRON_APP',
      ELECTRON_APP_DISTRIBUTION_CHANNEL: 'latest',
      ELECTRON_APP_SENTRY_DSN: 'https://sentry.example.com/1',
    });

    expect(process.env.ELECTRON_APP_API_BASE_URL).toBe('https://api.example.com');
    expect(process.env.ELECTRON_APP_SYSTEM_CODE).toBe('ELECTRON_APP');
    expect(process.env.ELECTRON_APP_DISTRIBUTION_CHANNEL).toBe('latest');
    expect(process.env.ELECTRON_APP_SENTRY_DSN).toBe('https://sentry.example.com/1');
  });

  it('does not overwrite existing external process.env values including empty string', () => {
    process.env.ELECTRON_APP_API_BASE_URL = 'https://staging.example.com';
    process.env.ELECTRON_APP_SENTRY_DSN = '';

    hydrateBundledRuntimeEnv({
      ELECTRON_APP_API_BASE_URL: 'https://api.example.com',
      ELECTRON_APP_SENTRY_DSN: 'https://sentry.example.com/1',
      ELECTRON_APP_DISTRIBUTION_CHANNEL: 'beta',
    });

    expect(process.env.ELECTRON_APP_API_BASE_URL).toBe('https://staging.example.com');
    expect(process.env.ELECTRON_APP_SENTRY_DSN).toBe('');
    expect(process.env.ELECTRON_APP_DISTRIBUTION_CHANNEL).toBe('beta');
  });

  it('reads process.env directly in getRuntimeEnvSnapshot and normalizes empty strings to undefined', () => {
    process.env.ELECTRON_APP_API_BASE_URL = 'https://custom.example.com';
    process.env.ELECTRON_APP_SYSTEM_CODE = '';
    process.env.ELECTRON_APP_DISTRIBUTION_CHANNEL = 'canary';

    const snapshot = getRuntimeEnvSnapshot();

    expect(snapshot.apiBaseUrl).toBe('https://custom.example.com');
    expect(snapshot.systemCode).toBeUndefined();
    expect(snapshot.channel).toBe('canary');
    expect(snapshot.sentryDsn).toBeUndefined();
  });
});
