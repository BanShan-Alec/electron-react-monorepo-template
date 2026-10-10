import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { OcrResult, RunInfo } from '../types.ts';
import { fail, probe, safeParseJson } from '../utils/process.ts';

export function getLatestRunInfo(branch: string, prNumber: number | null): RunInfo {
  const runsJson = probe('gh', [
    'run',
    'list',
    '--workflow=open-code-review.yml',
    '--limit',
    '20',
    '--json',
    'databaseId,headBranch,status,conclusion',
  ]);

  const allRuns =
    safeParseJson<
      {
        databaseId: number;
        headBranch: string;
        status: string;
        conclusion: string;
      }[]
    >(runsJson) || [];

  const branchRuns = allRuns.filter((r) => r.headBranch === branch || r.headBranch === 'main');
  const completedRuns = branchRuns.filter((r) => r.status === 'completed');

  // 优化 1: 优先从 PR sticky 评论中的 checkpoint 元数据直接获取最新的 run ID
  if (prNumber) {
    const commentsJson = probe('gh', ['pr', 'view', String(prNumber), '--json', 'comments']);
    const prCommentsData = safeParseJson<{ comments: { body: string }[] }>(commentsJson);
    if (prCommentsData?.comments) {
      const summaryComment = prCommentsData.comments.find(
        (c) => c.body.includes('<!-- ocr-checkpoint:') || c.body.includes('<!-- ocr-review-run:'),
      );
      if (summaryComment) {
        const match = summaryComment.body.match(/<!-- ocr-checkpoint:[^\s]+ ([A-Za-z0-9+/=]+) -->/);
        if (match) {
          try {
            const decoded = JSON.parse(Buffer.from(match[1], 'base64').toString('utf-8'));
            if (decoded.run) {
              const calculatedRound = Math.max(completedRuns.length, 1);
              return {
                id: String(decoded.run),
                round: calculatedRound,
                totalRuns: Math.max(branchRuns.length, calculatedRound),
                status: 'success',
              };
            }
          } catch {
            // fallback
          }
        }
      }
    }
  }

  if (completedRuns.length === 0) {
    fail('未找到已完成的 Review 任务');
  }

  const latest = completedRuns[0];
  return {
    id: String(latest.databaseId),
    round: completedRuns.length,
    totalRuns: branchRuns.length,
    status: latest.conclusion,
  };
}

export function fetchOcrResult(runId: string, cacheDir: string): OcrResult {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  console.log(`→ 正在从 GitHub Actions 下载 Review 产物 (Run ID: ${runId})...`);
  const downloadResult = spawnSync('gh', ['run', 'download', runId, '-D', cacheDir], {
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

  const jsonPath = findResultFile(cacheDir);
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

export function fetchPrComments(ownerRepo: string, prNumber: number | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!prNumber) return map;

  const raw = probe('gh', [
    'api',
    `repos/${ownerRepo}/pulls/${prNumber}/comments`,
    '--jq',
    '.[] | {path: .path, line: .line, original_line: .original_line, html_url: .html_url}',
  ]);

  if (!raw) return map;

  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  for (const line of lines) {
    try {
      const item = JSON.parse(line) as {
        path: string;
        line?: number;
        original_line?: number;
        html_url: string;
      };
      const commentLine = item.line || item.original_line;
      if (item.path && commentLine && item.html_url) {
        map.set(`${item.path}:${commentLine}`, item.html_url);
      }
    } catch {
      // 容错忽略单行解析失败
    }
  }

  return map;
}
