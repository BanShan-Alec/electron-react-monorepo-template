import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getAntdThemeConfig } from '@/styles/antd-theme';
import { BRAND_PRIMARY, buildThemeCssVars } from '@/styles/design-tokens';

const light = buildThemeCssVars('light');
const dark = buildThemeCssVars('dark');

describe('颜色令牌单源', () => {
  it('默认种子即 antd 默认主色', () => {
    expect(light['--color-primary'].toLowerCase()).toBe(BRAND_PRIMARY);
  });

  it('antd 主题与 CSS 变量共用同一个品牌种子', () => {
    expect(getAntdThemeConfig('light').token.colorPrimary).toBe(BRAND_PRIMARY);
    expect(getAntdThemeConfig('dark').token.colorPrimary).toBe(BRAND_PRIMARY);
  });

  it('换种子时 primary / hover / bg 三档一起变', () => {
    const red = buildThemeCssVars('light', '#f5222d');

    expect(red['--color-primary'].toLowerCase()).toBe('#f5222d');
    expect(red['--color-primary-hover']).not.toBe(light['--color-primary-hover']);
    expect(red['--color-primary-light']).not.toBe(light['--color-primary-light']);
  });

  it('浅深两套由不同算法输出', () => {
    expect(dark['--color-bg-primary']).not.toBe(light['--color-bg-primary']);
    expect(dark['--color-primary']).not.toBe(light['--color-primary']);
  });

  it('index.css 引用的每个颜色变量都有来源', () => {
    const cssPath = fileURLToPath(new URL('../../src/styles/index.css', import.meta.url));
    const css = fs.readFileSync(cssPath, 'utf8');
    const referenced = new Set(
      [...css.matchAll(/var\((--color-[a-z-]+)/g)].map((match) => match[1]),
    );

    expect(referenced.size).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(Object.hasOwn(light, name), `light 缺少 ${name}`).toBe(true);
      expect(Object.hasOwn(dark, name), `dark 缺少 ${name}`).toBe(true);
    }
  });
});
