# 跨平台桌面客户端代码签名与公证实战指南 (Code Signing & Notarization Guide)

本文档为基于 Electron + electron-builder 构建的桌面应用提供多操作系统（Windows、macOS、Linux）的代码签名（Code Signing）、公证（Notarization）以及自动化 CI/CD 配置指南。

---

## 目录

1. [为什么必须进行代码签名](#1-为什么必须进行代码签名)
2. [Windows 平台代码签名](#2-windows-平台代码签名)
   - [证书类型选择 (OV vs EV vs Azure Trusted Signing)](#21-证书类型选择)
   - [electron-builder 环境变量配置](#22-electron-builder-环境变量配置)
   - [现代方案：微软 Azure Trusted Signing](#23-现代方案微软-azure-trusted-signing)
3. [macOS 平台签名与公证 (Notarization)](#3-macos-平台签名与公证-notarization)
   - [苹果开发者证书与配置](#31-苹果开发者证书与配置)
   - [Hardened Runtime 与授权文件 (Entitlements)](#32-hardened-runtime-与授权文件-entitlements)
   - [使用 notarytool 进行自动公证](#33-使用-notarytool-进行自动公证)
4. [Linux 平台打包与校验](#4-linux-平台打包与校验)
5. [CI/CD (GitHub Actions) 自动化流水线最佳实践](#5-cicd-github-actions-自动化流水线最佳实践)

---

## 1. 为什么必须进行代码签名

未签名的桌面客户端在各主流操作系统上均受到极为严格的安全拦截：
- **Windows**：触发 Windows Defender SmartScreen “未知发布者”拦截蓝屏警告，甚至被杀毒软件直接隔离。
- **macOS**：自 macOS 10.15 Catalina 起强制要求应用不仅签名、还必须通过苹果官方公证（Notarization），未公证应用直接提示“已损坏，无法打开，你应该将它移到废纸篓”。
- **完整性防篡改**：代码签名保证了安装包与可执行文件在传输过程中未被中间人劫持或篡改。

---

## 2. Windows 平台代码签名

### 2.1 证书类型选择

| 证书类型 | 介质要求 | SmartScreen 初始声誉 | 成本与适用场景 |
| :--- | :--- | :--- | :--- |
| **标准代码签名 (OV)** | 2023年6月后强制硬件 Token (HSM) | 需积累下载量方可消除蓝屏 | 中小型个人/初创团队 |
| **增强代码签名 (EV)** | 必须使用物理加密狗 (YubiKey) 或云 HSM | **即时获得** SmartScreen 声誉，永不弹蓝屏 | 商业量产项目强烈推荐 |
| **Azure Trusted Signing** | 微软官方云端签名服务，无物理硬件依赖 | **即时获得** SmartScreen 声誉 | 现代化 CI/CD 首选方案 |

### 2.2 electron-builder 环境变量配置

如果使用标准的 PFX 证书文件（或 CI 中 Base64 编码）：

```bash
# 证书路径或 Base64 字符串
export CSC_LINK="path/to/certificate.pfx"
# 或者 Base64: export CSC_LINK="MIIK...="

# 证书解密私钥密码
export CSC_KEY_PASSWORD="your_private_key_password"
```

在 `build/electron-builder.ts` 中已预置相关配置，构建时 `electron-builder` 会自动检测环境变量并完成签名：
```javascript
export default {
  win: {
    target: ['nsis'],
    verifyUpdateCodeSignature: true,
    signingHashAlgorithms: ['sha256'],
    signAndEditExecutable: true,
  },
};
```

### 2.3 现代方案：微软 Azure Trusted Signing

传统 EV 证书需要物理硬件加密狗，无法顺畅融入 GitHub Actions 云端打包。微软推出官方云服务 **Trusted Signing**（原 Azure Code Signing）：
1. 在 Azure Portal 开通 Trusted Signing 账户并完成身份验证；
2. 在 GitHub Actions 中使用官方 Action：
```yaml
- name: Sign Windows Binary with Azure Trusted Signing
  uses: azure/trusted-signing-action@v0.5.1
  with:
    azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
    azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
    endpoint: https://eus.codesigning.azure.net/
    trusted-signing-account-name: my-signing-account
    certificate-profile-name: my-cert-profile
    files: |
      dist/win-unpacked/*.exe
      dist/*.exe
```

---

## 3. macOS 平台签名与公证 (Notarization)

### 3.1 苹果开发者证书与配置

1. 加入 **Apple Developer Program**；
2. 在 Apple Developer 后台申请并下载 **Developer ID Application** 证书并导入钥匙串；
3. 导出包含私钥的 `.p12` 证书文件并 Base64 编码备用。

### 3.2 Hardened Runtime 与授权文件 (Entitlements)

macOS 公证要求开启强化运行时（Hardened Runtime），在 `build/resources/entitlements.mac.plist` 中声明：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.debugger</key>
  <true/>
</dict>
</plist>
```

并在 `build/electron-builder.ts` 中配置：
```javascript
export default {
  mac: {
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/resources/entitlements.mac.plist',
    entitlementsInherit: 'build/resources/entitlements.mac.plist',
  },
};
```

### 3.3 使用 notarytool 进行自动公证

设置以下环境变量，`electron-builder` 在构建 DMG 或 ZIP 后会自动上传苹果服务器完成公证与装订（Staple）：

```bash
# 方案 A: 使用 App-Specific 专用密码
export APPLE_ID="developer@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="ABCDE12345"

# 方案 B: 使用 App Store Connect API Key (推荐)
export APPLE_API_KEY="path/to/AuthKey_XXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXX"
export APPLE_API_ISSUER="11111111-2222-3333-4444-555555555555"
```

---

## 4. Linux 平台打包与校验

Linux 常用包格式为 `.deb` 和 `.AppImage`。

- `.deb` 产物可通过标准 GPG 密钥签署 `Release` 与 `Packages` 索引，以便分发至 APT 源。
- `.AppImage` 支持自包含运行，使用 `appimagetool` 或 `electron-builder` 自带功能可将 GPG 签名直接嵌入：
```bash
export GPG_KEY_ID="0x12345678"
```

---

## 5. CI/CD (GitHub Actions) 自动化流水线最佳实践

在 GitHub 仓库的 **Settings > Secrets and variables > Actions** 中安全存放证书与凭据：

```yaml
name: Release App

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Run Tests
        run: npm run test

      - name: Build and Sign (Windows)
        if: matrix.os == 'windows-latest'
        env:
          CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
        run: npm run build:win

      - name: Build and Notarize (macOS)
        if: matrix.os == 'macos-latest'
        env:
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run build:mac

      - name: Build (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:linux
```
