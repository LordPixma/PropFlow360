import { z } from 'zod';

// Date format validation (YYYY-MM-DD)
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)');

// Block types
export const blockTypeSchema = z.enum(['booking', 'hold', 'blocked', 'maintenance', 'owner_use']);

// Check availability request
export const checkAvailabilitySchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  startDate: dateString,
  endDate: dateString,
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

// Create availability block
export const createBlockSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  blockType: blockTypeSchema,
  startDate: dateString,
  endDate: dateString,
  bookingId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  source: z.string().max(50).optional(),
  externalId: z.string().max(255).optional(),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

// Update availability block
export const updateBlockSchema = z.object({
  blockType: blockTypeSchema.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  notes: z.string().max(1000).optional(),
});

// Hold request (for booking flow)
export const createHoldSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  startDate: dateString,
  endDate: dateString,
  ttlMinutes: z.number().int().min(1).max(60).default(15),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

// Confirm hold (convert to booking)
export const confirmHoldSchema = z.object({
  holdToken: z.string().min(1, 'Hold token is required'),
  bookingId: z.string().min(1, 'Booking ID is required'),
});

// Release hold
export const releaseHoldSchema = z.object({
  holdToken: z.string().min(1, 'Hold token is required'),
});

// Get calendar for date range
export const getCalendarSchema = z.object({
  unitId: z.string().optional(),
  propertyId: z.string().optional(),
  startDate: dateString,
  endDate: dateString,
  includeHolds: z.boolean().default(false),
}).refine(
  (data) => data.unitId || data.propertyId,
  { message: 'Either unitId or propertyId is required' }
).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

// Calendar sync configuration
export const syncDirectionSchema = z.enum(['import', 'export', 'both']);

export const createCalendarSyncSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  name: z.string().min(1).max(100, 'Name must be 100 characters or less'),
  icsUrl: z.string().url('Invalid URL format'),
  syncDirection: syncDirectionSchema.default('import'),
  syncIntervalMinutes: z.number().int().min(15).max(1440).default(60),
  isActive: z.boolean().default(true),
});

export const updateCalendarSyncSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icsUrl: z.string().url().optional(),
  syncDirection: syncDirectionSchema.optional(),
  syncIntervalMinutes: z.number().int().min(15).max(1440).optional(),
  isActive: z.boolean().optional(),
});

// Type exports
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;
export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;
export type CreateHoldInput = z.infer<typeof createHoldSchema>;
export type ConfirmHoldInput = z.infer<typeof confirmHoldSchema>;
export type ReleaseHoldInput = z.infer<typeof releaseHoldSchema>;
export type GetCalendarInput = z.infer<typeof getCalendarSchema>;
export type CreateCalendarSyncInput = z.infer<typeof createCalendarSyncSchema>;
export type UpdateCalendarSyncInput = z.infer<typeof updateCalendarSyncSchema>;
export type BlockType = z.infer<typeof blockTypeSchema>;
export type SyncDirection = z.infer<typeof syncDirectionSchema>;
