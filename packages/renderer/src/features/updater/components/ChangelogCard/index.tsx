import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Tag } from 'antd';
import type React from 'react';
import { memo } from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { openExternal } from '../../utils/open-external';

// 私有常量

// 可抽离的逻辑处理函数/组件

function formatInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g);
  let counter = 0;
  return tokens.map((token) => {
    const key = `token-${counter++}`;
    const mdLinkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (mdLinkMatch) {
      const [, label, url] = mdLinkMatch;
      return (
        <a
          key={key}
          href={url}
          onClick={(e) => {
            e.preventDefault();
            openExternal(url);
          }}
          className="text-primary hover:underline cursor-pointer"
        >
          {label}
        </a>
      );
    }
    const boldMatch = token.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {boldMatch[1]}
        </strong>
      );
    }
    if (/^https?:\/\/[^\s]+$/.test(token)) {
      return (
        <a
          key={key}
          href={token}
          onClick={(e) => {
            e.preventDefault();
            openExternal(token);
          }}
          className="text-primary hover:underline cursor-pointer"
        >
          {token}
        </a>
      );
    }
    return token;
  });
}

const _ChangelogCard = (props: ChangelogCardProps) => {
  // ① 变量声明、解构
  const { version, releaseDate, releaseNotes } = props;
  const { i18n } = useLingui();

  // ② 组件状态

  // ③ 网络IO / 异步操作

  // ④ 数据转换 / 派生

  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString(i18n.locale)
    : undefined;
  const hasNotes = Boolean(releaseNotes && releaseNotes.length > 0);

  const normalizedNotes = (releaseNotes ?? []).map((note, index) => ({
    id: `${index}-${note}`,
    text: note,
  }));

  return (
    <AppCard
      size="small"
      className="min-h-32 flex-1 bg-background-elevated"
      title={
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{t`更新日志`}</span>
            {version && (
              <Tag color="blue" className="font-mono text-xs font-medium">
                {`v${version}`}
              </Tag>
            )}
          </div>
          {formattedDate && (
            <span className="text-xs text-foreground-secondary font-normal">{formattedDate}</span>
          )}
        </div>
      }
    >
      {/* 日志卡吃掉正文剩余高度并在卡内滚动：窗口高度会随工作区收缩，
          整页滚动会让「某个元素被折线切断」看起来像 bug */}
      <div className="flex min-h-0 flex-1 flex-col text-xs text-foreground-secondary">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {hasNotes ? (
            <ul className="list-disc space-y-1 pl-4">
              {normalizedNotes.map((item) => (
                <li key={item.id} className="leading-relaxed break-words">
                  {formatInlineMarkdown(item.text)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-foreground-secondary italic">{t`包含常规稳定性改进与性能优化。`}</p>
          )}
        </div>
      </div>
    </AppCard>
  );
};

// 4. Props 类型定义
export interface ChangelogCardProps {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string[];
}

// 5. 导出与 Memo
export const ChangelogCard = memo(_ChangelogCard);
