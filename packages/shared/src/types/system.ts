import type { AppEnv } from '../constants/env';

export interface PingResult {
  message: string;
  timestamp: number; // Unix 毫秒统一规范
  serverTime: string;
  mainDurationMs?: number; // 主进程内部处理耗时（毫秒）
  eventLoopLagMs?: number; // 主进程 Event Loop 真实排队滞后耗时（毫秒）
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  v8Version: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  uptimeSeconds: number;
  env?: AppEnv;
  isPackaged?: boolean;
}

/**
 * 开机自启状态：平台能力 + 当前副本资格 + 系统侧真实状态 + 配置与系统的冲突标记
 */
export interface AutoLaunchStatus {
  /**
   * 本副本能否管理操作系统登录项：平台提供登录项 API（仅 darwin / win32）且当前为安装版副本；
   * 免安装副本（build:unpack 解包目录）恒为 false，避免误写/误删安装版共用的启动项。
   */
  isSupported: boolean;
  /** 系统启动项是否处于启用状态；不支持的场景回显配置意图（无系统状态可查） */
  isEnabled: boolean;
  /** 配置要求开启但系统侧未生效：被任务管理器禁用、待用户批准或启动项已被移除 */
  isBlockedBySystem: boolean;
  /** isSupported 为 false 的具体原因，渲染层据此给出准确文案；可用时为 null */
  unsupportedReason: AutoLaunchUnsupportedReason | null;
}

/**
 * 开机自启不可用原因
 * - platform：平台未提供登录项 API（Electron 仅支持 darwin / win32）
 * - source-run：从源码运行（dev / preview），未打包就没有稳定的安装位置可注册
 * - unpacked-copy：当前是解包目录里的免安装副本，与安装版共用启动项会互相覆盖
 */
export type AutoLaunchUnsupportedReason = 'platform' | 'source-run' | 'unpacked-copy';
