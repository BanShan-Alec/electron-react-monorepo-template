import { describe, expect, it } from 'vitest';
import { InMemoryVcsAdapter } from '../../src/adapters/in-memory-vcs.ts';

describe('InMemoryVcsAdapter', () => {
  it('provides configured branch context and commits', async () => {
    const vcs = new InMemoryVcsAdapter({
      currentBranch: 'feat/test-branch',
      defaultBranch: 'main',
      isClean: true,
      commits: [{ sha: 'sha1', subject: 'feat: initial commit', body: 'some details' }],
    });

    const ctx = await vcs.getBranchContext();
    expect(ctx.currentBranch).toBe('feat/test-branch');
    expect(ctx.isClean).toBe(true);

    const commits = await vcs.getCommitsAgainst('main');
    expect(commits).toHaveLength(1);
    expect(commits[0]?.subject).toBe('feat: initial commit');
  });

  it('records pushed branches and PR creation', async () => {
    const vcs = new InMemoryVcsAdapter({
      currentBranch: 'feat/pr-1',
      defaultBranch: 'main',
      isClean: true,
    });

    await vcs.pushBranch('feat/pr-1');
    expect(vcs.pushedBranches).toContain('feat/pr-1');

    const created = await vcs.createPr({
      base: 'main',
      head: 'feat/pr-1',
      title: 'feat: add feature',
      body: 'PR body',
    });

    expect(created.number).toBe(1);
    const pr = await vcs.getPrForBranch('feat/pr-1');
    expect(pr?.title).toBe('feat: add feature');
  });

  it('reports conflict according to preset status', async () => {
    const vcs = new InMemoryVcsAdapter({
      currentBranch: 'feat/conflict',
      defaultBranch: 'main',
      hasConflict: true,
    });

    const conflict = await vcs.checkConflict('feat/conflict', 'main');
    expect(conflict.hasConflict).toBe(true);
  });
});
