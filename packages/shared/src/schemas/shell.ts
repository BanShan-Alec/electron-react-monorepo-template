import { z } from 'zod';

export const showItemInFolderInputSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
});

export type ShowItemInFolderInput = z.infer<typeof showItemInFolderInputSchema>;
