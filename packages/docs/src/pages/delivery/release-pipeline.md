# 发版流水线（Changelogen）

> **TL;DR**：changelogen 本地提版并锁 tag，CI 三平台以 `-p never` 构建，单一 publish job 统一发 Release

## 要解决的坑

- 发版靠手工：提版本、打 tag、三平台构建、发 Release，每步都可能漏，版本号和 tag 对不上一致性就崩

## 发版流水线：changelogen + tag 触发三平台发布

→ 源码：[package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json) · [.github/workflows/release.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/workflows/release.yml)

版本提升永远发生在本地，CI 不碰 `package.json` 的 version：

```json
"changelog": "changelogen",
"release": "changelogen --release",
"release:patch": "changelogen --release --patch",
"release:minor": "changelogen --release --minor",
"release:major": "changelogen --release --major"
```

`pnpm release:minor` 由 changelogen 依据 conventional commits 生成仓库根 CHANGELOG.md、发版提交，并把版本号与 git tag 锁定一致；push `v*` tag 即触发 Release 流水线。工作流头注释明确了这条纪律：CI 内不提升版本号，`package.json` 的版本由发版提交保证与 tag 一致。

构建矩阵三平台并行，全部以 `-p never` 只构建不发布：

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [windows-latest, macos-latest, ubuntu-latest]
# ...
- name: Build Application (Windows)
  if: runner.os == 'Windows'
  run: pnpm run build:win -- -p never
```

产物（exe / dmg / deb / zip + latest.yml + blockmap）先以 artifact 形式收集，`if-no-files-found: error` 防止静默丢产物。发布由独立 job 在三平台全部成功后统一执行：

```yaml
publish:
  name: Publish GitHub Release
  needs: build
  if: startsWith(github.ref, 'refs/tags/v')
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - name: Download all build artifacts
      uses: actions/download-artifact@v4
      with:
        path: release-artifacts
        merge-multiple: true

    - name: Create GitHub Release
      uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 # v2
      with:
        # 中文标题;正文首行给 CHANGELOG 导航(锚定 tag 版本),generate_release_notes 会把 PR 列表追加在其后
        name: ${{ github.ref_name }} 版本发布
        body: |
          📖 完整变更日志见 [CHANGELOG.md](${{ github.server_url }}/${{ github.repository }}/blob/${{ github.ref_name }}/CHANGELOG.md)
        files: release-artifacts/*
        generate_release_notes: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

三平台构建产物经 `download-artifact` 汇合（`merge-multiple: true`）后，由这一个 job 一次发出；正文首行放 CHANGELOG.md 导航（changelogen 生成的仓库根 CHANGELOG.md），PR 列表由 `generate_release_notes` 追加。手动 `workflow_dispatch` 只构建不发布，用于验证构建管线。

## 怎么抄

- **CI 与发版**：本地 `pnpm release:minor` 提版 + push tag，CI 三平台 `-p never` 构建、单一 publish job 发 Release
