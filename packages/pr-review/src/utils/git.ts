import { fail, probe } from './process.ts';

export function ensureGh(): void {
  if (probe('gh', ['--version']) === null) {
    fail('gh cli 不可用: 请先安装 GitHub CLI 并完成登录');
  }
}

export function ensureGhAuth(): void {
  ensureGh();
  if (probe('gh', ['auth', 'status']) === null) {
    fail('gh 未认证: 运行 gh auth login 完成一次性认证');
  }
}

export function resolveOwnerRepo(): string {
  const ghRepo = probe('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  if (ghRepo) return ghRepo;

  const originUrl = probe('git', ['remote', 'get-url', 'origin']);
  if (originUrl) {
    const match = originUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }

  return 'BanShan-Alec/electron-react-monorepo-template';
}

export function getCurrentBranch(): string {
  return probe('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || '';
}

export function getHeadSha(): string {
  return probe('git', ['rev-parse', 'HEAD']) || 'HEAD';
}
