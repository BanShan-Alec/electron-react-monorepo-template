import { t } from '@lingui/core/macro';
import { APP_INFO } from '@shared/constants/app-info';
import { ErrorCode } from '@shared/constants/error-codes';
import type { UpdaterSnapshot } from '@shared/types/updater';
import type { ReactNode } from 'react';

/**
 * 更新窗口状态 → UI 纯函数映射（迁移自 Motrix app-update-section 的纯函数模式）。
 *
 * 模块级纯函数、t 宏直接调用：输入快照输出展示文案与动作描述，
 * 不触碰 IPC 与组件状态，可独立单测。
 * 文案与 Motrix 保持一致（标题一句 + 说明一句，按钮承担动作），
 * 差异仅在应用名与"无法跨盘安装"等本仓不支持的支路。
 */

// 私有常量

// 可抽离的逻辑处理函数/组件

/**
 * 状态标题与描述行（StatusSection 左侧两行文案）。
 *
 * error 态副标题给通用结论；按语义码的细分文案由 getStatusDescription 承载（Alert 消费）。
 */
export function getStatusHeader(snapshot: UpdaterSnapshot): { title: string; subtitle: string } {
  const { version, currentVersion } = snapshot;
  const appName = APP_INFO.name;
  switch (snapshot.state) {
    case 'checking':
      return {
        title: t`正在检查更新…`,
        subtitle: t`正在连接更新服务器…`,
      };
    case 'available':
      return {
        title: version ? t`发现新版本 v${version}` : t`发现新版本`,
        subtitle: t`现在下载，并在准备好时自行选择重启安装。`,
      };
    case 'downloading':
      return {
        title: version ? t`正在下载 v${version}` : t`正在下载更新`,
        subtitle: t`你可以关闭此窗口，下载会在后台继续。`,
      };
    case 'downloaded':
      return {
        title: t`更新已可安装`,
        subtitle: version ? t`v${version} 已准备好安装。` : t`新版本已准备好安装，重启后完成升级。`,
      };
    case 'cancelled':
      return {
        title: t`下载已取消`,
        subtitle: t`准备好后可以重新开始下载。`,
      };
    case 'up-to-date':
      return {
        title: t`已是最新版本`,
        subtitle: currentVersion
          ? t`版本 v${currentVersion} 是当前可用的最新版本。`
          : t`当前安装的应用已包含全部最新功能。`,
      };
    case 'error':
      return {
        title: t`无法更新`,
        subtitle: t`请稍后重试。`,
      };
    default:
      return {
        title: t`让 ${appName} 保持最新`,
        subtitle: currentVersion
          ? t`当前安装的是版本 v${currentVersion}。立即检查，或让应用在启动时自动检查。`
          : t`立即检查，或让应用在启动时自动检查。`,
      };
  }
}

/**
 * 错误详情语义文案：按快照语义码三段分支（与既有 renderErrorContent 同源），
 * 原始报错由 Alert 的 description 行兜底保留。非 error 态返回空串（无详情可述）。
 */
export function getStatusDescription(snapshot: UpdaterSnapshot): string {
  if (snapshot.state !== 'error') {
    return '';
  }
  switch (snapshot.code) {
    case ErrorCode.UPDATER_NETWORK_ERROR:
      return t`网络连接失败或超时，请检查网络后重试。`;
    case ErrorCode.UPDATER_NOT_CONFIGURED:
      return t`更新服务未配置。`;
    default:
      return t`更新过程中出现未知错误，请稍后重试。`;
  }
}

/** 是否应在窗口打开时自动发起一次检查（开窗即查的唯一判据）
 *
 * 仅「还没有结果」的阶段允许：idle（首次打开）/ up-to-date（已确认无更新后复查）。
 * checking、downloading 正在推进（吃推送即可）；available、downloaded、cancelled、error
 * 已携带结果且有显式动作按钮，重查会把结果覆盖成 checking（离线/mock 下永久卡在“正在检查…”）。
 */
export function shouldAutoCheckOnOpen(state: UpdaterSnapshot['state']): boolean {
  return state === 'idle' || state === 'up-to-date';
}

/** 是否渲染变更日志卡片：已拿到版本元数据且处于可参考阶段（cancelled/error 保留元数据供用户参考） */
export function showsChangelog(snapshot: UpdaterSnapshot): boolean {
  if (!snapshot.version) {
    return false;
  }
  switch (snapshot.state) {
    case 'available':
    case 'downloading':
    case 'downloaded':
    case 'cancelled':
    case 'error':
      return true;
    default:
      return false;
  }
}

/** 是否渲染下载进度卡片 */
export function showsProgress(snapshot: UpdaterSnapshot): boolean {
  return snapshot.state === 'downloading';
}

/** 按钮前置图标语义键（映射到具体图标由展示层裁定，保持本模块纯函数、可单测） */
export type UpdaterActionIcon = 'refresh' | 'download' | 'restart';

/** 单个动作按钮的展示契约（antd Button 映射用） */
export interface UpdaterAction {
  label: ReactNode;
  /** 可见文案不可读屏时（percent 按钮）补完整语义 */
  ariaLabel?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** antd Button type：每阶段至多一个 primary */
  variant: 'primary' | 'default';
  /** 数字文案用等宽字（percent 按钮） */
  mono?: boolean;
  /** 前置图标（对齐 Motrix 每个动作都带图标） */
  icon?: UpdaterActionIcon;
}

/** 各状态动作的执行器集合（由 StatusSection 装配后传入，保持映射函数纯净） */
export interface UpdaterActionHandlers {
  check: () => void;
  download: () => void;
  cancel: () => void;
  install: () => void;
  retry: () => void;
}

export interface UpdaterActions {
  primary?: UpdaterAction;
  secondary?: UpdaterAction;
}

/**
 * 状态 → 主/次动作映射：按钮随 phase 变形且位置恒定，
 * 下载中 primary 为 percent 展示（disabled），secondary 为取消。
 */
export function getUpdaterActions(
  snapshot: UpdaterSnapshot,
  handlers: UpdaterActionHandlers,
): UpdaterActions {
  switch (snapshot.state) {
    case 'checking':
      return {
        primary: { label: t`正在检查…`, variant: 'default', loading: true, disabled: true },
      };
    case 'available':
      return {
        primary: {
          label: t`下载更新`,
          icon: 'download',
          variant: 'primary',
          onClick: handlers.download,
        },
      };
    case 'downloading': {
      const percent = Math.min(100, Math.max(0, Math.round(snapshot.progress?.percent ?? 0)));
      return {
        primary: {
          label: `${percent}%`,
          ariaLabel: t`正在下载更新 ${percent}%`,
          icon: 'download',
          variant: 'default',
          disabled: true,
          mono: true,
        },
        secondary: { label: t`取消下载`, variant: 'default', onClick: handlers.cancel },
      };
    }
    case 'downloaded':
      return {
        primary: {
          label: t`重启并安装`,
          icon: 'restart',
          variant: 'primary',
          onClick: handlers.install,
        },
      };
    case 'cancelled':
      return {
        primary: {
          label: t`重试`,
          icon: 'refresh',
          variant: 'primary',
          // 保留元数据时重入下载，否则回到检查（与 handleRetry 同源语义）
          onClick: snapshot.version ? handlers.download : handlers.check,
        },
      };
    case 'error':
      return {
        primary: { label: t`重试`, icon: 'refresh', variant: 'primary', onClick: handlers.retry },
      };
    default:
      return {
        primary: {
          label: t`检查更新`,
          icon: 'refresh',
          variant: 'default',
          onClick: handlers.check,
        },
      };
  }
}
