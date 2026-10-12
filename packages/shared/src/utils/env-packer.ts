import type { AppEnv } from '../constants/env';
import type { AppRuntimeEnv } from '../types/env';

export const APP_ENV_ARG_PREFIX = '--app-meta=';

const XOR_MASK = 0x5a;

/**
 * 将 Uint8Array 编码为 URL 安全且无 padding 的 Base64URL 字符串
 * 纯标准实现，在 Node.js 和浏览器/Preload 沙箱中通用
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 将 Base64URL 字符串还原为 Uint8Array
 */
function fromBase64Url(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 将运行时环境变量压缩为紧凑元组并进行掩码混淆和 Base64URL 编码
 */
export function packRuntimeEnv(env: AppRuntimeEnv): string {
  const tuple = [
    env.mode,
    env.appVersion,
    env.appName,
    env.channel ?? '',
    env.apiBaseUrl ?? '',
    env.systemCode ?? '',
    env.sentryDsn ?? '',
    env.releaseName ?? '',
  ];
  const jsonStr = JSON.stringify(tuple);
  const bytes = new TextEncoder().encode(jsonStr);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] ^= XOR_MASK;
  }
  return toBase64Url(bytes);
}

/**
 * 从混淆的 Base64URL 字符串逆向还原 AppRuntimeEnv 对象
 */
export function unpackRuntimeEnv(encodedStr: string): AppRuntimeEnv {
  const bytes = fromBase64Url(encodedStr);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] ^= XOR_MASK;
  }
  const jsonStr = new TextDecoder().decode(bytes);
  const [mode, appVersion, appName, channel, apiBaseUrl, systemCode, sentryDsn, releaseName] =
    JSON.parse(jsonStr);

  return {
    mode: mode as AppEnv,
    appVersion: String(appVersion),
    appName: String(appName),
    channel: channel ? String(channel) : undefined,
    apiBaseUrl: apiBaseUrl ? String(apiBaseUrl) : undefined,
    systemCode: systemCode ? String(systemCode) : undefined,
    sentryDsn: sentryDsn ? String(sentryDsn) : undefined,
    releaseName: releaseName ? String(releaseName) : undefined,
  };
}
