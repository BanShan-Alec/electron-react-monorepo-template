/**
 * 业务特征与领域标识契约定义（面向 Sentry 业务 Tag、看板漏斗与告警）
 *
 * 核心设计原则：
 * 1. 业务域（feature）：面向 Sentry 看板过滤、漏斗聚合与告警（粗粒度业务维度，如 'ota', 'window'）。
 * 2. 代码实现细节（Logger Scope）：由各模块运行时类名自内省（如 `this.constructor.name`）决定，不污染全局公共常量。
 * 3. 单一职责：公共层只收敛跨端通用的业务标签协议与 Sentry 标准 Tag Key。
 */
export const APP_FEATURES = {
  OTA: 'ota',
  WINDOW: 'window',
  IPC: 'ipc',
  CONFIG: 'config',
  DIAGNOSTICS: 'diagnostics',
  THEME: 'theme',
  SECURITY: 'security',
  STARTUP: 'startup',
  SENTRY: 'sentry',
  RENDERER_HOME: 'renderer_home',
  RENDERER_UPDATER: 'renderer_updater',
} as const;

export type AppFeatureKey = keyof typeof APP_FEATURES;
export type AppFeature = (typeof APP_FEATURES)[AppFeatureKey];

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
 * @param feature 业务领域标识（如 APP_FEATURES.OTA）
 * @param extraTags 业务特异性 Tag 键值对（如 { [SENTRY_TAGS.LOGGER]: this.constructor.name, ... }），undefined/null 将被自动过滤
 */
export function buildSentryTags(
  feature: string,
  extraTags?: Record<string, string | number | boolean | undefined | null>,
): Record<string, string> {
  const tags: Record<string, string> = {
    [SENTRY_TAGS.FEATURE]: feature,
  };

  if (extraTags) {
    for (const [key, value] of Object.entries(extraTags)) {
      if (value !== undefined && value !== null) {
        tags[key] = String(value);
      }
    }
  }

  return tags;
}
