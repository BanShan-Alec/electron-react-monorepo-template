# 国际化（Lingui）

> **TL;DR**：源码即 key，中文直写，构建期抽词条、运行时按语种动态加载。

→ 源码：[packages/renderer/lingui.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/lingui.config.ts)

```ts
const config: LinguiConfig = {
  locales: ['zh-CN', 'en-US'],
  sourceLocale: 'zh-CN',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  format: formatter({ lineNumbers: false }),
};
```

源码即 key：组件里直接写中文，不存在「先想一个英文 key、再去翻译文件里对暗号」的环节。

→ 源码：[packages/renderer/src/features/counter/components/CounterCard/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/counter/components/CounterCard/index.tsx)

```tsx
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
// ...
useLingui();
// ...
<CardTitle
  icon={<CalculatorOutlined />}
  title={t`IPC 计数器 (Counter)`}
  subtitle={t`基于主进程状态原子操作与响应式更新`}
/>
```

构建期 `pnpm i18n:extract`（根 package.json 里定义为 `lingui extract --clean`）扫描 `src/` 把词条抽进 .po 目录，msgid 就是中文文案本身：

```po
#: src/features/architecture/components/ArchitectureView/index.tsx
msgid "@app/shared 共享契约单一事实源"
msgstr "@app/shared 共享契约单一事实源"
```

改了文案等于换了 msgid，旧词条会被 `--clean` 清掉，不会积压死词条；未翻译的条目在 en-US 目录里 msgstr 留空，一眼可见。

语言包不打进主 Bundle，运行时按需动态激活：

→ 源码：[packages/renderer/src/locales/i18n.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/locales/i18n.ts)

```ts
export async function dynamicActivate(locale: SupportedLocale): Promise<void> {
  if (locale === 'en-US') {
    // @ts-expect-error .po format is transformed by @lingui/vite-plugin at build time
    const { messages } = await import('./en-US/messages.po');
    i18n.load('en-US', messages);
  } else {
    // @ts-expect-error .po format is transformed by @lingui/vite-plugin at build time
    const { messages } = await import('./zh-CN/messages.po');
    i18n.load('zh-CN', messages);
  }

  i18n.activate(locale);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}
```

`@lingui/vite-plugin`（`macroTransform: true`，见 [packages/renderer/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/vite.config.ts)）在构建期把 .po 转成 JS 模块，动态 `import` 让每个语种成为独立 chunk。组件内的 `useLingui()` 订阅保证语言切换时全树重渲染。
