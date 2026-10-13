# 阶段一：项目初始化与品牌定制

本文档指导你完成开发环境准备和项目基础配置。

## 1. 解决什么问题

克隆新项目后，开发者经常遇到这三个问题：
- 依赖下载缓慢或失败。
- 需要修改多个文件才能更换应用名称和图标。
- 缺少环境配置文件导致程序无法启动。

本模板提供自动化机制，解决上述问题。

## 2. 准备开发环境

按以下步骤配置你的计算机：

1. 安装 Node.js 22 或更高版本。
2. 安装 pnpm 10 或更高版本：
   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```
3. 检查根目录下的 `.npmrc` 文件。文件必须包含淘宝镜像源配置：
   ```ini
   registry=https://registry.npmmirror.com
   ```
4. 安装项目所有依赖：
   ```bash
   pnpm install
   ```

## 3. 一处修改定制应用品牌

你只需要修改根目录的 `package.json` 文件。系统会自动同步所有配置：

```json
{
  "name": "my-desktop-app",
  "productName": "我的桌面应用",
  "appId": "com.company.myapp",
  "version": "1.0.0",
  "description": "应用功能描述"
}
```

修改后，以下配置自动更新：
- 窗口左上角标题与系统托盘提示文字。
- 安装包输出文件名与安装目录。
- 操作系统中的应用标识符与快捷方式名称。

更换应用图标时，替换 `build/resources/` 目录中的文件：
- Windows 系统图标：`build/resources/icon.ico`
- macOS 系统图标：`build/resources/icon.icns`
- 通用图标文件：`build/resources/icon.png`

## 4. 多环境配置文件

项目使用 `.env` 文件区分运行环境：

| 配置文件 | 适用场景 | 载入时机 |
| :--- | :--- | :--- |
| `.env` | 全局基础配置 | 所有环境默认读取 |
| `.env.development` | 本地开发环境 | 运行 `pnpm dev` 时读取 |
| `.env.production` | 打包生产环境 | 运行 `pnpm build` 时读取 |

### 环境变量使用规则
- 渲染进程使用的变量必须以 `VITE_` 开头。例如 `VITE_API_URL`。
- 主进程可以直接读取所有环境变量。例如 `process.env.SENTRY_DSN`。
- 不要将私钥提交到 Git 仓库。请在本地创建 `.env.local` 存放机密信息。

## 5. 避坑指南

- 运行 `pnpm install` 前不要删除 `.npmrc`。缺少镜像源会导致二进制包下载超时。
- 修改 `package.json` 中的 `appId` 时，只能使用小写英文字母、数字和英文句点。
- 在 Windows 系统中调试时，如果图标没有更新，请清理 Windows 图标缓存并重启系统。
