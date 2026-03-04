import { z } from 'zod';

export const getMonitorMetricsSchema = z.object({
  body: z.object({
    environmentId: z.string().min(1, 'Environment ID is required'),
  }),
});
