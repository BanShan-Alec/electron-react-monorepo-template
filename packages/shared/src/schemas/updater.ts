import { z } from 'zod';

export const updaterStateSchema = z.enum([
  'idle',
  'checking',
  'available',
  'downloading',
  'downloaded',
  'cancelled',
  'up-to-date',
  'error',
]);

export const updaterProgressSchema = z.object({
  percent: z.number(),
  bytesPerSecond: z.number().default(0),
  transferred: z.number().default(0),
  total: z.number().default(0),
});

export const releaseInfoSchema = z.object({
  version: z.string(),
  releaseDate: z.string().optional(),
  releaseNotes: z.array(z.string()).optional(),
});

export const updaterSnapshotSchema = z.object({
  state: updaterStateSchema,
  version: z.string().optional(),
  /** 当前运行版本：主进程 app.getVersion() 注入；老主进程缺省时渲染端不展示版本行 */
  currentVersion: z.string().optional(),
  releaseDate: z.string().optional(),
  releaseNotes: z.array(z.string()).optional(),
  progress: updaterProgressSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
});

export const updaterMockActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('state'),
    payload: updaterSnapshotSchema,
  }),
  z.object({
    type: z.literal('idle'),
  }),
  z.object({
    type: z.literal('checking'),
  }),
  z.object({
    type: z.literal('available'),
    version: z.string().default('2.0.0'),
    releaseDate: z.string().optional(),
    releaseNotes: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('progress'),
    percent: z.number(),
    bytesPerSecond: z.number().optional(),
    transferred: z.number().optional(),
    total: z.number().optional(),
  }),
  z.object({
    type: z.literal('downloaded'),
  }),
  z.object({
    type: z.literal('cancelled'),
  }),
  z.object({
    type: z.literal('up-to-date'),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string().default('Failed to download update'),
    code: z.string().nullable().optional(),
  }),
]);
