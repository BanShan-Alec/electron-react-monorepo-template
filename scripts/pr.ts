/**
 * PR 工作流命令:gh cli 的仓库级封装(见 .github/CICD.md「提交与 PR」「合并」与 ADR-0004)。
 *
 * 用法(pnpm 脚本映射):
 *   pnpm pr          开 PR:前置检查 → push -u → gh pr create(标题取分支首个提交,正文读模板)
 *   pnpm pr:merge    合并:等待门禁全绿 → squash 合并 → 删除远端分支
 *   pnpm pr:status   查看当前仓库 PR 与 checks 概览
 *
 * 前置:gh cli 已安装且完成一次性 `gh auth login` 认证(CICD.md「本地环境」)。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAIN_BRANCH = 'main';
const PR_TEMPLATE = path.resolve('.github', 'PULL_REQUEST_TEMPLATE.md');
const CHECKS_POLL_INTERVAL_MS = 15_000;
const CHECKS_MAX_POLLS = 40; // gh --watch 遇"checks 尚未上报"时的轮询上限 ≈ 10 分钟

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** 同步 sleep(脚本整体同步风格,轮询 checks 间隙用) */
function sleepSync(ms: number): void {
  spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`], { stdio: 'ignore' });
}

/** 执行命令,继承 stdio 展示进度;非零退出即终止脚本 */
function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error) fail(`无法执行 ${cmd}:${result.error.message}(是否已安装并在 PATH 中?)`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** 静默执行取 stdout(trim);非零退出返回 null,用于探测类调用 */
function probe(cmd: string, args: string[]): string | null {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  if (result.error || result.status !== 0) return null;
  return (result.stdout ?? '').trim();
}

function requireGh(): void {
  if (probe('gh', ['--version']) === null) {
    fail('gh cli 不可用:先 winget install GitHub.cli(见 .github/CICD.md「本地环境」)');
  }
  if (probe('gh', ['auth', 'status']) === null) {
    fail('gh 未认证:运行 gh auth login 完成一次性认证(见 .github/CICD.md「本地环境」)');
  }
}

/** 公共前置:gh 可用、工作区干净、当前在非 main 分支;返回当前分支名 */
function preflight(): string {
  requireGh();
  if (probe('git', ['status', '--porcelain']) !== '') {
    fail('工作区存在未提交变更:先 commit 或 stash');
  }
  const branch = probe('git', ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '';
  if (!branch || branch === MAIN_BRANCH || branch === 'HEAD') {
    fail(`当前分支 "${branch || 'detached HEAD'}",请在 feature 分支上执行(分支规范见 CICD.md)`);
  }
  return branch;
}

function createPr(): void {
  const branch = preflight();
  run('git', ['fetch', 'origin', MAIN_BRANCH]);
  const subjects =
    probe('git', ['log', '--reverse', '--format=%s', `origin/${MAIN_BRANCH}..HEAD`]) ?? '';
  const title = subjects.split('\n')[0]?.trim() ?? '';
  if (!title) fail(`分支上没有相对 ${MAIN_BRANCH} 的提交,无从生成 PR 标题`);
  if (probe('gh', ['pr', 'view', branch, '--json', 'number']) !== null) {
    fail(`分支 ${branch} 已有 PR:直接 push 即可更新,查看用 pnpm pr:status`);
  }

  console.log(`→ push -u origin ${branch}`);
  run('git', ['push', '-u', 'origin', 'HEAD']);

  console.log('→ gh pr create(标题 = 分支首个提交,正文 = PR 模板)');
  const args = ['pr', 'create', '--base', MAIN_BRANCH, '--head', branch, '--title', title];
  if (fs.existsSync(PR_TEMPLATE)) {
    args.push('--body-file', PR_TEMPLATE);
  } else {
    args.push('--fill');
  }
  run('gh', args);
  console.log('\n后续:门禁在 GitHub Actions 运行,全绿后 pnpm pr:merge');
}

/** 等待门禁:0=全绿;8=checks 尚未上报(轮询等 Actions 启动);其他=有失败 */
function waitForChecks(branch: string): void {
  for (let poll = 1; poll <= CHECKS_MAX_POLLS; poll++) {
    const result = spawnSync('gh', ['pr', 'checks', branch, '--watch', '--fail-fast'], {
      stdio: 'inherit',
    });
    if (result.status === 0) return;
    if (result.status === 8 && poll < CHECKS_MAX_POLLS) {
      console.log(
        `checks 尚未全部上报(${poll}/${CHECKS_MAX_POLLS}),${CHECKS_POLL_INTERVAL_MS / 1000}s 后重查…`,
      );
      sleepSync(CHECKS_POLL_INTERVAL_MS);
      continue;
    }
    if (result.status === 8) fail('等待 checks 上报超时,请到 Actions 页确认后再试');
    fail('门禁未通过:按上方输出定位失败项,修复后 push 重跑');
  }
}

/** 打印合并后的本地收尾指引(区分普通检出与 worktree 场景) */
function printCleanupHint(branch: string): void {
  const raw = probe('git', ['worktree', 'list', '--porcelain']);
  if (!raw) return;
  for (const block of raw.split('\n\n')) {
    const lines = block.split('\n');
    const wtPath = lines.find((l) => l.startsWith('worktree '))?.replace(/^worktree /, '');
    const isBranch = lines.some((l) => l === `branch refs/heads/${branch}`);
    if (!wtPath || !isBranch) continue;
    if (path.resolve(wtPath) === path.resolve(process.cwd())) {
      console.log(`\n收尾:git checkout ${MAIN_BRANCH} && git pull && git branch -d ${branch}`);
    } else {
      console.log(`\n收尾:git worktree remove ${wtPath} && git branch -d ${branch}`);
    }
    return;
  }
}

function mergePr(): void {
  const branch = preflight();
  if (probe('gh', ['pr', 'view', branch, '--json', 'number']) === null) {
    fail(`分支 ${branch} 还没有 PR:先 pnpm pr`);
  }
  console.log(`→ 等待 ${branch} 的门禁全绿…`);
  waitForChecks(branch);
  console.log('→ 门禁全绿,squash 合并并删除远端分支');
  run('gh', ['pr', 'merge', branch, '--squash', '--delete-branch']);
  printCleanupHint(branch);
}

function statusPr(): void {
  requireGh();
  run('gh', ['pr', 'status']);
}

const command = process.argv[2];
switch (command) {
  case 'create':
    createPr();
    break;
  case 'merge':
    mergePr();
    break;
  case 'status':
    statusPr();
    break;
  default:
    fail('用法:node scripts/pr.ts <create|merge|status>(对应 pnpm pr / pr:merge / pr:status)');
}
