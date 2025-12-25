import { z } from 'zod';

export const tenantSlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
  .regex(/^[a-z]/, 'Slug must start with a letter')
  .regex(/[a-z0-9]$/, 'Slug must end with a letter or number');

export const tenantNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters')
  .trim();

export const tenantPlanSchema = z.enum(['starter', 'professional', 'enterprise']);

export const tenantRoleSchema = z.enum(['owner', 'manager', 'finance', 'ops', 'readonly']);

export const createTenantSchema = z.object({
  slug: tenantSlugSchema,
  name: tenantNameSchema,
  plan: tenantPlanSchema.optional().default('starter'),
});

export const updateTenantSchema = z.object({
  name: tenantNameSchema.optional(),
  plan: tenantPlanSchema.optional(),
  settings: z
    .object({
      timezone: z.string().optional(),
      currency: z.string().length(3).optional(),
      locale: z.string().optional(),
      checkInTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      checkOutTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
    })
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: tenantRoleSchema,
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
