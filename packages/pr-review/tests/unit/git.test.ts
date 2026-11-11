import { describe, expect, it, vi } from 'vitest';
import { getDefaultBranch, hasMergeConflict } from '../../src/utils/git.ts';
import * as processUtils from '../../src/utils/process.ts';

describe('hasMergeConflict', () => {
  it('returns false when git merge-tree succeeds without conflicts', () => {
    vi.spyOn(processUtils, 'probe').mockReturnValueOnce('tree-sha-12345');
    const conflict = hasMergeConflict('feat/test', 'main');
    expect(conflict).toBe(false);
    expect(processUtils.probe).toHaveBeenCalledWith('git', [
      'merge-tree',
      '--write-tree',
      'feat/test',
      'origin/main',
    ]);
    vi.restoreAllMocks();
  });

  it('returns true when git merge-tree fails due to conflict', () => {
    vi.spyOn(processUtils, 'probe').mockReturnValueOnce(null);
    const conflict = hasMergeConflict('feat/test', 'main');
    expect(conflict).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('getDefaultBranch', () => {
  it('extracts branch name from symbolic-ref', () => {
    vi.spyOn(processUtils, 'probe').mockReturnValueOnce('origin/develop');
    expect(getDefaultBranch()).toBe('develop');
    vi.restoreAllMocks();
  });

  it('falls back to main when symbolic-ref is null', () => {
    vi.spyOn(processUtils, 'probe').mockReturnValueOnce(null);
    expect(getDefaultBranch()).toBe('main');
    vi.restoreAllMocks();
  });
});
