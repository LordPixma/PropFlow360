import { z } from 'zod';

// ============================================================
// Vendor Schemas
// ============================================================

export const vendorTypeSchema = z.enum([
  'cleaning',
  'maintenance',
  'plumbing',
  'electrical',
  'landscaping',
  'other',
]);

export const vendorStatusSchema = z.enum(['active', 'inactive']);

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: vendorTypeSchema,
  company: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  serviceAreas: z.array(z.string()).optional(), // Property IDs
  specialties: z.array(z.string()).optional(),
  hourlyRate: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('GBP'),
  rating: z.number().int().min(100).max(500).optional(), // 100-500 (1.0-5.0 stars * 100)
  notes: z.string().max(2000).optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const listVendorsSchema = z.object({
  type: vendorTypeSchema.optional(),
  status: vendorStatusSchema.optional(),
  propertyId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Maintenance Ticket Schemas
// ============================================================

export const maintenanceCategorySchema = z.enum([
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'pest',
  'other',
]);

export const maintenancePrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const maintenanceStatusSchema = z.enum([
  'open',
  'assigned',
  'in_progress',
  'on_hold',
  'resolved',
  'closed',
]);

export const createMaintenanceTicketSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  category: maintenanceCategorySchema,
  priority: maintenancePrioritySchema.default('medium'),
  reportedByGuest: z.string().max(200).optional(),
  reportedByEmail: z.string().email().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estimatedCost: z.number().int().min(0).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export const updateMaintenanceTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: maintenanceCategorySchema.optional(),
  priority: maintenancePrioritySchema.optional(),
  status: maintenanceStatusSchema.optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimatedCost: z.number().int().min(0).optional().nullable(),
  actualCost: z.number().int().min(0).optional().nullable(),
  imageUrls: z.array(z.string().url()).optional(),
  internalNotes: z.string().max(2000).optional().nullable(),
});

export const assignMaintenanceTicketSchema = z.object({
  assignedToVendorId: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
}).refine(
  (data) => data.assignedToVendorId || data.assignedToUserId,
  { message: 'Must assign to vendor or user' }
);

export const addMaintenanceCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required').max(2000),
  isInternal: z.boolean().default(false),
  statusChange: z.string().max(100).optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

export const listMaintenanceTicketsSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  status: maintenanceStatusSchema.optional(),
  priority: maintenancePrioritySchema.optional(),
  category: maintenanceCategorySchema.optional(),
  assignedToVendorId: z.string().optional(),
  assignedToUserId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Cleaning Schemas
// ============================================================

export const cleaningTypeSchema = z.enum([
  'checkout_clean',
  'turnaround',
  'deep_clean',
  'inspection',
  'maintenance_clean',
]);

export const cleaningStatusSchema = z.enum([
  'scheduled',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
]);

export const checklistItemSchema = z.object({
  id: z.string(),
  area: z.string().min(1).max(100),
  task: z.string().min(1).max(500),
  completed: z.boolean().default(false),
  notes: z.string().max(500).optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

export const createCleaningScheduleSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().min(1, 'Unit ID is required'),
  type: cleaningTypeSchema,
  bookingId: z.string().optional(),
  checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextCheckinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM
  estimatedDuration: z.number().int().min(1).max(480).optional(), // Max 8 hours
  assignedToVendorId: z.string().optional(),
  checklistTemplateId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  internalNotes: z.string().max(1000).optional(),
});

export const updateCleaningScheduleSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  estimatedDuration: z.number().int().min(1).max(480).optional(),
  assignedToVendorId: z.string().optional().nullable(),
  status: cleaningStatusSchema.optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
  issuesFound: z.string().max(2000).optional().nullable(),
  cost: z.number().int().min(0).optional().nullable(),
  beforeImageUrls: z.array(z.string().url()).optional(),
  afterImageUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(1000).optional().nullable(),
  internalNotes: z.string().max(1000).optional().nullable(),
});

export const completeCleaningSchema = z.object({
  checklistItems: z.array(checklistItemSchema),
  issuesFound: z.string().max(2000).optional(),
  maintenanceTicketsCreated: z.array(z.string()).optional(),
  cost: z.number().int().min(0).optional(),
  afterImageUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(1000).optional(),
});

export const listCleaningSchedulesSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  type: cleaningTypeSchema.optional(),
  status: cleaningStatusSchema.optional(),
  assignedToVendorId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Cleaning Checklist Template Schemas
// ============================================================

export const templateItemSchema = z.object({
  id: z.string(),
  area: z.string().min(1).max(100),
  task: z.string().min(1).max(500),
  required: z.boolean().optional(),
  estimatedMinutes: z.number().int().min(1).max(120).optional(),
});

export const createChecklistTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  type: cleaningTypeSchema,
  items: z.array(templateItemSchema).min(1, 'At least one item is required'),
  propertyId: z.string().optional(), // Property-specific template
  isDefault: z.boolean().default(false),
});

export const updateChecklistTemplateSchema = createChecklistTemplateSchema.partial().extend({
  status: z.enum(['active', 'archived']).optional(),
});

export const listChecklistTemplatesSchema = z.object({
  type: cleaningTypeSchema.optional(),
  propertyId: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Type exports
export type VendorType = z.infer<typeof vendorTypeSchema>;
export type VendorStatus = z.infer<typeof vendorStatusSchema>;
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type ListVendorsInput = z.infer<typeof listVendorsSchema>;

export type MaintenanceCategory = z.infer<typeof maintenanceCategorySchema>;
export type MaintenancePriority = z.infer<typeof maintenancePrioritySchema>;
export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;
export type CreateMaintenanceTicketInput = z.infer<typeof createMaintenanceTicketSchema>;
export type UpdateMaintenanceTicketInput = z.infer<typeof updateMaintenanceTicketSchema>;
export type AssignMaintenanceTicketInput = z.infer<typeof assignMaintenanceTicketSchema>;
export type AddMaintenanceCommentInput = z.infer<typeof addMaintenanceCommentSchema>;
export type ListMaintenanceTicketsInput = z.infer<typeof listMaintenanceTicketsSchema>;

export type CleaningType = z.infer<typeof cleaningTypeSchema>;
export type CleaningStatus = z.infer<typeof cleaningStatusSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type CreateCleaningScheduleInput = z.infer<typeof createCleaningScheduleSchema>;
export type UpdateCleaningScheduleInput = z.infer<typeof updateCleaningScheduleSchema>;
export type CompleteCleaningInput = z.infer<typeof completeCleaningSchema>;
export type ListCleaningSchedulesInput = z.infer<typeof listCleaningSchedulesSchema>;

export type TemplateItem = z.infer<typeof templateItemSchema>;
export type CreateChecklistTemplateInput = z.infer<typeof createChecklistTemplateSchema>;
export type UpdateChecklistTemplateInput = z.infer<typeof updateChecklistTemplateSchema>;
export type ListChecklistTemplatesInput = z.infer<typeof listChecklistTemplatesSchema>;
