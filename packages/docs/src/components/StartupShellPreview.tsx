'use client';

import { useState } from 'react';
import { BASE_PATH } from '../navigation';

/**
 * 启动壳动效预览。
 *
 * 文档站是独立构建，拿不到主应用内联进 index.html 的那段 CSS，所以这里的
 * 时长/缓动/关键帧按值复刻——改渲染层启动壳时必须同步本文件。
 * 主源：packages/renderer/src/entries/home/index.html（startup-logo-pop / startup-logo-pulse）。
 */
const PREVIEW_STYLES = `
.startup-preview {
  margin: 16px 0 24px;
}

.startup-preview__stage {
  display: flex;
  height: 240px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 12px;
  /* 固定深色：与主进程 BrowserWindow.backgroundColor（深 #141414）一致，
     避免浅色主题下预览变成一块突兀的黑 */
  background: #141414;
}

.startup-preview__shell {
  display: flex;
  width: 96px;
  height: 96px;
  align-items: center;
  justify-content: center;
  transform: scale(0.72);
  opacity: 0;
  transform-origin: center;
  animation: startup-preview-pop 0.72s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.startup-preview__logo {
  display: block;
  width: 96px;
  height: 96px;
}

.startup-preview__shell[data-long-wait='true'] .startup-preview__logo {
  animation: startup-preview-pulse 1.8s linear 3s infinite;
}

@keyframes startup-preview-pop {
  0% {
    opacity: 0;
    transform: scale(0.72);
  }
  38% {
    opacity: 1;
    transform: scale(1.045);
  }
  58% {
    opacity: 1;
    transform: scale(0.985);
  }
  76% {
    opacity: 1;
    transform: scale(1.008);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes startup-preview-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.startup-preview__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.startup-preview__button {
  padding: 4px 12px;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}

.startup-preview__button:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.startup-preview__caption {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.72;
}

@media (prefers-reduced-motion: reduce) {
  .startup-preview__shell {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .startup-preview__shell[data-long-wait='true'] .startup-preview__logo {
    animation: none;
  }
}
`;

export function StartupShellPreview() {
  const [run, setRun] = useState(0);
  const [longWait, setLongWait] = useState(false);

  const replay = (nextLongWait: boolean) => {
    setLongWait(nextLongWait);
    setRun((value) => value + 1);
  };

  return (
    <div className="startup-preview">
      <style>{PREVIEW_STYLES}</style>
      <div className="startup-preview__stage">
        <div
          key={`${run}-${longWait}`}
          className="startup-preview__shell"
          data-long-wait={longWait}
        >
          <img className="startup-preview__logo" src={`${BASE_PATH}icon.png`} alt="" />
        </div>
      </div>
      <div className="startup-preview__bar">
        <button type="button" className="startup-preview__button" onClick={() => replay(false)}>
          重播入场
        </button>
        <button type="button" className="startup-preview__button" onClick={() => replay(true)}>
          模拟长等待
        </button>
      </div>
      <p className="startup-preview__caption">
        入场 0.72s（缩放 + 淡入）；任一路门禁超过 3s 未结算时，logo 进入 1.8s /
        一轮的呼吸循环，用来区分「还在等」与「卡死」。
      </p>
    </div>
  );
}
