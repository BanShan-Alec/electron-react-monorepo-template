import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import { Button, ConfigProvider, theme } from 'antd';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getAntdThemeConfig } from '@/styles/antd-theme';
import { BRAND_PRIMARY, CSS_VAR_KEY } from '@/styles/design-tokens';

const readStyle = (name: string) =>
  fs.readFileSync(fileURLToPath(new URL(`../../src/styles/${name}`, import.meta.url)), 'utf8');

function extractThemeCss(mode: 'light' | 'dark'): string {
  const cache = createCache();
  renderToString(
    React.createElement(
      StyleProvider,
      { cache },
      React.createElement(
        ConfigProvider,
        { theme: getAntdThemeConfig(mode) },
        React.createElement(Button, { type: 'primary' }, 'OK'),
      ),
    ),
  );
  return extractStyle(cache);
}

const lightCss = extractThemeCss('light');
const darkCss = extractThemeCss('dark');
const indexCss = readStyle('index.css');
const tokensCss = readStyle('tokens.css');

describe('cssVar 颜色链路', () => {
  it('antd 主题与作用域类共用同一个 key 与品牌种子', () => {
    for (const mode of ['light', 'dark'] as const) {
      const config = getAntdThemeConfig(mode);
      expect(config.cssVar.key).toBe(CSS_VAR_KEY);
      expect(config.token.colorPrimary).toBe(BRAND_PRIMARY);
    }
  });

  it('antd 在 .css-var-app 作用域注入项目引用的每个 --ant-* 变量', () => {
    const targets = new Set(
      [...indexCss.matchAll(/--color-[a-z-]+:\s*var\((--ant-[a-z-]+)\)/g)].map((match) => match[1]),
    );

    expect(targets.size).toBeGreaterThan(0);
    expect(lightCss).toContain(`.${CSS_VAR_KEY}{`);
    expect(darkCss).toContain(`.${CSS_VAR_KEY}{`);

    for (const target of targets) {
      expect(lightCss, `light 缺少 ${target}`).toContain(`${target}:`);
      expect(darkCss, `dark 缺少 ${target}`).toContain(`${target}:`);
    }
    expect(lightCss).toContain('--ant-color-error:');
  });

  it('window 画布兜底值与 antd colorBgLayout / colorText 一致', () => {
    const readVar = (block: string, name: string) =>
      new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim().replace(/\s+/g, '');
    const darkStart = tokensCss.indexOf(':root[data-theme="dark"]');
    const blocks = [
      ['light', tokensCss.slice(0, darkStart)],
      ['dark', tokensCss.slice(darkStart)],
    ] as const;

    for (const [mode, block] of blocks) {
      const tokens = theme.getDesignToken({
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      });
      expect(readVar(block, '--window-bg')).toBe(tokens.colorBgLayout.replace(/\s+/g, ''));
      expect(readVar(block, '--window-fg')).toBe(tokens.colorText.replace(/\s+/g, ''));
    }
  });

  it('浅深两套颜色不同', () => {
    expect(darkCss).not.toBe(lightCss);
    expect(lightCss).toContain('--ant-color-bg-layout:');
    expect(darkCss).toContain('--ant-color-bg-layout:');
  });
});
