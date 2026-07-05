import { z } from 'zod';

export const timezoneSchema = z.enum(['Asia/Kolkata', 'UTC']);
export const aggregationSchema = z.enum(['1m', '3t', '5t', '15t', '30t', '1h']);

export const lookupParamsSchema = z.object({
  symbol: z.string().trim().min(1, 'Symbol is required.'),
  startTime: z.string().min(1, 'Start date & time is required.'),
  endTime: z.string().min(1, 'End date & time is required.'),
  timezone: timezoneSchema,
  aggregation: aggregationSchema,
});

export const usageTrackSchema = z.object({
  action: z.enum(['page_load', 'csv_download']),
  symbol: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timezone: timezoneSchema.optional(),
  aggregation: aggregationSchema.optional(),
  rowCount: z.number().optional(),
  csvFilename: z.string().optional(),
});

export const liquidationCheckSchema = z.object({
  symbol: z.string().trim().min(1, 'Symbol is required.'),
  side: z.enum(['Long', 'Short']),
  leverage: z.union([z.number(), z.string()]),
  entryPrice: z.union([z.number(), z.string()]),
  liquidationPrice: z.union([z.number(), z.string()]),
  liquidationTime: z.string().min(1, 'Reported liquidation time is required.'),
  timezone: timezoneSchema,
});

export const adminLoginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request body.';
}
