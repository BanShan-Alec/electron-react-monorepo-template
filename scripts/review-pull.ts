/**
 * 本地拉取 AI Code Review 结果并生成结构化高优看板。
 *
 * 核心功能：
 * 1. 自动定位当前分支对应的 PR 与最新已完成的 OpenCodeReview CI 运行记录；
 * 2. 依据 PR 编号动态命名产物：.github/pr-review-tmp/pr-<PR编号>-review.md；
 * 3. 智能识别二次/多次 Review 轮次：覆盖更新最新审查状态，并在头部明确标注复查轮次与增量结论；
 * 4. 处置规则：
 *    - 🔴 高危 & 🟡 中危：默认全部勾选采纳修复（- [x]），除非开发者批注忽略；
 *    - 🟢 低优建议：完整保留条目，但默认不修复（- [ ]），需开发者手动勾选才执行修复；
 * 5. 全面支持超链接跳转：包含 GitHub PR Review 评论直达链接与 GitHub 源码行链接；
 * 6. 产出到项目临时目录供开发者快速判断并驱动 Agent 修复。
 *
 * 遵循项目工程规范：纯 CommonJS 模式，使用 require('node:xxx')。
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REVIEW_TMP_DIR = path.resolve('.github', 'pr-review-tmp');
const ARTIFACT_CACHE_DIR = path.join(REVIEW_TMP_DIR, 'ocr-cache');

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

interface RunInfo {
  id: string;
  round: number;
  totalRuns: number;
  status: string;
}

interface GhReviewComment {
  path: string;
  line?: number;
  original_line?: number;
  html_url: string;
}

function getLatestRunInfo(branch: string): RunInfo {
  const runsJson = probe('gh', [
    'run',
    'list',
    '--workflow=open-code-review.yml',
    '--limit',
    '20',
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

    const branchRuns = runs.filter((r) => r.headBranch === branch);
    if (branchRuns.length === 0) {
      fail(`分支 ${branch} 尚未匹配到任何 OpenCodeReview 运行记录`);
    }

    const completedRuns = branchRuns.filter((r) => r.status === 'completed');
    const runningRun = branchRuns.find((r) => r.status === 'in_progress' || r.status === 'queued');

    if (completedRuns.length === 0 && runningRun) {
      fail(`当前审查任务 (Run ID: ${runningRun.databaseId}) 正在执行中，请稍候待其完成后再次拉取`);
    }

    if (completedRuns.length === 0) {
      fail(`分支 ${branch} 的 Review 任务尚未完成`);
    }

    if (runningRun) {
      console.log(
        `\x1b[33m⚠ 检测到最新一轮审查 (Run ID: ${runningRun.databaseId}) 仍在进行中，本次拉取展示最近已完成的一轮结果。\x1b[0m`,
      );
    }

    const latest = completedRuns[0];
    return {
      id: String(latest.databaseId),
      round: completedRuns.length,
      totalRuns: branchRuns.length,
      status: latest.conclusion,
    };
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

function fetchPrComments(ownerRepo: string, prNumber: number | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!prNumber) return map;

  const raw = probe('gh', [
    'api',
    `repos/${ownerRepo}/pulls/${prNumber}/comments`,
    '--jq',
    '.[] | {path: .path, line: .line, original_line: .original_line, html_url: .html_url}',
  ]);

  if (!raw) return map;

  try {
    const lines = raw.split('\n').filter(Boolean);
    for (const line of lines) {
      const item = JSON.parse(line) as GhReviewComment;
      if (item.path && item.html_url) {
        if (item.line) {
          map.set(`${item.path}:${item.line}`, item.html_url);
        }
        if (item.original_line) {
          map.set(`${item.path}:${item.original_line}`, item.html_url);
        }
      }
    }
  } catch {
    // 忽略解析错误，降级使用 blob 链接
  }

  return map;
}

function getOutputFilePath(branch: string, prNumber: number | null): string {
  const filename = prNumber
    ? `pr-${prNumber}-review.md`
    : `branch-${branch.replace(/[/\\:]/g, '-')}-review.md`;
  return path.join(REVIEW_TMP_DIR, filename);
}

function formatDashboard(
  branch: string,
  prNumber: number | null,
  ownerRepo: string,
  headSha: string,
  runInfo: RunInfo,
  data: OcrResult,
  commentMap: Map<string, string>,
): string {
  const allComments = data.comments ?? [];
  const highItems = allComments.filter((c) => c.severity === 'critical' || c.severity === 'high');
  const mediumItems = allComments.filter((c) => c.severity === 'medium');
  const lowItems = allComments.filter((c) => c.severity === 'low');

  const lines: string[] = [];

  const prTitle = prNumber ? `PR #${prNumber}` : `分支 ${branch}`;
  lines.push(`# 🛡️ AI 代码质量评审看板 (${prTitle})`);
  lines.push('');
  lines.push(
    `> **分支**: \`${branch}\`${prNumber ? ` | **PR 页面**: [#${prNumber}](https://github.com/${ownerRepo}/pull/${prNumber})` : ''}`,
  );
  lines.push(
    `> **审查轮次**: **第 ${runInfo.round} 轮复查** (Run ID: \`${runInfo.id}\`) | **刷新时间**: ${new Date().toLocaleString()}`,
  );
  lines.push(
    `> **审查统计**: 审查文件 ${data.summary?.files_reviewed ?? 0} 个 | 发现问题 ${allComments.length} 项 (🔴 高危 ${highItems.length} · 🟡 中危 ${mediumItems.length} · 🟢 低优 ${lowItems.length})`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // 处置规则摘要说明
  lines.push('### 📋 处置规则说明');
  lines.push(
    '- **🔴 高危 & 🟡 中度问题**：**默认全部采纳修复 (`[x]`)**。若某项属预期设计或需忽略，请取消勾选并在批注中注明。',
  );
  lines.push('- **🟢 低优常规建议**：**默认全部忽略 (`[ ]`)**。如需修复请手动勾选为 `[x]`。');
  lines.push('');

  // 全绿状态
  if (highItems.length === 0 && mediumItems.length === 0 && lowItems.length === 0) {
    lines.push('### 🎉 审查通过 (All Clear)');
    lines.push(
      `**第 ${runInfo.round} 轮审查未发现任何代码缺陷或安全隐患，先前的修复已生效通过，代码质量优秀！**`,
    );
    lines.push('');
    return lines.join('\n');
  }

  // 渲染通用 Issue 卡片
  const renderItemCard = (item: OcrComment, idx: number, isDefaultFixed: boolean) => {
    const lineNum = item.start_line || item.line || 1;
    const fileLoc = `${item.path}#L${lineNum}`;
    const commentKey = `${item.path}:${lineNum}`;
    const ghCommentUrl = commentMap.get(commentKey);
    const ghBlobUrl = `https://github.com/${ownerRepo}/blob/${headSha}/${item.path}#L${lineNum}`;

    lines.push(
      `##### Issue #${idx}: \`${item.path}\` (${lineNum} 行) - [${item.category?.toUpperCase() || 'DEFECT'}]`,
    );

    if (isDefaultFixed) {
      lines.push(`- [x] **采纳修复 (默认修复)** <!-- action: fix -->`);
      lines.push(`- [ ] **忽略本项** <!-- action: ignore -->`);
    } else {
      lines.push(`- [ ] **手动采纳修复 (默认忽略)** <!-- action: manual-fix -->`);
    }

    // 超链接体系
    const links: string[] = [];
    if (ghCommentUrl) {
      links.push(`💬 [查看 GitHub PR 讨论](${ghCommentUrl})`);
    }
    links.push(`🌐 [在 GitHub 查看代码](${ghBlobUrl})`);
    links.push(`💻 [本地跳转: ${fileLoc}](file:///${item.path.replace(/\\/g, '/')})`);

    lines.push(`- **导航**: ${links.join(' · ')}`);
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
      `> **人工批注 / 修改要求**: _(${isDefaultFixed ? '默认修复；如需忽略或有定制要求请在此说明' : '默认忽略；若勾选修复可在此输入具体要求'})_`,
    );
    lines.push('');
    lines.push('---');
    lines.push('');
  };

  let currentIdx = 1;

  // 1. 高危缺陷 (默认修复)
  if (highItems.length > 0) {
    lines.push(`### 🔴 高危缺陷 (Critical / High) - 默认修复 (${highItems.length} 项)`);
    lines.push('');
    for (const item of highItems) {
      renderItemCard(item, currentIdx++, true);
    }
  }

  // 2. 中度缺陷 (默认修复)
  if (mediumItems.length > 0) {
    lines.push(`### 🟡 中度风险 (Medium) - 默认修复 (${mediumItems.length} 项)`);
    lines.push('');
    for (const item of mediumItems) {
      renderItemCard(item, currentIdx++, true);
    }
  }

  // 3. 低优建议 (默认忽略，手动勾选才修复)
  if (lowItems.length > 0) {
    lines.push(`### 🟢 低优建议 (Low / Style) - 默认忽略 · 需手动勾选修复 (${lowItems.length} 项)`);
    lines.push('');
    for (const item of lowItems) {
      renderItemCard(item, currentIdx++, false);
    }
  }

  const targetFilename = prNumber ? `pr-${prNumber}-review.md` : 'review-dashboard.md';
  lines.push('## 🤖 联动 Agent 修复指南');
  lines.push('在当前项目与 AI Agent 对话时，直接发送以下指令即可启动精准修复：');
  lines.push('```text');
  lines.push(
    `请根据 .github/pr-review-tmp/${targetFilename} 执行代码修复：\n` +
      `1. 对【高危】和【中度】区域标记为 [x] 的项默认全部执行修复，若有勾选忽略或留有人工批注则遵照批注处置；\n` +
      `2. 对【低优】区域默认全部忽略，仅修复被手动勾选 [x] 的项；\n` +
      `3. 修复完成后运行本地测试（pnpm test 与 pnpm test:e2e）验证通过。`,
  );
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function main(): void {
  ensureGh();

  const branch = probe('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || '';
  if (!branch) fail('无法获取当前 Git 分支名');

  const headSha = probe('git', ['rev-parse', 'HEAD']) || 'HEAD';
  const ownerRepo =
    probe('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']) ||
    'BanShan-Alec/electron-react-monorepo-template';

  const prInfoRaw = probe('gh', ['pr', 'view', branch, '--json', 'number']);
  const prNumber: number | null = prInfoRaw ? JSON.parse(prInfoRaw).number : null;

  console.log(`🔍 当前分支: ${branch} ${prNumber ? `(PR #${prNumber})` : ''}`);

  const runInfo = getLatestRunInfo(branch);
  const data = fetchOcrResult(runInfo.id);

  console.log('→ 正在获取 GitHub PR 评论讨论链接映射...');
  const commentMap = fetchPrComments(ownerRepo, prNumber);

  if (!fs.existsSync(REVIEW_TMP_DIR)) {
    fs.mkdirSync(REVIEW_TMP_DIR, { recursive: true });
  }

  const outputFile = getOutputFilePath(branch, prNumber);
  const markdown = formatDashboard(branch, prNumber, ownerRepo, headSha, runInfo, data, commentMap);
  fs.writeFileSync(outputFile, markdown, 'utf-8');

  // 清理 cache
  if (fs.existsSync(ARTIFACT_CACHE_DIR)) {
    fs.rmSync(ARTIFACT_CACHE_DIR, { recursive: true, force: true });
  }

  console.log(`\n\x1b[32m✔ 成功拉取并刷新第 ${runInfo.round} 轮高优 Review 看板！\x1b[0m`);
  console.log(`📄 看板路径: \x1b[36m${outputFile}\x1b[0m\n`);

  const comments = data.comments ?? [];
  const highCount = comments.filter(
    (c) => c.severity === 'critical' || c.severity === 'high',
  ).length;
  const mediumCount = comments.filter((c) => c.severity === 'medium').length;
  const lowCount = comments.filter((c) => c.severity === 'low').length;

  console.log(
    `📊 简报概览: 🔴 高危 ${highCount} 项 (默认修) | 🟡 中度 ${mediumCount} 项 (默认修) | 🟢 低优 ${lowCount} 项 (需手动勾选)`,
  );
  console.log(
    `👉 可在编辑器中打开 ${path.relative(process.cwd(), outputFile)} 审阅批注，随后交由 AI Agent 自动闭环修复。\n`,
  );
}

if (require.main === module) {
  main();
}
