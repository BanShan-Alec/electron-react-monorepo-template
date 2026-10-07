/**
 * PR 工作流命令:gh cli 的仓库级封装(见 .github/CICD.md「提交与 PR」「合并」与 ADR-0004)。
 *
 * 用法(pnpm 脚本映射):
 *   pnpm pr          开 PR:前置检查 → push -u → gh pr create(标题取分支首个提交,正文按模板自动生成)
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
    fail('gh cli 不可用:请先安装 gh cli (Windows: winget install GitHub.cli, macOS: brew install gh, Linux: 见 https://cli.github.com/)(见 .github/CICD.md「本地环境」)');
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

/**
 * 分支首个提交的 body(意图的来源);无则空串
 */
function firstCommitBody(range: string): string {
  const sha = (probe('git', ['log', '--reverse', '--format=%H', range]) ?? '').split('\n')[0] ?? '';
  if (!sha) return '';
  return probe('git', ['log', '-1', '--format=%b', sha]) ?? '';
}

/**
 * 生成 PR 正文:模板的 H2 节骨架 + 自动填充。
 * 意图 = 分支首个提交的 body(缺失则占位提示);改动 = 提交 subject 列表;人工验证 = 勾选占位。
 * 直接把模板当正文会导致「只有节标题没内容」——模板里的 HTML 注释渲染时不可见。
 * 模板文件缺失时退化为最小三节。
 */
function buildBody(commitList: string[], intent: string): string {
  const fills: Record<string, string> = {
    意图: intent || '_（提交里没提取到动机，编辑本节补一句）_',
    改动: commitList.map((s) => `- ${s}`).join('\n'),
    人工验证: '- [ ] （列出 CI 查不了的人工验证项；无则删掉本节）',
  };
  const template = fs.existsSync(PR_TEMPLATE) ? fs.readFileSync(PR_TEMPLATE, 'utf-8') : '';
  if (!template) {
    return `## 改动 / Changes\n\n${fills['改动'] ?? ''}\n\n## 人工验证 / Manual Verification\n\n${fills['人工验证']}\n`;
  }
  const out: string[] = [];
  for (const line of template.split('\n')) {
    if (!line.startsWith('## ')) continue; // 只留节骨架,注释与空行不进正文
    out.push(line, '');
    const key = Object.keys(fills).find((k) => line.includes(k));
    if (key) out.push(fills[key] ?? '', '');
  }
  return `${out.join('\n').trim()}\n`;
}

function createPr(): void {
  const branch = preflight();
  run('git', ['fetch', 'origin', MAIN_BRANCH]);
  const range = `origin/${MAIN_BRANCH}..HEAD`;
  const subjects = probe('git', ['log', '--reverse', '--format=%s', range]) ?? '';
  const commitList = subjects
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const title = commitList[0] ?? '';
  if (!title) fail(`分支上没有相对 ${MAIN_BRANCH} 的提交,无从生成 PR 标题`);
  if (probe('gh', ['pr', 'view', branch, '--json', 'number']) !== null) {
    fail(`分支 ${branch} 已有 PR:直接 push 即可更新,查看用 pnpm pr:status`);
  }

  console.log(`→ push -u origin ${branch}`);
  run('git', ['push', '-u', 'origin', 'HEAD']);

  const body = buildBody(commitList, firstCommitBody(range));
  console.log('→ gh pr create(标题 = 分支首个提交,正文 = 模板骨架 + 自动填充)');
  run('gh', [
    'pr',
    'create',
    '--base',
    MAIN_BRANCH,
    '--head',
    branch,
    '--title',
    title,
    '--body',
    body,
  ]);
  console.log('\n后续:门禁在 GitHub Actions 运行,全绿后 pnpm pr:merge');
  console.log('正文若有占位未填(意图/人工验证),用 gh pr edit --web 或 PR 页编辑补全');
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
