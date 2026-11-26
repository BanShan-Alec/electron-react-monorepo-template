import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureRepoEnv, resetRepoEnvCacheForTest } from '../lib/env';

describe('ensureRepoEnv', () => {
  const testKeys = [
    'TEST_REPO_ENV_BASE',
    'TEST_REPO_ENV_MODE_ONLY',
    'TEST_REPO_ENV_EXTERNAL',
    'TEST_REPO_ENV_EMPTY',
    'MODE',
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};
  let tempRoot: string;
  let nestedDir: string;

  beforeEach(() => {
    resetRepoEnvCacheForTest();
    for (const key of testKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }

    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-repo-env-'));
    nestedDir = path.join(tempRoot, 'packages', 'main');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'package.json'), '{"name":"test-root"}\n', 'utf8');
    fs.writeFileSync(
      path.join(tempRoot, 'pnpm-workspace.yaml'),
      'packages:\n  - "packages/*"\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(tempRoot, '.env'),
      'TEST_REPO_ENV_BASE=from-dot-env\nTEST_REPO_ENV_EXTERNAL=from-dot-env\nTEST_REPO_ENV_EMPTY=from-dot-env\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(tempRoot, '.env.development'),
      'TEST_REPO_ENV_MODE_ONLY=from-dev-env\n',
      'utf8',
    );
  });

  afterEach(() => {
    resetRepoEnvCacheForTest();
    for (const key of testKeys) {
      const prev = savedEnv[key];
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('finds repository root and fills undefined process.env keys from .env', () => {
    const resolvedRoot = ensureRepoEnv(nestedDir, 'production');

    expect(resolvedRoot).toBe(tempRoot);
    expect(process.env.TEST_REPO_ENV_BASE).toBe('from-dot-env');
    expect(process.env.TEST_REPO_ENV_MODE_ONLY).toBeUndefined();
  });

  it('never overwrites existing external process.env values including empty strings', () => {
    process.env.TEST_REPO_ENV_EXTERNAL = 'from-shell';
    process.env.TEST_REPO_ENV_EMPTY = '';

    ensureRepoEnv(nestedDir, 'production');

    expect(process.env.TEST_REPO_ENV_EXTERNAL).toBe('from-shell');
    expect(process.env.TEST_REPO_ENV_EMPTY).toBe('');
    expect(process.env.TEST_REPO_ENV_BASE).toBe('from-dot-env');
  });

  it('is idempotent per rootDir and mode within the same process', () => {
    ensureRepoEnv(nestedDir, 'production');
    expect(process.env.TEST_REPO_ENV_BASE).toBe('from-dot-env');

    // 修改磁盘文件并删掉内存变量，验证同 rootDir::mode 命中缓存不再重读
    fs.writeFileSync(path.join(tempRoot, '.env'), 'TEST_REPO_ENV_BASE=changed-on-disk\n', 'utf8');
    delete process.env.TEST_REPO_ENV_BASE;

    const secondRoot = ensureRepoEnv(nestedDir, 'production');
    expect(secondRoot).toBe(tempRoot);
    expect(process.env.TEST_REPO_ENV_BASE).toBeUndefined();
  });

  it('loads mode-specific .env when process.env.MODE changes', () => {
    ensureRepoEnv(nestedDir, 'production');
    expect(process.env.TEST_REPO_ENV_MODE_ONLY).toBeUndefined();

    process.env.MODE = 'development';
    ensureRepoEnv(nestedDir);

    expect(process.env.TEST_REPO_ENV_MODE_ONLY).toBe('from-dev-env');
  });
});
