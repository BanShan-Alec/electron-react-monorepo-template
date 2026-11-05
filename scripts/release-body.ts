/**
 * 从 CHANGELOG.md 提取指定 tag 的版本段，作为 GitHub Release 正文。
 *
 * 发版说明的唯一来源 = CHANGELOG（见 CONTRIBUTING.md §四.3）：本脚本只做提取
 * 与清洗，不生成内容。段落缺失时回退为 CHANGELOG 链接并在 CI 日志里打 warning
 * ——发版流程不设硬门禁。
 *
 * 用法：node scripts/release-body.ts v1.13.0 [--out release-body.md]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION_HEADING = /^##\s+\S/u;
const SECTION_HEADING = /^###\s+/u;
const COMPARE_LINE = /^\[compare changes\]\(/u;
const CONTRIBUTORS_HEADING = /^###\s+.*Contributors/u;

/** 提取版本段并去掉机械噪声（compare 行、Contributors 段），其余含 PR 链接原样保留 */
export function extractReleaseBody(changelog: string, tag: string): string | null {
  const lines = changelog.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `## ${tag}`);
  if (start === -1) return null;

  const body: string[] = [];
  let inContributors = false;
  for (const line of lines.slice(start + 1)) {
    if (VERSION_HEADING.test(line)) break;
    if (inContributors) {
      if (!SECTION_HEADING.test(line)) continue;
      inContributors = false;
    }
    if (COMPARE_LINE.test(line.trim())) continue;
    if (CONTRIBUTORS_HEADING.test(line.trim())) {
      inContributors = true;
      continue;
    }
    body.push(line);
  }

  const text = body.join('\n').trim();
  return text.length > 0 ? text : null;
}

export function buildFallbackBody(repoUrl: string, tag: string): string {
  return `📖 完整变更日志见 [CHANGELOG.md](${repoUrl}/blob/${tag}/CHANGELOG.md)`;
}

function readRepoUrl(rootDir: string): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
    repository?: { url?: string };
  };
  const fromPackage = pkg.repository?.url?.replace(/\.git$/u, '');
  if (fromPackage) return fromPackage;
  const server = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  return server && repo ? `${server}/${repo}` : '';
}

function main(argv: string[]): void {
  const [tag, ...rest] = argv;
  if (!tag || tag.startsWith('-')) {
    console.error('用法：node scripts/release-body.ts <tag> [--out <path>]');
    process.exitCode = 1;
    return;
  }

  const outIndex = rest.indexOf('--out');
  const outPath = outIndex === -1 ? undefined : rest[outIndex + 1];
  const rootDir = path.join(import.meta.dirname, '..');
  const changelog = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
  const extracted = extractReleaseBody(changelog, tag);

  if (!extracted) {
    console.log(`::warning::CHANGELOG.md 缺少 ${tag} 段落，Release 正文回退为 CHANGELOG 链接`);
  }
  const body = extracted ?? buildFallbackBody(readRepoUrl(rootDir), tag);

  if (outPath) {
    fs.writeFileSync(outPath, `${body}\n`, 'utf8');
  } else {
    process.stdout.write(`${body}\n`);
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main(process.argv.slice(2));
}
