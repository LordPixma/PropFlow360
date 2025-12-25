import { z } from 'zod';
import { paginationSchema, sortSchema } from './common';

export const unitTypeSchema = z.enum([
  'room',
  'apartment',
  'studio',
  'office',
  'entire_property',
  'suite',
  'villa',
]);

export const unitStatusSchema = z.enum(['active', 'inactive', 'maintenance', 'archived']);

export const priceTypeSchema = z.enum(['nightly', 'weekly', 'monthly']);

export const createUnitSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1).max(200),
  type: unitTypeSchema,
  description: z.string().max(5000).optional(),
  maxGuests: z.number().int().positive().default(2),
  bedrooms: z.number().int().min(0).default(1),
  beds: z.number().int().min(0).default(1),
  bathrooms: z.number().min(0).default(1),
  sizeSqm: z.number().positive().optional(),
  floor: z.number().int().optional(),
  amenities: z.array(z.string()).optional(),
});

export const updateUnitSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: unitTypeSchema.optional(),
  description: z.string().max(5000).optional().nullable(),
  maxGuests: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  beds: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  sizeSqm: z.number().positive().optional().nullable(),
  floor: z.number().int().optional().nullable(),
  amenities: z.array(z.string()).optional(),
  status: unitStatusSchema.optional(),
});

export const listUnitsSchema = paginationSchema.merge(sortSchema).extend({
  propertyId: z.string().optional(),
  status: unitStatusSchema.optional(),
  type: unitTypeSchema.optional(),
});

export const createUnitPricingSchema = z.object({
  unitId: z.string().min(1),
  name: z.string().min(1).max(100),
  priceType: priceTypeSchema,
  basePrice: z.number().int().positive(), // in pence
  minStay: z.number().int().positive().default(1),
  maxStay: z.number().int().positive().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  priority: z.number().int().default(0),
});

export const updateUnitPricingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priceType: priceTypeSchema.optional(),
  basePrice: z.number().int().positive().optional(),
  minStay: z.number().int().positive().optional(),
  maxStay: z.number().int().positive().optional().nullable(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type ListUnitsInput = z.infer<typeof listUnitsSchema>;
export type CreateUnitPricingInput = z.infer<typeof createUnitPricingSchema>;
export type UpdateUnitPricingInput = z.infer<typeof updateUnitPricingSchema>;
