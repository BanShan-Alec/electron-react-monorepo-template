export interface BranchContext {
  currentBranch: string;
  defaultBranch: string;
  isClean: boolean;
  uncommittedFiles: string[];
}

export interface CommitSummary {
  sha: string;
  subject: string;
  body: string;
}

export interface PrDetails {
  number: number;
  title: string;
  url: string;
  baseRefName: string;
  headRefName: string;
  mergeable?: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
}

export interface CiCheck {
  name: string;
  state:
    | 'SUCCESS'
    | 'FAILURE'
    | 'ERROR'
    | 'CANCELLED'
    | 'TIMED_OUT'
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'QUEUED'
    | 'WAITING';
}

export interface CheckGateResult {
  status: 'PASSED' | 'FAILED' | 'PENDING' | 'TIMEOUT';
  checks: CiCheck[];
  failedChecks: CiCheck[];
  pendingChecks: CiCheck[];
}

export interface CreatePrInput {
  base: string;
  head: string;
  title: string;
  body: string;
}

export interface CreatePrResult {
  number?: number;
  url?: string;
}

export interface MergePrInput {
  branch: string;
  squash: boolean;
  deleteBranch: boolean;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  targetBranch: string;
  details?: string;
}

/**
 * VCS Provider 端口：解耦 Git 与 GitHub 外部实现
 */
export interface VcsProvider {
  ensureAuth(): Promise<void> | void;
  getBranchContext(): Promise<BranchContext>;
  getCommitsAgainst(baseBranch: string): Promise<CommitSummary[]>;
  checkConflict(branch: string, targetBranch: string): Promise<ConflictCheckResult>;
  getPrForBranch(branch: string): Promise<PrDetails | null>;
  pushBranch(branch: string): Promise<void>;
  createPr(input: CreatePrInput): Promise<CreatePrResult>;
  getRequiredCheckNames(baseBranch: string): Promise<string[] | null>;
  getChecks(branch: string): Promise<CiCheck[] | null>;
  mergePr(input: MergePrInput): Promise<void>;
  commentPr(prNumberOrBranch: string, body: string): Promise<void>;
}
