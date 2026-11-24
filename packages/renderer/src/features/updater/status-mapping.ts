import { t } from '@lingui/core/macro';
import { ErrorCode } from '@shared/constants/error-codes';
import type { UpdaterSnapshot } from '@shared/types/updater';
import type { ReactNode } from 'react';

/**
 * 更新窗口状态 → UI 纯函数映射（迁移自 Motrix app-update-section 的纯函数模式）。
 *
 * 模块级纯函数、t 宏直接调用：输入快照输出展示文案与动作描述，
 * 不触碰 IPC 与组件状态，可独立单测。
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
  switch (snapshot.state) {
    case 'checking':
      return {
        title: t`检查更新中`,
        subtitle: t`正在与更新服务器建立连接，请稍候…`,
      };
    case 'available':
      return {
        title: version ? t`发现新版本 v${version}` : t`发现新版本`,
        subtitle: t`新版本已就绪，包含最新功能与改进。`,
      };
    case 'downloading':
      return {
        title: version ? t`正在下载 v${version}` : t`正在下载更新`,
        subtitle: t`安装包下载中，完成后即可安装升级。`,
      };
    case 'downloaded':
      return {
        title: t`更新已准备就绪`,
        subtitle: version
          ? t`v${version} 已完成下载，重启后完成升级。`
          : t`新版本已完成下载，重启应用后即可完成升级。`,
      };
    case 'cancelled':
      return {
        title: t`下载已取消`,
        subtitle: version
          ? t`已停止下载 v${version}，可随时重新获取。`
          : t`已停止下载，可随时重新获取。`,
      };
    case 'up-to-date':
      return {
        title: t`已是最新版本`,
        subtitle: currentVersion
          ? t`当前 v${currentVersion} 已包含全部更新`
          : t`当前安装的应用已包含所有最新功能与安全更新。`,
      };
    case 'error':
      return {
        title: t`更新失败`,
        subtitle: t`检查或下载更新时发生异常，请检查[已脱敏]后重试。`,
      };
    default:
      return {
        title: t`软件更新`,
        subtitle: t`点按「检查更新」获取最新版本`,
      };
  }
}

/**
 * 错误详情语义文案：按快照语义码三段分支（与既有 renderErrorContent 同源），
 * 原始报错由调用方降级为次级行保留。非 error 态返回空串（无详情可述）。
 */
export function getStatusDescription(snapshot: UpdaterSnapshot): string {
  if (snapshot.state !== 'error') {
    return '';
  }
  switch (snapshot.code) {
    case ErrorCode.UPDATER_NETWORK_ERROR:
      return t`[已脱敏]连接失败或超时，请检查[已脱敏]后重试。`;
    case ErrorCode.UPDATER_NOT_CONFIGURED:
      return t`更新服务未配置。`;
    default:
      return t`更新过程中出现未知错误，请稍后重试。`;
  }
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
        primary: { label: t`检查更新中`, variant: 'default', loading: true, disabled: true },
      };
    case 'available':
      return {
        primary: { label: t`立即更新`, variant: 'primary', onClick: handlers.download },
      };
    case 'downloading': {
      const percent = Math.min(100, Math.max(0, Math.round(snapshot.progress?.percent ?? 0)));
      return {
        primary: {
          label: `${percent}%`,
          ariaLabel: t`正在下载更新 ${percent}%`,
          variant: 'default',
          disabled: true,
          mono: true,
        },
        secondary: { label: t`取消下载`, variant: 'default', onClick: handlers.cancel },
      };
    }
    case 'downloaded':
      return {
        primary: { label: t`重启并安装`, variant: 'primary', onClick: handlers.install },
      };
    case 'cancelled':
      return {
        primary: { label: t`重新下载`, variant: 'primary', onClick: handlers.download },
      };
    case 'error':
      return {
        primary: { label: t`重试`, variant: 'primary', onClick: handlers.retry },
      };
    default:
      return {
        primary: { label: t`检查更新`, variant: 'default', onClick: handlers.check },
      };
  }
}
