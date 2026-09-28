import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Card, Tag } from 'antd';
import type React from 'react';

interface ChangelogCardProps {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string[];
}

function formatInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g);
  return tokens.map((token, i) => {
    const mdLinkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (mdLinkMatch) {
      const [, label, url] = mdLinkMatch;
      return (
        <a
          key={i}
          href={url}
          onClick={(e) => {
            e.preventDefault();
            window.api?.shell?.openExternal?.(url);
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
        <strong key={i} className="font-semibold text-foreground">
          {boldMatch[1]}
        </strong>
      );
    }
    if (/^https?:\/\/[^\s]+$/.test(token)) {
      return (
        <a
          key={i}
          href={token}
          onClick={(e) => {
            e.preventDefault();
            window.api?.shell?.openExternal?.(token);
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

export const ChangelogCard: React.FC<ChangelogCardProps> = ({
  version,
  releaseDate,
  releaseNotes,
}) => {
  useLingui();

  const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : undefined;

  return (
    <Card
      size="small"
      className="bg-background-secondary border border-border rounded-lg"
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
            <span className="text-xs text-foreground-muted font-normal">{formattedDate}</span>
          )}
        </div>
      }
    >
      <div className="max-h-40 overflow-y-auto pr-1 text-xs text-foreground-secondary space-y-1.5 stable-scrollbar">
        {releaseNotes && releaseNotes.length > 0 ? (
          <ul className="list-disc list-inside space-y-1">
            {releaseNotes.map((note, index) => (
              <li key={`${index}-${note.slice(0, 10)}`} className="leading-relaxed">
                {formatInlineMarkdown(note)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-foreground-muted italic">{t`包含常规稳定性改进与性能优化。`}</p>
        )}
      </div>
    </Card>
  );
};
