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
  const { currentVersion } = props;

  // ② 组件状态

  // ③ [已脱敏]IO / 异步操作

  // ④ 数据转换 / 派生

  // ⑤ 逻辑处理函数

  // ⑥ 组件 Effect

  // ⑦ 组件渲染
  return (
    <section
      className="shrink-0 border-b border-border bg-background px-5 py-4 select-none"
      aria-labelledby="updater-app-name"
    >
      <div className="flex gap-3">
        <img src={appIcon} alt="" draggable={false} className="w-16 h-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2
              id="updater-app-name"
              className="text-sm font-semibold text-foreground tracking-tight m-0 leading-5"
            >
              {APP_INFO.name}
            </h2>
            {currentVersion && (
              <p className="text-xs font-medium font-mono tabular-nums text-foreground-secondary m-0">
                {`v${currentVersion}`}
              </p>
            )}
          </div>
          <p className="text-xs text-foreground-secondary m-0 mt-0.5 leading-4">
            {t`类型安全的 Electron 单仓应用模板`}
          </p>
          <p className="text-xs text-foreground-secondary m-0 mt-1">
            {t`作者`} {APP_INFO.author} · {t`许可协议`} {APP_INFO.license}
          </p>
        </div>
      </div>

      <nav
        aria-label={t`资源链接`}
        className="mt-3 flex flex-wrap items-center gap-0.5 border-t border-border pt-2.5"
      >
        {RESOURCE_LINKS.map((link) => (
          <button
            key={link.key}
            type="button"
            onClick={() => openExternal(link.url)}
            className="rounded-md px-2 py-1 text-xs text-foreground-secondary hover:text-foreground hover:bg-foreground/10 cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {resourceLinkLabel(link.key)}
          </button>
        ))}
      </nav>
    </section>
  );
};

// 4. Props 类型定义
export interface AppInfoHeaderProps {
  /** 当前运行版本：来自主进程快照，缺失时不渲染版本行 */
  currentVersion?: string;
}

// 5. 导出与 Memo
export const AppInfoHeader = memo(_AppInfoHeader);
