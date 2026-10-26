# 内容安全策略（CSP）

> **TL;DR**：CSP 响应头统一注入，外链与页面内跳转各有一层白名单，判定只在主进程。

## 要解决的坑

Electron 的默认配置是「能跑」，不是「防住」：

- 渲染层能 `fetch` 任意源、`window.open` 任意页面，能加载什么、能跳去哪里完全不可控

## 本仓库的解法

### 2. 内容与外链管控：CSP + 导航与外链双白名单

「能加载什么」由 CSP 管，「能跳去哪里」由两层白名单管，三者都是主进程模块，渲染层无法自行放开。

**CSP 响应头注入**——统一在 session 层拦截响应：

→ 源码：[packages/main/src/modules/security/csp.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/security/csp.ts)

```ts
const isDev = !import.meta.env.PROD;

// 标准宽松策略：允许自身、内联脚本/样式、eval、data/blob 协议、https 外部资源；
// 开发环境下额外允许 ws:// 和 http: 以支持 Vite HMR 和本地开发服务器
const cspPolicy = isDev
  ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http: ws:;"
  : "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:;";

defaultSession.webRequest.onHeadersReceived((details, callback) => {
  const responseHeaders = { ...details.responseHeaders };

  // 检查响应中是否已存在 CSP 头（大小写不敏感匹配）
  const existingKey = Object.keys(responseHeaders).find(
    (key) => key.toLowerCase() === 'content-security-policy',
  );

  if (existingKey) {
    const existingVal = responseHeaders[existingKey];
    const existingArray = Array.isArray(existingVal) ? existingVal : [existingVal];
    responseHeaders[existingKey] = [...existingArray, cspPolicy];
  } else {
    responseHeaders['Content-Security-Policy'] = [cspPolicy];
  }

  callback({ responseHeaders });
});

this.logger.info(`Content-Security-Policy configured (isDev=${isDev}): ${cspPolicy}`);
```

两个设计点：一是开发/生产两套策略，dev 额外放行 `ws:` 和 `http:` 给 Vite HMR 用，生产态收掉；二是已有 CSP 头是**追加**而不是覆盖，不破坏上游自带策略。要注意这套 CSP 是「默认防线」而非严格白名单——生产态仍允许 `https:` 外部资源和内联脚本，需要更严的项目应在此基础上收紧。

**外链白名单**——`window.open` 一律拒绝开新窗，只挑白名单里的源交给系统浏览器：

→ 源码：[packages/main/src/modules/security/external-urls.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/security/external-urls.ts)

```ts
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);

      // 仅允许安全的网络协议
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        this.logger.warn(`Blocked non-http(s) protocol navigation: ${url}`);
        return { action: 'deny' };
      }

      if (this.externalUrls.has(parsedUrl.origin)) {
        shell.openExternal(url).catch((err) => {
          this.logger.error('Failed to open external URL:', err);
        });
      } else {
        this.logger.warn(
          `Blocked opening of a disallowed external origin: ${parsedUrl.origin}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Malformed or invalid URL received: ${url}`, err);
    }

    // Prevent creating a new window.
    return { action: 'deny' };
  });
});
```

注意兜底逻辑：不管 URL 长什么样、是否在白名单里，`setWindowOpenHandler` 恒返回 `{ action: 'deny' }`——应用内永远不会冒出新窗口，白名单只决定「要不要转交系统浏览器」。

白名单本体是 shared 里的常量，判定权只在主进程：

→ 源码：[packages/shared/src/constants/security.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/constants/security.ts)

```ts
export const ALLOWED_EXTERNAL_URLS = [
  'https://github.com',
  'https://vite.dev',
  'https://react.dev',
] as const;
```

**导航白名单**——页面内跳转同样设卡，非白名单 origin 直接 `preventDefault`：

→ 源码：[packages/main/src/modules/security/block-origins.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/security/block-origins.ts)

```ts
contents.on('will-navigate', (event, url) => {
  const parsed = new URL(url);
  if (parsed.protocol === 'file:') {
    return;
  }

  const { origin } = parsed;
  if (this.allowedOrigins.has(origin)) {
    return;
  }

  // Prevent navigation
  event.preventDefault();

  this.logger.warn(`Blocked navigating to disallowed origin: ${origin}`);
});
```

装配处在主进程入口，白名单按环境区分：开发态放行 Vite dev server，生产态只放行本地页面自身（`file://` 与 `'null'`）：

→ 源码：[packages/main/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/index.ts)

```ts
.init(
  allowInternalOrigins(
    new Set(
      devServer
        ? [new URL(devServer).origin]
        : [
            initConfig.windows.home instanceof URL ? initConfig.windows.home.origin : 'file://',
            'null',
          ],
    ),
  ),
)
.init(allowExternalUrls(new Set(ALLOWED_EXTERNAL_URLS)));
```

## 怎么抄

以新增外链为例：

1. **外链先入白名单**：域名加进 shared 的 `ALLOWED_EXTERNAL_URLS`；需要页面内跳转的 origin 加进 `allowInternalOrigins` 的集合；渲染层不做也不做任何放行判定

注意点：

- CSP 是追加不是覆盖——response 里已有多份 CSP 时它们同时生效，别指望后注入的策略能放开上游收紧的规则
- 这套 CSP 是默认防线，生产态仍放行 `https:` 与内联脚本；有更高要求的场景应在此基础上逐源收紧
- 外链与导航的判定只在主进程：白名单常量虽放 shared，渲染层拿到的永远是「点链接」这一个动作，没有绕过判定面的通道
