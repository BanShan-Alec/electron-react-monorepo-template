# 模板新项目定制速查清单 (Rebranding Checklist)

本模板已实现全链路应用标识的**双轨动态继承**（以根目录 `package.json` 为默认事实源，支持 `.env` 环境变量优先覆盖，本地构建自动安全兜底）。

当使用本模板创建新项目时，只需遵照以下轻量速查清单，替换对应配置与资源文件即可完成品牌重塑（Rebranding）：

---

## 1. 核心应用元数据（根目录 `package.json`）

在根目录 [`package.json`](file:///h:/electron-app-temp5/package.json) 中更新以下关键字段：

| 字段 | 说明与影响范围 | 示例值 |
| :--- | :--- | :--- |
| **`name`** | Monorepo 根包标识（小写+连字符） | `"my-desktop-app"` |
| **`productName`** | **应用主显示名**（自动同步至主进程窗口标题、系统托盘提示、NSIS 桌面快捷方式名称与前端 Header 界面） | `"My Awesome App"` |
| **`appId`** | **应用唯一标识**（反向域名格式，影响 Windows AUMID 通知归属、macOS Bundle Identifier 与快捷方式） | `"com.mycompany.awesomeapp"` |
| **`description`** | 应用简要描述 | `"现代化业务桌面客户端"` |
| **`author`** | 维护者名称与邮箱 | `{ "name": "YourName", "email": "you@example.com" }` |
| **`repository.url`** | 目标代码仓库地址（`electron-builder` 会自动解析 owner 与 repo 作为 OTA 自动更新来源） | `"https://github.com/my-org/my-app.git"` |

> [!NOTE]
> 子包（`packages/main`, `packages/renderer`, `packages/shared`, `packages/preload`）默认采用 `@app/*` 命名空间，属于 Monorepo 内部工程骨架，通常无需做改动。

---

## 2. 环境变量与发布配置（`.env`）

从 [`.env.example`](file:///h:/electron-app-temp5/.env.example) 复制生成本地 `.env` 文件，按需微调：

| 环境变量 | 作用与默认行为 | 示例 |
| :--- | :--- | :--- |
| `APP_NAME` | *(选填)* 动态覆盖应用显示名称（未填时继承 `package.json` 的 `productName`） | `My Awesome App` |
| `APP_ID` | *(选填)* 动态覆盖 App ID（未填时继承 `package.json` 的 `appId`） | `com.mycompany.awesomeapp` |
| `GITHUB_OWNER` | *(选填)* GitHub Release 发布组织/用户名（未填时自动从 `repository.url` 解析） | `my-org` |
| `GITHUB_REPO` | *(选填)* GitHub Release 发布仓库名（未填时自动从 `repository.url` 解析） | `my-app` |
| `API_BASE_URL` | 后端业务网关基准地址 | `https://api.mycompany.com` |
| `SENTRY_DSN` | *(选填)* 生产环境崩溃日志监控上报 DSN | `https://xxx@sentry.io/123` |

---

## 3. 多端图标与视觉资源替换

请替换以下资源文件为你自己的品牌视觉设计：

### 桌面客户端原生图标 ([`build/resources/`](file:///h:/electron-app-temp5/build/resources))
- **`icon.ico`** (Windows)：包含 16×16、32×32、48×48、256×256 多分辨率图层的 ICO 图标。
- **`icon.icns`** (macOS)：包含 16×16 至 1024×1024 尺寸的 Apple ICNS 图标。
- **`icon.png`** (Linux & 基础图标源)：建议 512×512 或 1024×1024 的透明背景 PNG 图标。

### 渲染进程界面资源 ([`packages/renderer/`](file:///h:/electron-app-temp5/packages/renderer))
- **`public/favicon.svg`**：前端标签页图标，同时作为**首屏渐进式加载壳 Logo**（构建期自动内联注入，实现秒级渐进启动动画）。

---

## 4. Git 历史与版本发布重置

如果是通过 Git Clone 或模板导入的新仓库，建议重置本地 Git 提交与版本日志：

1. **重置 Git 提交历史**：
   ```bash
   rm -rf .git
   git init
   git add .
   git commit -m "feat: 项目初次从模板脚手架初始化"
   ```
2. **重置变更日志**：
   - 清空或重置 [`CHANGELOG.md`](file:///h:/electron-app-temp5/CHANGELOG.md) 为全新的起点。
3. **更新项目主介绍**：
   - 更新根目录 [`README.md`](file:///h:/electron-app-temp5/README.md) 的产品介绍与技术描述。
