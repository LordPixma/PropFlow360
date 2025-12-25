/**
 * Admin Routes
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import tenants from './tenants';
import settings from './settings';
import audit from './audit';

const app = new Hono<HonoEnv>();

// Mount admin routes
app.route('/tenants', tenants);
app.route('/settings', settings);
app.route('/audit', audit);

export default app;
