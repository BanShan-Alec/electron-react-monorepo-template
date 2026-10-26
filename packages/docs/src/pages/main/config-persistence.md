# 配置持久化（electron-store）

> **TL;DR**：运行期配置落盘到 userData，zod 校验兜住坏文件与非法更新。

## 要解决的坑

运行期偏好（主题、语言、关闭行为、自动更新、计数器累计值）要跨重启保留，但磁盘上的配置文件不可信：用户可能改出非法 JSON，旧版本残留的键可能对不上新 schema，局部更新的入参也可能是脏的。把这种文件直接读进内存，轻则类型错位，重则启动即抛错。构建期配置（tsconfig、Biome、Vite）在编译前就已固化，不参与运行期读写；两者的分工见 [编译配置继承（tsconfig）](/engineering/tsconfig-inheritance)。

## 本仓库的解法

### 1. schema 定义字段、默认值与更新入参

→ 源码：[packages/shared/src/schemas/config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/config.ts)

```ts
export const configBaseSchema = z.object({
  theme: z.enum(THEME_MODES),
  minimizeToTray: z.boolean(),
  language: z.enum(SUPPORTED_LOCALES),
  autoCheckUpdate: z.boolean(),
  serverCounter: z.number().int(),
});

export const configSchema = z.object({
  theme: z.enum(THEME_MODES).default(DEFAULT_THEME_MODE),
  minimizeToTray: z.boolean().default(true),
  language: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
  autoCheckUpdate: z.boolean().default(true),
  serverCounter: z.number().int().default(0),
});

export type AppConfig = z.infer<typeof configSchema>;

export const updateConfigInputSchema = configBaseSchema.partial();
export type UpdateConfigInput = z.infer<typeof updateConfigInputSchema>;

// 默认值单一来源：由 configSchema 各字段的 .default() 派生，勿在此手写字面量
export const DEFAULT_CONFIG: AppConfig = configSchema.parse({});
```

`configSchema` 的每个字段都带 `.default()`：磁盘文件缺键时由 zod 补齐，不会因为旧版本少写一个字段就整份报废。更新入参单独用 `configBaseSchema.partial()` 表达——字段全可选，但出现即按同一套枚举与类型校验。`DEFAULT_CONFIG` 不手写字面量，而是 `configSchema.parse({})` 的结果，默认值只有 schema 这一处来源。

### 2. 加载期自愈：坏 JSON 与校验失败都重置默认

→ 源码：[packages/main/src/modules/config.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/config.module.ts)

```ts
  // conf 构造期即读取整个文件，JSON 语法损坏会直接抛错：
  // 用默认值覆盖坏文件后重试一次，仍失败则退化为仅内存模式，不阻塞启动
  private openStore(customDir?: string): Store<AppConfig> | null {
    try {
      return new Store<AppConfig>({ cwd: customDir });
    } catch (error) {
      this.logError('Config reset to defaults: config file is not valid JSON:', error);
    }
    try {
      const dir = customDir ?? (app ? app.getPath('userData') : undefined);
      if (dir) {
        fs.writeFileSync(
          path.join(dir, 'config.json'),
          JSON.stringify(DEFAULT_CONFIG, null, '\t'),
          'utf-8',
        );
      }
      return new Store<AppConfig>({ cwd: customDir });
    } catch (error) {
      this.logError('Config reset failed to persist, running with defaults in memory only:', error);
      return null;
    }
  }
```

`electron-store` 在构造期就读取整个文件，JSON 语法损坏会直接抛错。`openStore` 先按原样打开；抛错时落一条 error 日志，把 `DEFAULT_CONFIG` 写回 `config.json` 再重试一次。重置本身也失败（目录不可写等）就退化为 `null`——配置只在内存里用默认值，应用照常启动。

语法合法但字段不合规的文件由第二道防线处理：

```ts
  private loadConfig(): AppConfig {
    if (!this.store) {
      return { ...DEFAULT_CONFIG };
    }
    const parsed = configSchema.safeParse(this.store.store);
    if (parsed.success) {
      return parsed.data;
    }
    // 检验失败即重置：默认值立即写回，覆盖坏文件
    this.logError(
      'Config reset to defaults: on-disk config failed schema validation:',
      parsed.error.issues,
    );
    try {
      this.store.store = { ...DEFAULT_CONFIG };
    } catch (error) {
      this.logWarn('Config write failed:', error);
    }
    return { ...DEFAULT_CONFIG };
  }
```

`safeParse` 失败时同样落 error 日志（带上 zod 的 `issues`），把默认值整份写回，再返回默认值。缺键的文件不算失败——`.default()` 会在 parse 时补齐。

`new Store<AppConfig>({ cwd: customDir })` 不传 `name`，electron-store 的默认文件名是 `config`，最终落成 userData 下的 `config.json`；重置分支里写死的也是 `config.json`。

### 3. 写入路径：先校验，再整对象落盘

```ts
  public set(partial: Partial<AppConfig>): AppConfig {
    // IPC 入口已校验，此处兜住非 IPC 直连调用方（如 counter.service）：
    // 非法输入拒绝并留痕，不抛错不断链路
    const parsed = configSchema.safeParse({ ...this.config, ...partial });
    if (!parsed.success) {
      this.logWarn('Invalid config update rejected:', parsed.error.issues);
      return { ...this.config };
    }
    this.config = parsed.data;
    this.persist();
    return { ...this.config };
  }

  private persist(): void {
    if (!this.store) return;
    try {
      // 整对象写回：顺带清掉磁盘上已废弃的残留键
      this.store.store = this.config;
    } catch (error) {
      this.logWarn('Config write failed:', error);
    }
  }
```

`set` 把当前配置与入参浅合并后重新过一遍完整 schema：非法值直接拒绝，落 warn 日志并返回当前配置，不抛错、不动磁盘；校验通过才替换内存快照并调用 `persist`。`counter.service` 这类非 IPC 调用方直接走 `set`，所以校验不能只靠 Controller。

`persist` 用 `this.store.store = this.config` 整对象写回，顺带清掉磁盘上已废弃的残留键；写失败只落 warn，内存里的新值保留，下一次成功写入会一并落盘。`enable()` 是空实现，模块注释写明原因：electron-store 每次 set 同步原子落盘，无需在 `before-quit` 里再做兜底刷盘。

### 4. 装配顺序与变更副作用

`ConfigStore` 本身就是一个 `AppModule`，在 `initApp` 的模块链里紧跟日志与 Sentry、排在 `createNativeThemeModule()` 之前注册：

→ 源码：[packages/main/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/index.ts)

```ts
  const moduleRunner = createModuleRunner()
    .init(createLogModule())
    .init(createSentryModule())
    .init(createConfigModule())
    .init(createNativeThemeModule())
    // ...
```

构造函数同步完成加载，所以 NativeTheme 模块在 `app.whenReady()` 里读 `getAppConfigStore().get('theme')` 时，拿到的是已经校验过的持久化值（→ 源码：[packages/main/src/modules/native-theme.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/native-theme.module.ts)）。

配置写入的业务编排在 `ConfigService`（→ 源码：[packages/main/src/services/config.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/config.service.ts)）：

```ts
  updateConfig(input: UpdateConfigInput): AppConfig {
    const updated = getAppConfigStore().set(input);
    if (input.theme !== undefined) {
      // 主题偏好变更即时同步系统级主题（nativeTheme），无需重启即原生 UI 生效
      applyNativeThemeSource(input.theme);
    }
    if (input.language !== undefined) {
      // 语言偏好变更即时同步托盘菜单文案
      getTrayManager().updateLanguage(input.language);
    }
    this.logger.info('App config updated:', input);
    return updated;
  }
```

`updateConfig` 先落盘，再按变更字段同步副作用——`theme` 调 `applyNativeThemeSource` 立即改系统级主题，`language` 调 `getTrayManager().updateLanguage` 重刷托盘菜单文案。Controller 在 IPC 边界先用 `updateConfigInputSchema` 校验，再调 Service，成功后 `broadcast(CONFIG_EVENT_CHANGED, updated)` 把新配置推给所有窗口（→ 源码：[packages/main/src/controllers/config.controller.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/controllers/config.controller.ts)）。

渲染层 `useAppConfig` 挂载时拉 `config.get`，更新走 `config.update`（部分字段），恢复默认走 `config.reset`。

### 5. 临时目录注入让持久化可单测

`ConfigStore` 构造函数接受 `customDir`，单测用临时目录建实例，不碰真实 userData（→ 源码：[packages/main/tests/unit/config-store.test.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/tests/unit/config-store.test.ts)）：

```ts
  it('persists set() to disk and survives reload', () => {
    const store = new ConfigStore(dataDir);
    store.set({ theme: 'dark', serverCounter: 42 });
    const reloaded = new ConfigStore(dataDir);
    expect(reloaded.get('theme')).toBe('dark');
    expect(reloaded.get('serverCounter')).toBe(42);
  });
```

写入后新建实例重读，验证跨实例持久化；预置坏 JSON 或超范围字段，验证重置与 error 日志；非法 `set` 后读磁盘，验证内存状态与文件都没被改。

## 怎么抄

1. **shared 定义 schema**：字段加 `.default()`，更新入参用 `.partial()`，`DEFAULT_CONFIG = configSchema.parse({})`
2. **main 建 ConfigStore**：坏 JSON 先重置再重试，schema 失败重置并落 error 日志，`set` 校验通过后才持久化，整对象写回
3. **Service/Controller 编排副作用**：主题与语言变更后同步 nativeTheme 和托盘，IPC 边界先过 `updateConfigInputSchema`，成功后广播变更
4. **renderer 读写**：`config.get` 拉取、`config.update` 局部更新、`config.reset` 恢复默认

注意点：

- 配置文件是 userData 下的 `config.json`；要改文件名或目录就在 `new Store({ cwd })` 处统一改，重置分支里写死的文件名也要同步
- 日志统一走 `getLogManager().scoped(this)`，且 `logScoped` 用 try/catch 包住——日志系统自身不可用时不能让配置链路跟着挂
- `set` 对非法输入是「拒绝并返回当前配置」，不是抛错；需要把校验错误返回给渲染层时，在 Controller 边界先用 schema 拦
- `getAppConfigStore` 是单例，`customDir` 只在首次创建时生效；测试里直接 `new ConfigStore(dataDir)`
- 构建期配置（tsconfig / Biome / Vite）不进 `config.json`；运行期偏好才归 ConfigStore 管
