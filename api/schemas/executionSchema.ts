import { z } from 'zod';

export const executeCommandSchema = z.object({
  body: z.object({
    vmIds: z.array(z.string()).min(1, 'At least one VM ID is required'),
    command: z.string().optional(),
  }),
});
