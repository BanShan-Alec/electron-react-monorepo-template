import { z } from 'zod';

export const configSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  minimizeToTray: z.boolean().default(true),
  language: z.string().default('zh-CN'),
  autoCheckUpdate: z.boolean().default(true),
  serverCounter: z.number().int().default(0),
});

export type AppConfig = z.infer<typeof configSchema>;

export const updateConfigInputSchema = configSchema.partial();
export type UpdateConfigInput = z.infer<typeof updateConfigInputSchema>;

export const DEFAULT_CONFIG: AppConfig = {
  theme: 'system',
  minimizeToTray: true,
  language: 'zh-CN',
  autoCheckUpdate: true,
  serverCounter: 0,
};
