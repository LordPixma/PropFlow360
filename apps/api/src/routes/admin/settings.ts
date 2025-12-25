/**
 * Tenant Settings Routes
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { tenantSettings } from '@propflow360/db';
import { eq } from 'drizzle-orm';
import type { HonoEnv } from '../../types';

const app = new Hono<HonoEnv>();

// Get tenant settings
app.get('/', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const [settings] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!settings) {
    // Create default settings if not exists
    const settingsId = `set_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const now = new Date().toISOString();

    await db.insert(tenantSettings).values({
      id: settingsId,
      tenantId,
      timezone: 'UTC',
      currency: 'USD',
      locale: 'en-US',
      createdAt: now,
      updatedAt: now,
    });

    const [newSettings] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    return c.json({ settings: newSettings });
  }

  return c.json({ settings });
});

// Update tenant settings
app.patch('/', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const body = await c.req.json();
  const {
    businessName,
    businessEmail,
    businessPhone,
    businessAddress,
    website,
    logo,
    timezone,
    currency,
    locale,
    features,
    paymentSettings,
    bookingSettings,
    notificationSettings,
    maintenanceSettings,
  } = body;

  const [existing] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Settings not found' }, 404);
  }

  const now = new Date().toISOString();

  await db
    .update(tenantSettings)
    .set({
      businessName: businessName !== undefined ? businessName : existing.businessName,
      businessEmail: businessEmail !== undefined ? businessEmail : existing.businessEmail,
      businessPhone: businessPhone !== undefined ? businessPhone : existing.businessPhone,
      businessAddress: businessAddress !== undefined ? JSON.stringify(businessAddress) : existing.businessAddress,
      website: website !== undefined ? website : existing.website,
      logo: logo !== undefined ? logo : existing.logo,
      timezone: timezone !== undefined ? timezone : existing.timezone,
      currency: currency !== undefined ? currency : existing.currency,
      locale: locale !== undefined ? locale : existing.locale,
      features: features !== undefined ? JSON.stringify(features) : existing.features,
      paymentSettings: paymentSettings !== undefined ? JSON.stringify(paymentSettings) : existing.paymentSettings,
      bookingSettings: bookingSettings !== undefined ? JSON.stringify(bookingSettings) : existing.bookingSettings,
      notificationSettings: notificationSettings !== undefined ? JSON.stringify(notificationSettings) : existing.notificationSettings,
      maintenanceSettings: maintenanceSettings !== undefined ? JSON.stringify(maintenanceSettings) : existing.maintenanceSettings,
      updatedAt: now,
    })
    .where(eq(tenantSettings.tenantId, tenantId));

  const [settings] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  return c.json({ settings });
});

export default app;
