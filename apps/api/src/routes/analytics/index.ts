/**
 * Analytics Routes
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import dashboard from './dashboard';

const app = new Hono<HonoEnv>();

// Mount dashboard routes
app.route('/dashboard', dashboard);

export default app;
