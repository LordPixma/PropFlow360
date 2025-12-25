import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { health } from './health';
import { auth } from './auth';
import { propertiesRouter } from './properties';
import { unitsRouter } from './units';
import { mediaRouter } from './media';
import { calendarRouter } from './calendar';
import { bookingsRouter } from './bookings';
import { leasesRouter } from './leases';
import { paymentsRouter } from './payments';
import { webhooksRouter } from './payments/webhooks';
import { maintenanceRouter } from './maintenance';
import { vendorsRouter } from './vendors';
import { cleaningRouter } from './cleaning';
import notificationsRouter from './notifications';
import channelsRouter from './channels';
import analyticsRouter from './analytics';
import adminRouter from './admin';

const routes = new Hono<AppEnv>();

// Health check routes (no auth required)
routes.route('/health', health);

// Auth routes
routes.route('/auth', auth);

// Property routes
routes.route('/properties', propertiesRouter);

// Unit routes
routes.route('/units', unitsRouter);

// Media routes
routes.route('/media', mediaRouter);

// Calendar routes
routes.route('/calendar', calendarRouter);

// Booking routes
routes.route('/bookings', bookingsRouter);

// Lease routes
routes.route('/leases', leasesRouter);

// Payment routes
routes.route('/payments', paymentsRouter);

// Webhook routes (no auth - signature verification instead)
routes.route('/webhooks', webhooksRouter);

// Operations routes
routes.route('/maintenance', maintenanceRouter);
routes.route('/vendors', vendorsRouter);
routes.route('/cleaning', cleaningRouter);

// Notification routes
routes.route('/notifications', notificationsRouter);

// Channel Manager routes
routes.route('/channels', channelsRouter);

// Analytics routes
routes.route('/analytics', analyticsRouter);

// Admin routes
routes.route('/admin', adminRouter);

export { routes };
