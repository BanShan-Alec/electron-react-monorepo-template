import { describe, expect, it } from 'vitest';
import { buildFallbackBody, extractReleaseBody } from './release-body.ts';

const CHANGELOG = `# Changelog

## v1.13.0

[compare changes](https://example.com/compare/v1.12.1...v1.13.0)

### 🚀 新增特性 (Features)

- **compiler:** 全面适配 React Compiler 规范 ([#76](https://example.com/pull/76))

### 🏡 工程维护 (Chores)

- 升级依赖

### ❤️ Contributors

- 半山Alec ([@BanShan-Alec](https://github.com/BanShan-Alec))

## v1.12.1

[compare changes](https://example.com/compare/v1.12.0...v1.12.1)

### 🩹 缺陷修复 (Bug Fixes)

- 修复托盘图标
`;

describe('extractReleaseBody', () => {
  it('提取指定版本段并在下一个版本标题处停止', () => {
    const body = extractReleaseBody(CHANGELOG, 'v1.13.0');
    expect(body).toContain('React Compiler');
    expect(body).not.toContain('修复托盘图标');
  });

  it('去掉 compare 行与 Contributors 段，保留 PR 链接', () => {
    const body = extractReleaseBody(CHANGELOG, 'v1.13.0');
    expect(body).not.toContain('[compare changes]');
    expect(body).not.toContain('Contributors');
    expect(body).toContain('https://example.com/pull/76');
  });

  it('tag 不存在时返回 null', () => {
    expect(extractReleaseBody(CHANGELOG, 'v9.9.9')).toBeNull();
  });

  it('段落只剩机械噪声时返回 null', () => {
    const empty = '## v1.0.0\n\n[compare changes](https://example.com)\n';
    expect(extractReleaseBody(empty, 'v1.0.0')).toBeNull();
  });
});

describe('buildFallbackBody', () => {
  it('指向 tag 锚定的 CHANGELOG', () => {
    expect(buildFallbackBody('https://github.com/a/b', 'v1.0.0')).toBe(
      '📖 完整变更日志见 [CHANGELOG.md](https://github.com/a/b/blob/v1.0.0/CHANGELOG.md)',
    );
  });
});
