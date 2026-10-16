/**
 * 应用领域与模块统一契约定义（集中管理 Sentry 业务 Tag 与本地 Logger Scope）
 *
 * 核心设计原则：
 * 1. 业务域（feature）：面向 Sentry 看板过滤、漏斗聚合与告警（粗粒度业务维度，如 'ota', 'window'）。
 * 2. 日志上下文（logger）：面向本地文件落盘与代码类名定位（细粒度工程模块维度，如 'UpdaterService'）。
 * 3. 统一收敛：杜绝在各业务模块与上报点散落硬编码字符串，强类型保障重构安全。
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
  UPDATER_WINDOW: {
    feature: 'ota',
    logger: 'UpdaterWindowModule',
  },
  IPC: {
    feature: 'ipc',
    logger: 'IPC',
  },
  CONFIG: {
    feature: 'config',
    logger: 'Config',
  },
  THEME: {
    feature: 'theme',
    logger: 'NativeTheme',
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
  SENTRY: {
    feature: 'sentry',
    logger: 'SentryModule',
  },
  RENDERER_HOME: {
    feature: 'renderer_home',
    logger: 'RendererHome',
  },
  RENDERER_UPDATER: {
    feature: 'renderer_updater',
    logger: 'RendererUpdater',
  },
} as const;

export type AppDomainKey = keyof typeof APP_DOMAINS;
export type AppDomain = (typeof APP_DOMAINS)[AppDomainKey];
export type AppFeature = AppDomain['feature'];
export type AppLoggerScope = AppDomain['logger'];

/**
 * Sentry 标准 Tag 键名规范
 */
export const SENTRY_TAGS = {
  FEATURE: 'feature',
  LOGGER: 'logger',
  STAGE: 'ota_stage',
  TARGET_VERSION: 'target_version',
  CURRENT_VERSION: 'current_version',
  PROCESS: 'process',
  CRASH_REASON: 'crash_reason',
  EXIT_CODE: 'exit_code',
  WINDOW_ID: 'window_id',
} as const;

export type SentryTagKey = (typeof SENTRY_TAGS)[keyof typeof SENTRY_TAGS];

/**
 * 构建符合统一规范的 Sentry Tags 对象
 *
 * @param domain 领域定义（包含 feature 与可选的 logger scope）
 * @param extraTags 业务特异性 Tag 键值对（undefined 值将被自动过滤）
 */
export function buildSentryTags(
  domain: { feature: string; logger?: string },
  extraTags?: Record<string, string | number | boolean | undefined | null>,
): Record<string, string> {
  const tags: Record<string, string> = {
    [SENTRY_TAGS.FEATURE]: domain.feature,
  };

  if (domain.logger) {
    tags[SENTRY_TAGS.LOGGER] = domain.logger;
  }

  if (extraTags) {
    for (const [key, value] of Object.entries(extraTags)) {
      if (value !== undefined && value !== null) {
        tags[key] = String(value);
      }
    }
  }

  return tags;
}
