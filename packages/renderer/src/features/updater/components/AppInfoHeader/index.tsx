import { CloseOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { APP_INFO } from '@shared/constants/app-info';
import type React from 'react';
import { memo } from 'react';
import appIcon from '../../assets/app-icon.png?url';
import { openExternal } from '../../utils/open-external';

// 私有常量
/** 资源链接导航项（顺序即展示顺序，来源统一为 APP_INFO 单一真源）
 * 注意：文案在组件渲染期取词（见 resourceLinkLabel）——t 宏在模块顶层求值会先于
 * i18n.activate 执行，直接拖垮整个 updater 入口的挂载
 */
const RESOURCE_LINKS = [
  { key: 'repository', url: APP_INFO.repositoryUrl },
  { key: 'releases', url: APP_INFO.releasesUrl },
  { key: 'issues', url: APP_INFO.issuesUrl },
  { key: 'docs', url: APP_INFO.docsUrl },
] as const;

type ResourceLinkKey = (typeof RESOURCE_LINKS)[number]['key'];

/** 外链统一样式（详情行与资源导航共用 Motrix 的紧凑链接观感） */
const LINK_CLASS =
  'no-drag rounded-md outline-none transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40';

/** 详情行内联链接：下划线表示可点，与资源导航的按钮式链接区分 */
const INLINE_LINK_CLASS =
  'no-drag rounded-sm font-medium text-foreground outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-primary/40';

// 可抽离的逻辑处理函数/组件

/** 资源链接文案：仅在渲染期调用（此时 locale 已激活） */
function resourceLinkLabel(key: ResourceLinkKey): React.ReactNode {
  switch (key) {
    case 'repository':
      return t`仓库`;
    case 'releases':
      return t`更新日志`;
    case 'issues':
      return t`问题反馈`;
    case 'docs':
      return t`文档站`;
  }
}

const _AppInfoHeader = (props: AppInfoHeaderProps) => {
  useLingui();

  // ① 变量声明、解构
  const { currentVersion, onClose } = props;

  // ② 组件状态

  // ③ 网络IO / 异步操作

  // ④ 数据转换 / 派生
  const { license } = APP_INFO;

  // ⑤ 逻辑处理函数
  /** 外链统一走主进程白名单出口：拒绝 default 导航把渲染进程整页带走 */
  const handleOpen = (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    event.preventDefault();
    openExternal(url);
  };

  // ⑥ 组件 Effect

  // ⑦ 组件渲染
  return (
    <section
      className="drag-region no-wco relative shrink-0 border-b border-border bg-background-sunken px-6 py-5 select-none"
      aria-labelledby="updater-app-name"
    >
      {/* 无边框窗口自绘关闭钮：绝对定位在信息区右上角，不占排版流 */}
      {onClose && (
        <button
          type="button"
          aria-label={t`关闭`}
          onClick={onClose}
          className="no-drag absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-foreground/10 hover:text-foreground active:bg-foreground/20 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <CloseOutlined className="text-sm" />
        </button>
      )}

      <div className="flex gap-4 pr-10">
        <img src={appIcon} alt="" draggable={false} className="size-20 shrink-0 drop-shadow-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2
              id="updater-app-name"
              className="text-2xl leading-tight font-semibold tracking-tight text-foreground m-0"
            >
              {APP_INFO.name}
            </h2>
            {currentVersion && (
              <p className="text-sm font-medium tabular-nums text-foreground-secondary m-0">
                {t`版本 ${currentVersion}`}
              </p>
            )}
          </div>
          <p className="mt-1 max-w-md text-xs leading-normal text-foreground-secondary m-0">
            {t`类型安全的 Electron 单仓应用模板`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-foreground-secondary">
            <span>
              {t`开发者`}{' '}
              <a
                href={APP_INFO.authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => handleOpen(event, APP_INFO.authorUrl)}
                className={INLINE_LINK_CLASS}
              >
                {APP_INFO.author}
              </a>
            </span>
            <a
              href={APP_INFO.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => handleOpen(event, APP_INFO.repositoryUrl)}
              className={INLINE_LINK_CLASS}
            >
              {t`开源仓库`}
            </a>
            <span>{t`${license} 许可证`}</span>
          </div>
        </div>
      </div>

      {/* 分隔线归 nav（与内容列同宽），负边距只作用于链接行，避免把 border-t 一起左移压到窗口边 */}
      <nav aria-label={t`相关资源`} className="mt-4 border-t border-border pt-3">
        <div className="-mb-1 -ms-2 flex flex-wrap items-center gap-0.5">
          {RESOURCE_LINKS.map((link) => (
            <a
              key={link.key}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => handleOpen(event, link.url)}
              className={`${LINK_CLASS} px-2 py-1 text-xs font-medium text-foreground-secondary`}
            >
              {resourceLinkLabel(link.key)}
            </a>
          ))}
        </div>
      </nav>
    </section>
  );
};

// 4. Props 类型定义
export interface AppInfoHeaderProps {
  /** 当前运行版本：来自主进程快照，缺失时不渲染版本行 */
  currentVersion?: string;
  /** 关闭窗口（隐藏到后台，下载继续）；不传则不渲染右上角关闭钮 */
  onClose?: () => void;
}

// 5. 导出与 Memo
export const AppInfoHeader = memo(_AppInfoHeader);
