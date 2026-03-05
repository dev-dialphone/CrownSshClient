import { z } from 'zod';

export const addTagSchema = z.object({
  body: z.object({
    tagText: z.string().min(1, 'Tag text is required').max(50, 'Tag must be 50 characters or less'),
  }),
  params: z.object({
    vmId: z.string().min(1, 'VM ID is required'),
  }),
});

export const requestTagChangeSchema = z.object({
  body: z.object({
    tagText: z.string().min(1, 'Tag text is required').max(50, 'Tag must be 50 characters or less'),
    requestType: z.enum(['add', 'remove']),
    existingTagIndex: z.number().int().min(0).optional(),
  }),
  params: z.object({
    vmId: z.string().min(1, 'VM ID is required'),
  }),
});

export const reviewTagRequestSchema = z.object({
  body: z.object({
    approved: z.boolean(),
  }),
  params: z.object({
    requestId: z.string().min(1, 'Request ID is required'),
  }),
});

export const removeTagSchema = z.object({
  body: z.object({
    tagIndex: z.number().int().min(0, 'Tag index is required'),
  }),
  params: z.object({
    vmId: z.string().min(1, 'VM ID is required'),
  }),
});
