---

title: 配置持久化（Electron-store）
description: 用户偏好落在 userData/config.json，Zod schema 唯一真源、写坏即重置；新增配置项需同步六处。
---

# 配置持久化（Electron-store）

> **TL;DR**：用户偏好存于 `userData/config.json`，由 `@app/shared` 的 schema 单一真源驱动——写坏即回默认、字段漂移不崩；新增一个配置项要同时改契约、副作用、消费、测试与词条，漏一层就是「能写进去但不生效」。

## 1. 选型理由

三条硬需求决定了选型：

1. **只有主进程碰磁盘**：渲染层经 IPC 读写，偏好值不必再过一趟进程边界。
2. **启动早期就要同步读**：主题、语言、托盘文案在模块初始化阶段用到，异步读者会引入启动时序竞争。
3. **坏文件要能自愈**：文件在 `userData` 下，用户可手工编辑、外部工具也可能改动。

| 备选                | 否决理由                                                   |
| :------------------ | :--------------------------------------------------------- |
| `localStorage`      | 渲染层私有，主进程启动早期读不到；多窗口各存一份，无法统一 |
| 自己 `fs.writeFile` | 校验、原子写、损坏兜底全要自造，最容易写出的就是「写一半」 |
| 直接读 `.env`       | 属于构建期资产，改一次要重新打包，也不进 `userData`        |

`electron-store` 一次给齐同步读写、原子落盘与 schema 校验，因此作为默认实现。

## 2. 核心机制

### schema 是唯一真源

→ 源码：[packages/shared/src/schemas/config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/config.ts)

```ts
export type AppConfig = z.infer<typeof configSchema>;
export const updateConfigInputSchema = configBaseSchema.partial();
export const DEFAULT_CONFIG: AppConfig = configSchema.parse({});
```

默认值只写在 `configSchema` 各字段的 `.default()` 里，`DEFAULT_CONFIG` 由它派生：重置、损坏兜底、纯内存降级三处消费同一个对象，仓库里不存在第二份默认值清单。`updateConfigInputSchema` 是 IPC 入参契约——可被前端更新的字段必须在 `configBaseSchema` 里也登记一次。

### 写路径：整对象替换 + 原子落盘

`ConfigStore.set()` 先 `safeParse({ ...当前值, ...增量 })`，通过才整对象写回；非法输入记 warn 后原样返回旧值，不抛错、不断链路（兜住 `counter.service` 这类非 IPC 直连调用方）。整对象写回顺带清掉旧版本残留键，删除一个字段只需从 schema 移除。

落盘是同步的：`electron-store` 每次 `set` 即写，没有退出前补写。底层 `conf` 经 `atomically` 以临时文件 + rename 替换，正常写入不会留下半截 [已脱敏]ON；只有手工编辑、跨盘或受限环境（退化直写）才可能产生坏文件——这正是下面两道自愈针对的场景。

### 读路径：两道自愈

1. **语法层**：`conf` 构造期读取整个文件，非法 [已脱敏]ON 直接抛错 → 用 `DEFAULT_CONFIG` 覆盖坏文件后重试一次；目录不可写则降级为纯内存，不阻塞启动。
2. **契约层**：`configSchema.safeParse` 失败（类型错误、越界、结构异常）→ 记 error 并带 `issues` → 立即把默认值写回磁盘。

两道都只重置、不自造：宁可回到默认值，也不带着非法配置启动。

### 新增一个配置项的完整链路

| 步骤      | 改哪里                                                                                                  | 漏掉的症状                                        |
| :-------- | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------ |
| 1. 契约   | `shared/schemas/config.ts`：`configSchema` 加字段（带 `.default()`）；可更新则同时进 `configBaseSchema` | 前端传了也被入参 schema 剥掉，永远写不进去        |
| 2. 副作用 | `services/config.service.ts`：需联动系统时（主题 / 语言 / 开机自启）在此同步                            | 值存了，界面与系统行为不变，重启才生效            |
| 3. 消费   | 渲染层 hook 与卡片组件，按需给兜底值                                                                    | 旧配置缺该键时 UI 渲染 `undefined`                |
| 4. 广播   | 主进程写后 `broadcast(CONFIG_EVENT_CHANGED, updated)`（已在 controller 统一处理）                       | 多窗口不同步（preload 已封装 `config.onChanged`） |
| 5. 测试   | `packages/main/tests/unit/config-store.test.ts`：默认值、非法值拒绝、重置                               | 契约回退无人守护                                  |
| 6. 词条   | 新增文案则 `pnpm i18n:extract` → 补英译 → `pnpm i18n:check`                                             | CI 直接失败                                       |

## 3. 桌面端避坑注意事项

- **不要在构造期读 store**：
  - 业务 Service 需要配置时必须在方法内懒加载 `getAppConfigStore()`，切勿在模块顶层 `new Service()` 的构造期读取，避免与主进程模块装配时序冲突。
- **不该放进 `config.json` 的东西**：
  - 密钥与令牌（属于系统钥匙串或环境变量注入）、大体积缓存（走 cache 目录）、构建期常量（`build/` 与 `.env`）、已有专门存储的状态（窗口几何在 `window-state.json`）。
- **归属判断不在本页**：
  - 一个值该落在哪一层，见 [配置项归属（Configuration-map）](/dx/configuration-map)；本页只讲「用户偏好」这一层的实现。
