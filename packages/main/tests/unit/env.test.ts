import path from 'node:path';
import { isInstalledCopy } from '@app/main/env';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    // 默认按已打包形态求值；未打包场景在各用例中经参数注入覆盖
    isPackaged: true,
    getVersion: vi.fn(),
    getName: vi.fn(),
  },
}));

/**
 * 副本形态判定是「开机自启收敛」的唯一闸门：判成安装版就放开系统启动项写入，
 * 判错方向必须偏保守（宁可拒绝）。这里覆盖路径相对关系的边界，其余上层行为
 * 由 auto-launch.test.ts 经公开 API 驱动验证。
 */
describe('isInstalledCopy 路径边界', () => {
  const repoRoot = path.join('H:', 'electron-app-temp5');

  it('仓库内的就地副本判为未安装（拒绝写自启）', () => {
    const installed = isInstalledCopy({
      packaged: true,
      repoRoot,
      execPath: path.join(repoRoot, 'dist', 'win-unpacked', 'App.exe'),
    });

    expect(installed).toBe(false);
  });

  it('仓库内以两点开头的目录名不会被误判为仓库外', () => {
    // 回归用例：startsWith('..') 会把 `..dist\App.exe` 当作父级路径，从而放开自启写入
    const installed = isInstalledCopy({
      packaged: true,
      repoRoot,
      execPath: path.join(repoRoot, '..dist', 'App.exe'),
    });

    expect(installed).toBe(false);
  });

  it('同盘兄弟目录（以仓库名为前缀）判为安装版，可正常管理自启', () => {
    const installed = isInstalledCopy({
      packaged: true,
      repoRoot,
      execPath: path.join('H:', 'electron-app-temp5-usb', 'App.exe'),
    });

    expect(installed).toBe(true);
  });

  it('仓库外的系统安装位置判为安装版', () => {
    const installed = isInstalledCopy({
      packaged: true,
      repoRoot,
      execPath: path.join('D:', 'Program Files', 'Electron React Template', 'App.exe'),
    });

    expect(installed).toBe(true);
  });

  it('未打包形态恒为未安装（源码运行不参与启动项管理）', () => {
    const installed = isInstalledCopy({
      packaged: false,
      repoRoot,
      execPath: path.join('D:', 'Program Files', 'Electron React Template', 'App.exe'),
    });

    expect(installed).toBe(false);
  });

  it('构建期标识缺失时放行，避免把正常用户锁死', () => {
    const installed = isInstalledCopy({ packaged: true, repoRoot: '' });

    expect(installed).toBe(true);
  });
});
