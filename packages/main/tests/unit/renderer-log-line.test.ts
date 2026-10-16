import { RENDERER_LINE_MAX_LENGTH, truncateRenderedLine } from '@app/main/modules/log.module';
import { describe, expect, it } from 'vitest';

describe('truncateRenderedLine', () => {
  it('should keep short lines unchanged', () => {
    expect(truncateRenderedLine('[Renderer] [home] hello')).toBe('[Renderer] [home] hello');
  });

  it('should keep a line at exactly the max length unchanged', () => {
    const line = 'x'.repeat(RENDERER_LINE_MAX_LENGTH);
    expect(truncateRenderedLine(line)).toBe(line);
  });

  it('should truncate over-long lines and append a marker', () => {
    const line = 'x'.repeat(2500);
    const result = truncateRenderedLine(line);

    expect(result).toContain(`[truncated ${500} chars]`);
    expect(result.length).toBe(RENDERER_LINE_MAX_LENGTH + ' [truncated 500 chars]'.length);
    expect(result.startsWith('x'.repeat(RENDERER_LINE_MAX_LENGTH))).toBe(true);
  });

  it('should respect a custom max length', () => {
    expect(truncateRenderedLine('abcdef', 3)).toBe('abc [truncated 3 chars]');
  });
});
