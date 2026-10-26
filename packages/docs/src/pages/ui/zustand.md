# 全局状态（zustand）

> **TL;DR**：单一无 Provider 的 store，主题与语言按字段订阅。

→ 源码：[packages/renderer/src/stores/useAppStore.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/stores/useAppStore.ts)

```ts
interface AppState {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  language: SupportedLocale;
  setLanguage: (language: SupportedLocale) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeMode: DEFAULT_THEME_MODE,
  resolvedTheme: resolveTheme(DEFAULT_THEME_MODE),
  setThemeMode: (themeMode) => set({ themeMode, resolvedTheme: resolveTheme(themeMode) }),
  language: DEFAULT_LOCALE,
  setLanguage: (language) => set({ language }),
}));
```

没有 Provider，任何组件 `useAppStore((state) => state.resolvedTheme)` 按字段订阅、按字段重渲染。全仓只有这一个 store，主题与语言这类跨 feature 的壳层状态都放这里。

`themeMode` 与 `resolvedTheme` 故意分层：`'system'` 依赖 OS 偏好，不能直接喂给 antd 算法，需要在 UI 层解析成具体明暗：

```ts
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') {
    return mode;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(LIGHT_COLOR_SCHEME_QUERY).matches ? 'light' : 'dark';
  }
  return 'dark';
}
```

## 怎么抄

以「新增一个功能页面」为例：

3. **状态**：跨 feature 的状态加进 `useAppStore`，feature 私有状态留在 feature 内
