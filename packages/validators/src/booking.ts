import { z } from 'zod';

// Date format validation (YYYY-MM-DD)
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)');

// Time format validation (HH:MM)
const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (use HH:MM)').optional();

// Booking status
export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
]);

// Payment status
export const paymentStatusSchema = z.enum([
  'unpaid',
  'partial',
  'paid',
  'refunded',
  'failed',
]);

// Booking source
export const bookingSourceSchema = z.enum([
  'direct',
  'airbnb',
  'booking_com',
  'vrbo',
  'expedia',
  'other',
]);

// Guest schema
export const createGuestSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(50).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateGuestSchema = createGuestSchema.partial();

// Create booking request
export const createBookingSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),

  // Guest - either existing ID or new guest data
  guestId: z.string().optional(),
  guest: createGuestSchema.optional(),

  // Dates
  checkInDate: dateString,
  checkOutDate: dateString,
  checkInTime: timeString,
  checkOutTime: timeString,

  // Guests
  adults: z.number().int().min(1).max(50).default(1),
  children: z.number().int().min(0).max(50).default(0),
  infants: z.number().int().min(0).max(10).default(0),

  // Pricing (optional - can be calculated)
  nightlyRate: z.number().int().min(0).optional(),
  cleaningFee: z.number().int().min(0).optional(),
  serviceFee: z.number().int().min(0).optional(),
  taxes: z.number().int().min(0).optional(),
  discount: z.number().int().min(0).optional(),

  // Source
  source: bookingSourceSchema.default('direct'),
  externalId: z.string().max(255).optional(),

  // Notes
  guestNotes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  specialRequests: z.string().max(2000).optional(),

  // Hold token if booking from a hold
  holdToken: z.string().optional(),
}).refine(
  (data) => data.guestId || data.guest,
  { message: 'Either guestId or guest data is required' }
).refine(
  (data) => data.checkOutDate > data.checkInDate,
  { message: 'Check-out date must be after check-in date', path: ['checkOutDate'] }
);

// Update booking
export const updateBookingSchema = z.object({
  checkInDate: dateString.optional(),
  checkOutDate: dateString.optional(),
  checkInTime: timeString,
  checkOutTime: timeString,
  adults: z.number().int().min(1).max(50).optional(),
  children: z.number().int().min(0).max(50).optional(),
  infants: z.number().int().min(0).max(10).optional(),
  guestNotes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  specialRequests: z.string().max(2000).optional(),
});

// Confirm booking (after payment)
export const confirmBookingSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  paymentId: z.string().optional(),
  amountPaid: z.number().int().min(0).optional(),
});

// Cancel booking
export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  reason: z.string().max(500).optional(),
  refundAmount: z.number().int().min(0).optional(),
});

// Check-in
export const checkInSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  notes: z.string().max(1000).optional(),
});

// Check-out
export const checkOutSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  notes: z.string().max(1000).optional(),
});

// List bookings
export const listBookingsSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  guestId: z.string().optional(),
  status: bookingStatusSchema.optional(),
  source: bookingSourceSchema.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Lease status
export const leaseStatusSchema = z.enum([
  'draft',
  'pending_signature',
  'active',
  'expired',
  'terminated',
  'renewed',
]);

// Lease type
export const leaseTypeSchema = z.enum(['fixed', 'month_to_month', 'periodic']);

// Payment frequency
export const paymentFrequencySchema = z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly']);

// Create lease
export const createLeaseSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),

  // Guest/Tenant
  guestId: z.string().optional(),
  guest: createGuestSchema.optional(),

  // Term
  startDate: dateString,
  endDate: dateString,
  leaseType: leaseTypeSchema.default('fixed'),

  // Rent
  monthlyRent: z.number().int().min(0, 'Monthly rent is required'),
  deposit: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('GBP'),

  // Payment
  rentDueDay: z.number().int().min(1).max(28).default(1),
  paymentFrequency: paymentFrequencySchema.default('monthly'),

  // Occupants
  primaryOccupant: z.string().min(1, 'Primary occupant is required'),
  additionalOccupants: z.array(z.string()).optional(),

  // Terms
  noticePeriodDays: z.number().int().min(0).default(30),
  breakClauseDate: dateString.optional(),
  specialTerms: z.string().max(5000).optional(),

  // Notes
  internalNotes: z.string().max(2000).optional(),
}).refine(
  (data) => data.guestId || data.guest,
  { message: 'Either guestId or guest data is required' }
).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

// Update lease
export const updateLeaseSchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  leaseType: leaseTypeSchema.optional(),
  monthlyRent: z.number().int().min(0).optional(),
  deposit: z.number().int().min(0).optional(),
  rentDueDay: z.number().int().min(1).max(28).optional(),
  paymentFrequency: paymentFrequencySchema.optional(),
  primaryOccupant: z.string().min(1).optional(),
  additionalOccupants: z.array(z.string()).optional(),
  noticePeriodDays: z.number().int().min(0).optional(),
  breakClauseDate: dateString.optional().nullable(),
  specialTerms: z.string().max(5000).optional(),
  internalNotes: z.string().max(2000).optional(),
});

// Terminate lease
export const terminateLeaseSchema = z.object({
  leaseId: z.string().min(1, 'Lease ID is required'),
  reason: z.string().max(500).optional(),
  terminationDate: dateString.optional(),
});

// List leases
export const listLeasesSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  guestId: z.string().optional(),
  status: leaseStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Type exports
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type ListBookingsInput = z.infer<typeof listBookingsSchema>;
export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
export type TerminateLeaseInput = z.infer<typeof terminateLeaseSchema>;
export type ListLeasesInput = z.infer<typeof listLeasesSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type BookingSource = z.infer<typeof bookingSourceSchema>;
export type LeaseStatus = z.infer<typeof leaseStatusSchema>;
export type LeaseType = z.infer<typeof leaseTypeSchema>;
export type PaymentFrequency = z.infer<typeof paymentFrequencySchema>;
