/**
 * 应用运行语义环境常量 (App Runtime Environment Constants)
 * 统一跨端 (Main / Preload / Renderer / Shared) 运行环境的事实标准
 */
export const APP_ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type AppEnv = (typeof APP_ENV)[keyof typeof APP_ENV];

/**
 * 统一运行时环境变量前缀与白名单键（防 OS 环境变量冲突 + 客户端入包边界唯一真源）
 * 带此前缀的变量才会随打包内联默认值并透传至主进程 / 渲染层运行时；不带前缀仅限构建/开发脚本使用。
 */
export const RUNTIME_ENV_PREFIX = 'EL_' as const;

export const RUNTIME_ENV_KEYS = [
  `${RUNTIME_ENV_PREFIX}API_BASE_URL`,
  `${RUNTIME_ENV_PREFIX}SYSTEM_CODE`,
  `${RUNTIME_ENV_PREFIX}DISTRIBUTION_CHANNEL`,
  `${RUNTIME_ENV_PREFIX}SENTRY_DSN`,
] as const;

export type RuntimeEnvKey = (typeof RUNTIME_ENV_KEYS)[number];
