import { APP_DOMAINS, buildSentryTags, SENTRY_TAGS } from '@app/shared/constants/telemetry';
import { describe, expect, it } from 'vitest';

describe('telemetry Domain & Sentry Tag Contracts', () => {
  it('defines valid APP_DOMAINS with non-empty feature and logger fields', () => {
    expect(APP_DOMAINS.OTA).toBeDefined();
    expect(APP_DOMAINS.OTA.feature).toBe('ota');
    expect(APP_DOMAINS.OTA.logger).toBe('UpdaterService');

    for (const [key, domain] of Object.entries(APP_DOMAINS)) {
      expect(key).toBe(key.toUpperCase());
      expect(typeof domain.feature).toBe('string');
      expect(domain.feature.length).toBeGreaterThan(0);
      expect(typeof domain.logger).toBe('string');
      expect(domain.logger.length).toBeGreaterThan(0);
    }
  });

  it('defines standardized SENTRY_TAGS keys', () => {
    expect(SENTRY_TAGS.FEATURE).toBe('feature');
    expect(SENTRY_TAGS.LOGGER).toBe('logger');
    expect(SENTRY_TAGS.STAGE).toBe('ota_stage');
    expect(SENTRY_TAGS.TARGET_VERSION).toBe('target_version');
    expect(SENTRY_TAGS.CURRENT_VERSION).toBe('current_version');
  });

  it('buildSentryTags correctly builds tag map with feature and logger', () => {
    const tags = buildSentryTags(APP_DOMAINS.OTA);
    expect(tags).toEqual({
      feature: 'ota',
      logger: 'UpdaterService',
    });
  });

  it('buildSentryTags merges extra tags and filters undefined/null values', () => {
    const tags = buildSentryTags(APP_DOMAINS.OTA, {
      [SENTRY_TAGS.STAGE]: 'checking',
      [SENTRY_TAGS.TARGET_VERSION]: '1.6.0',
      [SENTRY_TAGS.CURRENT_VERSION]: '1.5.0',
      emptyField: undefined,
      nullField: null,
      numericField: 404,
      booleanField: true,
    });

    expect(tags).toEqual({
      feature: 'ota',
      logger: 'UpdaterService',
      ota_stage: 'checking',
      target_version: '1.6.0',
      current_version: '1.5.0',
      numericField: '404',
      booleanField: 'true',
    });
    expect('emptyField' in tags).toBe(false);
    expect('nullField' in tags).toBe(false);
  });
});
