import { APP_ENV } from '@app/shared/constants/env';
import type { AppRuntimeEnv } from '@app/shared/types/env';
import { APP_ENV_ARG_PREFIX, packRuntimeEnv, unpackRuntimeEnv } from '@app/shared/utils/env-packer';
import { describe, expect, it } from 'vitest';

describe('env-packer Codec', () => {
  it('correctly packs and unpacks full runtime env roundtrip', () => {
    const original: AppRuntimeEnv = {
      mode: APP_ENV.PRODUCTION,
      appVersion: '1.2.0',
      appName: 'Electron React Template',
      channel: 'stable',
      apiBaseUrl: 'https://api.example.com',
      systemCode: 'ERP-CORE',
    };

    const packed = packRuntimeEnv(original);
    expect(packed).toBeTypeOf('string');
    expect(packed.length).toBeGreaterThan(0);
    // 确保没有明文字段泄露
    expect(packed).not.toContain('production');
    expect(packed).not.toContain('https://api.example.com');
    expect(packed).not.toContain('apiBaseUrl');

    const unpacked = unpackRuntimeEnv(packed);
    expect(unpacked).toEqual(original);
  });

  it('handles optional undefined fields correctly', () => {
    const minimal: AppRuntimeEnv = {
      mode: APP_ENV.TEST,
      appVersion: '0.0.1',
      appName: 'test-app',
    };

    const packed = packRuntimeEnv(minimal);
    const unpacked = unpackRuntimeEnv(packed);

    expect(unpacked).toEqual({
      mode: APP_ENV.TEST,
      appVersion: '0.0.1',
      appName: 'test-app',
      channel: undefined,
      apiBaseUrl: undefined,
      systemCode: undefined,
    });
  });

  it('exposes standard command line argument prefix', () => {
    expect(APP_ENV_ARG_PREFIX).toBe('--app-meta=');
  });
});
