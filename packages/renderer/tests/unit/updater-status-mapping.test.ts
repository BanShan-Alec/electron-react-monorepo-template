import type { UpdaterSnapshot } from '@shared/types/updater';
import { describe, expect, it, vi } from 'vitest';
import {
  getStatusDescription,
  getStatusHeader,
  getUpdaterActions,
  showsChangelog,
  showsProgress,
} from '@/features/updater/status-mapping';

// t 宏是 Vite 插件（@lingui/vite-plugin）的编译期转换，Vitest 管线不执行；
// 此处按模板字面量原语义 mock 为直拼，断言中文 msgid 路由
vi.mock('@lingui/core/macro', () => {
  const t = (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (acc, chunk, index) => acc + chunk + (index < values.length ? String(values[index]) : ''),
      '',
    );
  return { t };
});

function snapshot(overrides: Partial<UpdaterSnapshot>): UpdaterSnapshot {
  return { state: 'idle', progress: null, error: null, code: null, ...overrides };
}

function handlers() {
  return {
    check: vi.fn(),
    download: vi.fn(),
    cancel: vi.fn(),
    install: vi.fn(),
    retry: vi.fn(),
  };
}

describe('getStatusHeader', () => {
  it('maps every state to its title and subtitle', () => {
    expect(getStatusHeader(snapshot({ state: 'idle' }))).toEqual({
      title: '软件更新',
      subtitle: '点按「检查更新」获取最新版本',
    });
    expect(getStatusHeader(snapshot({ state: 'checking' }))).toEqual({
      title: '检查更新中',
      subtitle: '正在与更新服务器建立连接，请稍候…',
    });
    expect(getStatusHeader(snapshot({ state: 'up-to-date', currentVersion: '1.14.0' }))).toEqual({
      title: '已是最新版本',
      subtitle: '当前 v1.14.0 已包含全部更新',
    });
    expect(getStatusHeader(snapshot({ state: 'available', version: '2.0.0' }))).toEqual({
      title: '发现新版本 v2.0.0',
      subtitle: '新版本已就绪，包含最新功能与改进。',
    });
    expect(getStatusHeader(snapshot({ state: 'downloading', version: '2.0.0' }))).toEqual({
      title: '正在下载 v2.0.0',
      subtitle: '安装包下载中，完成后即可安装升级。',
    });
    expect(getStatusHeader(snapshot({ state: 'downloaded', version: '2.0.0' }))).toEqual({
      title: '更新已准备就绪',
      subtitle: 'v2.0.0 已完成下载，重启后完成升级。',
    });
    expect(getStatusHeader(snapshot({ state: 'cancelled', version: '2.0.0' }))).toEqual({
      title: '下载已取消',
      subtitle: '已停止下载 v2.0.0，可随时重新获取。',
    });
    expect(getStatusHeader(snapshot({ state: 'error' }))).toEqual({
      title: '更新失败',
      subtitle: '检查或下载更新时发生异常，请检查[已脱敏]后重试。',
    });
  });

  it('falls back to version-agnostic copy when metadata is missing', () => {
    expect(getStatusHeader(snapshot({ state: 'available' })).title).toBe('发现新版本');
    expect(getStatusHeader(snapshot({ state: 'downloading' })).title).toBe('正在下载更新');
    expect(getStatusHeader(snapshot({ state: 'downloaded' })).subtitle).toBe(
      '新版本已完成下载，重启应用后即可完成升级。',
    );
    expect(getStatusHeader(snapshot({ state: 'cancelled' })).subtitle).toBe(
      '已停止下载，可随时重新获取。',
    );
    expect(getStatusHeader(snapshot({ state: 'up-to-date' })).subtitle).toBe(
      '当前安装的应用已包含所有最新功能与安全更新。',
    );
  });
});

describe('getStatusDescription', () => {
  it('returns the semantic copy per error code', () => {
    expect(getStatusDescription(snapshot({ state: 'error', code: 'UPDATER_NETWORK_ERROR' }))).toBe(
      '[已脱敏]连接失败或超时，请检查[已脱敏]后重试。',
    );
    expect(getStatusDescription(snapshot({ state: 'error', code: 'UPDATER_NOT_CONFIGURED' }))).toBe(
      '更新服务未配置。',
    );
    expect(getStatusDescription(snapshot({ state: 'error', code: null }))).toBe(
      '更新过程中出现未知错误，请稍后重试。',
    );
  });

  it('returns empty string for non-error states', () => {
    expect(getStatusDescription(snapshot({ state: 'idle' }))).toBe('');
    expect(getStatusDescription(snapshot({ state: 'downloading', version: '2.0.0' }))).toBe('');
  });
});

describe('getUpdaterActions', () => {
  it('routes idle / up-to-date to a default check action', () => {
    const h = handlers();
    const actions = getUpdaterActions(snapshot({ state: 'idle' }), h);
    actions.primary?.onClick?.();
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(actions.primary?.variant).toBe('default');
    expect(actions.secondary).toBeUndefined();
  });

  it('shows a loading and disabled button while checking', () => {
    const actions = getUpdaterActions(snapshot({ state: 'checking' }), handlers());
    expect(actions.primary?.loading).toBe(true);
    expect(actions.primary?.disabled).toBe(true);
    expect(actions.primary?.onClick).toBeUndefined();
  });

  it('routes available to a primary download action', () => {
    const h = handlers();
    const actions = getUpdaterActions(snapshot({ state: 'available', version: '2.0.0' }), h);
    actions.primary?.onClick?.();
    expect(h.download).toHaveBeenCalledTimes(1);
    expect(actions.primary?.variant).toBe('primary');
  });

  it('renders a clamped percent button with an accessible label and a cancel secondary', () => {
    const h = handlers();
    const actions = getUpdaterActions(
      snapshot({ state: 'downloading', version: '2.0.0', progress: { percent: 47.6 } }),
      h,
    );
    expect(actions.primary?.label).toBe('48%');
    expect(actions.primary?.ariaLabel).toBe('正在下载更新 48%');
    expect(actions.primary?.disabled).toBe(true);
    expect(actions.primary?.mono).toBe(true);
    expect(actions.primary?.onClick).toBeUndefined();

    actions.secondary?.onClick?.();
    expect(h.cancel).toHaveBeenCalledTimes(1);
  });

  it('routes downloaded to install and cancelled back to download', () => {
    const h = handlers();
    getUpdaterActions(snapshot({ state: 'downloaded', version: '2.0.0' }), h).primary?.onClick?.();
    expect(h.install).toHaveBeenCalledTimes(1);

    getUpdaterActions(snapshot({ state: 'cancelled', version: '2.0.0' }), h).primary?.onClick?.();
    expect(h.download).toHaveBeenCalledTimes(1);
  });

  it('routes error to retry', () => {
    const h = handlers();
    const actions = getUpdaterActions(snapshot({ state: 'error' }), h);
    actions.primary?.onClick?.();
    expect(h.retry).toHaveBeenCalledTimes(1);
    expect(actions.primary?.variant).toBe('primary');
  });

  it('keeps at most one primary-styled action per state', () => {
    const h = handlers();
    const states = [
      'idle',
      'checking',
      'available',
      'downloading',
      'downloaded',
      'cancelled',
      'up-to-date',
      'error',
    ] as const;
    for (const state of states) {
      const actions = getUpdaterActions(snapshot({ state }), h);
      const primaries = [actions.primary, actions.secondary].filter(
        (action) => action?.variant === 'primary',
      );
      expect(primaries.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('showsChangelog', () => {
  it('无版本元数据时一律不渲染（含 cancelled/error）', () => {
    for (const state of ['cancelled', 'error', 'available'] as const) {
      expect(showsChangelog(snapshot({ state }))).toBe(false);
    }
  });

  it('有版本元数据时仅 available/downloading/downloaded/cancelled/error 渲染', () => {
    const visible = ['available', 'downloading', 'downloaded', 'cancelled', 'error'] as const;
    for (const state of visible) {
      expect(showsChangelog(snapshot({ state, version: '1.2.3' }))).toBe(true);
    }
    for (const state of ['idle', 'checking', 'up-to-date'] as const) {
      expect(showsChangelog(snapshot({ state, version: '1.2.3' }))).toBe(false);
    }
  });
});

describe('showsProgress', () => {
  it('仅 downloading 态渲染进度卡片', () => {
    expect(showsProgress(snapshot({ state: 'downloading' }))).toBe(true);
    expect(showsProgress(snapshot({ state: 'downloaded' }))).toBe(false);
    expect(showsProgress(snapshot({ state: 'cancelled' }))).toBe(false);
  });
});
