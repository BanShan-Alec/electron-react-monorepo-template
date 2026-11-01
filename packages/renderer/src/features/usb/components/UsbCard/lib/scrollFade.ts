export interface ScrollFadeState {
  topOpacity: number;
  bottomOpacity: number;
}

export function getScrollFadeOpacity(distanceFromEdge: number, fadeDistance: number): number {
  return Math.max(0, Math.min(1, distanceFromEdge / fadeDistance));
}

export function getScrollFadeState({
  scrollTop,
  clientHeight,
  scrollHeight,
}: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}): ScrollFadeState {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const hasOverflow = maxScrollTop > 1;
  const fadeDistance = 80;

  return {
    topOpacity: hasOverflow ? getScrollFadeOpacity(scrollTop, fadeDistance) : 0,
    bottomOpacity: hasOverflow ? getScrollFadeOpacity(maxScrollTop - scrollTop, fadeDistance) : 0,
  };
}
