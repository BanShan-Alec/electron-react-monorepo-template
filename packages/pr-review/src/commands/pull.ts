import fs from 'node:fs';
import path from 'node:path';
import { cleanOldReviewFiles } from '../core/cleaner.ts';
import { formatDashboard } from '../core/dashboard.ts';
import { findLatestReviewFile, parseExistingDashboard } from '../core/diff.ts';
import { fetchOcrResult, fetchPrComments, getLatestRunInfo } from '../core/ocr.ts';
import { ensureGh, getCurrentBranch, getHeadSha, resolveOwnerRepo } from '../utils/git.ts';
import { fail, probe, safeParseJson } from '../utils/process.ts';

// 产物收敛到 packages/pr-review/reviews 目录
const PACK_ROOT = path.resolve(__dirname, '../..');
const REVIEWS_DIR = path.join(PACK_ROOT, 'reviews');
const ARTIFACT_CACHE_DIR = path.join(REVIEWS_DIR, '.cache');

export function runPull(): void {
  ensureGh();

  const branch = getCurrentBranch();
  if (!branch) fail('无法获取当前 Git 分支名');

  const headSha = getHeadSha();
  const ownerRepo = resolveOwnerRepo();

  const prInfoRaw = probe('gh', ['pr', 'view', branch, '--json', 'number']);
  const prInfo = safeParseJson<{ number?: number }>(prInfoRaw);
  const prNumber: number | null = prInfo?.number ?? null;

  console.log(`🔍 当前分支: ${branch} ${prNumber ? `(PR #${prNumber})` : ''}`);

  const runInfo = getLatestRunInfo(branch, prNumber);

  try {
    const data = fetchOcrResult(runInfo.id, ARTIFACT_CACHE_DIR);

    console.log('→ 正在获取 GitHub PR 评论讨论链接映射...');
    const commentMap = fetchPrComments(ownerRepo, prNumber);

    if (!fs.existsSync(REVIEWS_DIR)) {
      fs.mkdirSync(REVIEWS_DIR, { recursive: true });
    }

    // 目标文件名：仅按轮次保存 pr-<PR>-round-<N>.md
    const safeBranch = branch.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = prNumber
      ? `pr-${prNumber}-round-${runInfo.round}.md`
      : `branch-${safeBranch}-round-${runInfo.round}.md`;
    const outputFile = path.join(REVIEWS_DIR, fileName);

    // 查找上一轮最近生成的看板（用于继承历史批注与已解决对比）
    const previousFile = findLatestReviewFile(REVIEWS_DIR, prNumber, branch);
    const historicalMap = previousFile ? parseExistingDashboard(previousFile) : new Map();

    const markdown = formatDashboard(
      branch,
      prNumber,
      ownerRepo,
      headSha,
      runInfo,
      data,
      commentMap,
      historicalMap,
    );
    fs.writeFileSync(outputFile, markdown, 'utf-8');

    // 触发清理机制：只保留最近 10 个 review md 文件
    cleanOldReviewFiles(REVIEWS_DIR);

    console.log(`\n\x1b[32m✔ 成功拉取并保存第 ${runInfo.round} 轮 Review 看板！\x1b[0m`);
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
  } finally {
    // 确保清理临时下载缓存
    if (fs.existsSync(ARTIFACT_CACHE_DIR)) {
      try {
        fs.rmSync(ARTIFACT_CACHE_DIR, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
