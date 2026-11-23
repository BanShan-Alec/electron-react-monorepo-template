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
 * 开机自启状态：平台能力 + 系统侧真实状态 + 配置与系统的冲突标记
 */
export interface AutoLaunchStatus {
  /** 当前平台是否实现登录项 API；Electron 仅 darwin/win32 提供，其余平台恒为 false */
  isSupported: boolean;
  /** 系统启动项是否处于启用状态；不支持的平台回显配置意图（无系统状态可查） */
  isEnabled: boolean;
  /** 配置要求开启但系统侧未生效：被任务管理器禁用、待用户批准或启动项已被移除 */
  isBlockedBySystem: boolean;
}
