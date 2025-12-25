import { z } from 'zod';
import { paginationSchema, sortSchema } from './common';

export const propertyTypeSchema = z.enum([
  'residential',
  'commercial',
  'studio',
  'mixed',
  'holiday_let',
]);

export const propertyStatusSchema = z.enum(['active', 'inactive', 'archived']);

export const propertySettingsSchema = z
  .object({
    houseRules: z.array(z.string()).optional(),
    cancellationPolicy: z.enum(['flexible', 'moderate', 'strict']).optional(),
    minStay: z.number().int().positive().optional(),
    maxStay: z.number().int().positive().optional(),
    instantBooking: z.boolean().optional(),
    depositRequired: z.boolean().optional(),
    depositPercentage: z.number().min(0).max(100).optional(),
    cleaningFee: z.number().int().min(0).optional(),
    petPolicy: z.enum(['allowed', 'not_allowed', 'case_by_case']).optional(),
    smokingPolicy: z.enum(['allowed', 'not_allowed', 'designated_areas']).optional(),
    childrenPolicy: z.enum(['allowed', 'not_allowed']).optional(),
    eventsPolicy: z.enum(['allowed', 'not_allowed', 'case_by_case']).optional(),
  })
  .optional();

export const createPropertySchema = z.object({
  name: z.string().min(1).max(200),
  type: propertyTypeSchema,
  description: z.string().max(5000).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).default('GB'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().default('Europe/London'),
  currency: z.string().length(3).default('GBP'),
  checkInTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('15:00'),
  checkOutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('11:00'),
  settings: propertySettingsSchema,
});

export const updatePropertySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: propertyTypeSchema.optional(),
  description: z.string().max(5000).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().length(2).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  checkInTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  checkOutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  status: propertyStatusSchema.optional(),
  settings: propertySettingsSchema,
});

export const listPropertiesSchema = paginationSchema.merge(sortSchema).extend({
  status: propertyStatusSchema.optional(),
  type: propertyTypeSchema.optional(),
  search: z.string().optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type ListPropertiesInput = z.infer<typeof listPropertiesSchema>;
