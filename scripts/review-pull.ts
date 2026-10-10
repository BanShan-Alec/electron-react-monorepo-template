/**
 * 本地拉取 AI Code Review 结果并生成结构化高优看板。
 *
 * 核心功能：
 * 1. 自动定位当前分支对应的 PR 与最新 OpenCodeReview CI 运行记录；
 * 2. 下载审查产物 ocr-result.json 并解析；
 * 3. 严格过滤：高危 (High) 与中危 (Medium) 重点排版展示，低危 (Low) 聚合为一句话概括；
 * 4. 产出到项目临时目录 .temp/review-dashboard.md，供开发者快速判断并驱动 Agent 修复。
 *
 * 遵循项目工程规范：纯 CommonJS 模式，使用 require('node:xxx')。
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TEMP_DIR = path.resolve('.temp');
const OUTPUT_FILE = path.join(TEMP_DIR, 'review-dashboard.md');
const ARTIFACT_CACHE_DIR = path.join(TEMP_DIR, 'ocr-cache');

function fail(message: string): never {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`);
  process.exit(1);
}

function probe(cmd: string, args: string[]): string | null {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  if (result.error || result.status !== 0) return null;
  return (result.stdout ?? '').trim();
}

function ensureGh(): void {
  if (probe('gh', ['--version']) === null) {
    fail('gh cli 不可用，请先安装 GitHub CLI 并完成登录');
  }
}

interface OcrComment {
  path: string;
  start_line?: number;
  end_line?: number;
  line?: number;
  content: string;
  category?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion_code?: string;
  existing_code?: string;
}

interface OcrResult {
  summary?: {
    files_reviewed?: number;
    comments?: number;
    elapsed?: string;
  };
  comments?: OcrComment[];
}

function getLatestRunId(branch: string): string {
  const runsJson = probe('gh', [
    'run',
    'list',
    '--workflow=open-code-review.yml',
    '--limit',
    '10',
    '--json',
    'databaseId,headBranch,status,conclusion',
  ]);

  if (!runsJson) {
    fail('未能检索到 OpenCodeReview 工作流记录');
  }

  try {
    const runs = JSON.parse(runsJson) as {
      databaseId: number;
      headBranch: string;
      status: string;
      conclusion: string;
    }[];

    const matched = runs.find((r) => r.headBranch === branch);
    if (!matched) {
      fail(`分支 ${branch} 尚未匹配到任何 OpenCodeReview 运行记录`);
    }
    return String(matched.databaseId);
  } catch (e: unknown) {
    fail(`解析工作流列表失败: ${(e as Error).message}`);
  }
}

function fetchOcrResult(runId: string): OcrResult {
  if (!fs.existsSync(ARTIFACT_CACHE_DIR)) {
    fs.mkdirSync(ARTIFACT_CACHE_DIR, { recursive: true });
  }

  console.log(`→ 正在从 GitHub Actions 下载 Review 产物 (Run ID: ${runId})...`);
  const downloadResult = spawnSync('gh', ['run', 'download', runId, '-D', ARTIFACT_CACHE_DIR], {
    encoding: 'utf-8',
  });

  if (downloadResult.status !== 0) {
    fail(`下载 Review 产物失败: ${downloadResult.stderr || downloadResult.stdout}`);
  }

  // 寻找 ocr-result.json
  const findResultFile = (dir: string): string | null => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findResultFile(fullPath);
        if (found) return found;
      } else if (entry.name === 'ocr-result.json') {
        return fullPath;
      }
    }
    return null;
  };

  const jsonPath = findResultFile(ARTIFACT_CACHE_DIR);
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    fail('产物中未找到 ocr-result.json 文件，请确认 CI 是否执行完成');
  }

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(raw) as OcrResult;
  } catch (e: unknown) {
    fail(`解析 ocr-result.json 失败: ${(e as Error).message}`);
  }
}

function formatDashboard(branch: string, prNumber: string | null, data: OcrResult): string {
  const allComments = data.comments ?? [];
  const highItems = allComments.filter((c) => c.severity === 'critical' || c.severity === 'high');
  const mediumItems = allComments.filter((c) => c.severity === 'medium');
  const lowItems = allComments.filter((c) => c.severity === 'low');

  const lines: string[] = [];

  lines.push('# 🛡️ AI 代码质量高优看板 (Review Dashboard)');
  lines.push('');
  lines.push(
    `> **分支**: \`${branch}\`${prNumber ? ` | **PR**: [#${prNumber}](https://github.com/BanShan-Alec/electron-react-monorepo-template/pull/${prNumber})` : ''} | **生成时间**: ${new Date().toLocaleString()}`,
  );
  lines.push(
    `> **审查统计**: 审查文件 ${data.summary?.files_reviewed ?? 0} 个 | 发现问题 ${allComments.length} 项 (🔴 高危 ${highItems.length} · 🟡 中危 ${mediumItems.length} · 🟢 低优 ${lowItems.length})`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. 低优总结（一句话概括）
  if (lowItems.length > 0) {
    const cats = [...new Set(lowItems.map((c) => c.category).filter(Boolean))].join(', ');
    lines.push('### 💡 低优建议概述 (自动收敛)');
    lines.push(
      `> 共检出 **${lowItems.length}** 条低优先级项（涵盖 ${cats || '代码风格与次要重构'}），主要涉及局部缓存、小组件拆分及类型显式导入等常规维护建议，**已自动收敛忽略，不阻塞核心交付**。`,
    );
    lines.push('');
  }

  // 2. 核心问题列表
  if (highItems.length === 0 && mediumItems.length === 0) {
    lines.push('### ✅ 审查结果');
    lines.push('**未发现任何中高危代码缺陷或安全隐患，代码质量优秀！**');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('### 🎯 核心问题聚焦与处置清单 (High / Medium)');
  lines.push('勾选 `[x]` 表示确认采纳修复，可在下方给 AI Agent 留言具体修改偏好：');
  lines.push('');

  const renderSection = (title: string, icon: string, items: OcrComment[], startIdx: number) => {
    if (items.length === 0) return startIdx;
    lines.push(`#### ${icon} ${title} (${items.length} 项)`);
    lines.push('');

    items.forEach((item, i) => {
      const idx = startIdx + i;
      const lineNum = item.start_line || item.line || '未知行';
      const fileLoc = `${item.path}#L${lineNum}`;
      lines.push(
        `##### Issue #${idx}: \`${item.path}\` (${lineNum} 行) - [${item.category?.toUpperCase() || 'DEFECT'}]`,
      );
      lines.push(`- [ ] **采纳修复** <!-- target: issue-${idx} -->`);
      lines.push(`- **位置**: [\`${fileLoc}\`](file:///${item.path.replace(/\\/g, '/')})`);
      lines.push(`- **问题说明**: ${item.content}`);

      if (item.suggestion_code) {
        lines.push('');
        lines.push('<details><summary>💡 展开查看推荐修复方案</summary>');
        lines.push('');
        if (item.existing_code) {
          lines.push('**原代码:**');
          lines.push('```ts');
          lines.push(item.existing_code);
          lines.push('```');
        }
        lines.push('**建议修改:**');
        lines.push('```ts');
        lines.push(item.suggestion_code);
        lines.push('```');
        lines.push('</details>');
      }
      lines.push('');
      lines.push(
        '> **人工批注 / 修改要求**: _（若有特殊要求在此输入，例如：保持向后兼容/按方案A修复）_',
      );
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    return startIdx + items.length;
  };

  let currentIdx = 1;
  currentIdx = renderSection('高危缺陷 (Critical / High)', '🔴', highItems, currentIdx);
  renderSection('中度风险 (Medium)', '🟡', mediumItems, currentIdx);

  lines.push('## 🤖 联动 Agent 修复指南');
  lines.push('在当前项目与 AI Agent 对话时，直接发送以下指令即可启动精准修复：');
  lines.push('```text');
  lines.push(
    '请根据 .temp/review-dashboard.md 中勾选采纳的 Issue 进行修复，忽略未勾选或低优项，修改完成后运行本地测试。',
  );
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function main(): void {
  ensureGh();

  const branch = probe('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || '';
  if (!branch) fail('无法获取当前 Git 分支名');

  const prInfoRaw = probe('gh', ['pr', 'view', branch, '--json', 'number']);
  const prNumber = prInfoRaw ? JSON.parse(prInfoRaw).number : null;

  console.log(`🔍 当前分支: ${branch} ${prNumber ? `(PR #${prNumber})` : ''}`);

  const runId = getLatestRunId(branch);
  const data = fetchOcrResult(runId);

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const markdown = formatDashboard(branch, prNumber, data);
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf-8');

  // 清理 cache
  if (fs.existsSync(ARTIFACT_CACHE_DIR)) {
    fs.rmSync(ARTIFACT_CACHE_DIR, { recursive: true, force: true });
  }

  console.log('\n\x1b[32m✔ 成功拉取并生成高优 Review 看板！\x1b[0m');
  console.log(`📄 看板路径: \x1b[36m${OUTPUT_FILE}\x1b[0m\n`);

  const comments = data.comments ?? [];
  const highCount = comments.filter(
    (c) => c.severity === 'critical' || c.severity === 'high',
  ).length;
  const mediumCount = comments.filter((c) => c.severity === 'medium').length;
  const lowCount = comments.filter((c) => c.severity === 'low').length;

  console.log(
    `📊 简报概览: 🔴 高危 ${highCount} 项 | 🟡 中度 ${mediumCount} 项 | 🟢 低优 ${lowCount} 项 (已自动收敛)`,
  );
  console.log(
    '👉 可在编辑器中打开 .temp/review-dashboard.md 进行快速审阅与批注，随后交由 AI Agent 自动闭环修复。\n',
  );
}

if (require.main === module) {
  main();
}
