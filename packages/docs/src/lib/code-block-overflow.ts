const PRE_SELECTOR = 'pre.shiki';

let started = false;

function mark(pre: HTMLElement): void {
  const overflow = pre.scrollWidth > pre.clientWidth + 2;
  pre.dataset.codeOverflow = overflow ? 'true' : 'false';
}

function markAll(): void {
  for (const pre of document.querySelectorAll<HTMLElement>(PRE_SELECTOR)) mark(pre);
}

/**
 * 给出现横向滚动的代码块打 data-code-overflow，供 _root.css 预留复制按钮的
 * 顶部安全带（Vocs 的复制按钮是 <pre> 的绝对定位子元素，会随内容滚动压住首行）。
 */
export function setupCodeBlockOverflow(): void {
  if (started || !document.body) return;
  started = true;
  markAll();
  new MutationObserver(markAll).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', markAll);
  void document.fonts?.ready.then(markAll);
}
