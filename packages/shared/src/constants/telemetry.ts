/**
 * 应用领域与模块统一契约定义（集中管理 Sentry 业务 Tag 与本地 Logger Scope）
 */
export const APP_DOMAINS = {
  OTA: {
    feature: 'ota',
    logger: 'UpdaterService',
  },
  WINDOW: {
    feature: 'window',
    logger: 'WindowManager',
  },
  IPC: {
    feature: 'ipc',
    logger: 'IPC',
  },
  CONFIG: {
    feature: 'config',
    logger: 'ConfigService',
  },
  DIAGNOSTICS: {
    feature: 'diagnostics',
    logger: 'DiagnosticsService',
  },
  SECURITY: {
    feature: 'security',
    logger: 'SecurityModule',
  },
  STARTUP: {
    feature: 'startup',
    logger: 'StartupReadiness',
  },
} as const;

export type AppDomainKey = keyof typeof APP_DOMAINS;
export type AppFeature = (typeof APP_DOMAINS)[AppDomainKey]['feature'];
export type AppLoggerScope = (typeof APP_DOMAINS)[AppDomainKey]['logger'];

/**
 * Sentry 标准 Tag 键名规范
 */
export const SENTRY_TAGS = {
  FEATURE: 'feature',
  STAGE: 'ota_stage',
  TARGET_VERSION: 'target_version',
  CURRENT_VERSION: 'current_version',
} as const;
