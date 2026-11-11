import fs from 'node:fs';
import { CliVcsAdapter } from '../adapters/cli-vcs.ts';
import { PrWorkflowEngine } from '../core/workflow-engine.ts';
import { fail } from '../utils/process.ts';

function createEngine(): PrWorkflowEngine {
  const vcs = new CliVcsAdapter();
  return new PrWorkflowEngine({
    vcs,
    confirmMerge: ({ branch, targetBranch }) => {
      if (process.argv.includes('--yes')) {
        return true;
      }
      process.stdout.write(`确认将 ${branch} 合并入 ${targetBranch}? (y/N): `);
      let answer = '';
      try {
        const buffer = Buffer.alloc(1024);
        const bytesRead = fs.readSync(0, buffer, 0, 1024, null);
        answer = buffer.toString('utf-8', 0, bytesRead).trim();
      } catch {
        answer = '';
      }
      return /^y(es)?$/i.test(answer);
    },
  });
}

export async function createPr(): Promise<void> {
  try {
    const engine = createEngine();
    await engine.createPr();
  } catch (err) {
    fail((err as Error).message);
  }
}

export async function mergePr(): Promise<void> {
  try {
    const engine = createEngine();
    await engine.mergePr({ yes: process.argv.includes('--yes') });
  } catch (err) {
    fail((err as Error).message);
  }
}

export async function statusPr(): Promise<void> {
  try {
    const engine = createEngine();
    await engine.statusPr();
  } catch (err) {
    fail((err as Error).message);
  }
}

export async function triggerReview(): Promise<void> {
  try {
    const engine = createEngine();
    const pr = await engine.triggerReview();
    if (pr.url) {
      console.log(`  PR 链接: ${pr.url}`);
    }
    console.log(
      '  提示: GitHub Actions 已在后台启动审查工作流，约 2~3 分钟后可执行 pnpm pr-review pull 拉取看板。',
    );
  } catch (err) {
    fail((err as Error).message);
  }
}
