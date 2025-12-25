/**
 * Channel Connections Routes
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { channelConnections, channelSyncLogs } from '@propflow360/db';
import { eq, and, desc } from 'drizzle-orm';
import { createChannelProvider } from '@propflow360/channels';
import type { HonoEnv } from '../../types';

const app = new Hono<HonoEnv>();

// List connections
app.get('/', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const connections = await db
    .select()
    .from(channelConnections)
    .where(eq(channelConnections.tenantId, tenantId))
    .orderBy(desc(channelConnections.createdAt));

  // Mask sensitive data
  const masked = connections.map(conn => ({
    ...conn,
    accessToken: conn.accessToken ? '****' : null,
    refreshToken: conn.refreshToken ? '****' : null,
    credentials: conn.credentials ? '****' : null,
  }));

  return c.json({ connections: masked });
});

// Get single connection
app.get('/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [connection] = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.id, id),
        eq(channelConnections.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!connection) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  // Mask sensitive data
  return c.json({
    connection: {
      ...connection,
      accessToken: connection.accessToken ? '****' : null,
      refreshToken: connection.refreshToken ? '****' : null,
      credentials: connection.credentials ? '****' : null,
    },
  });
});

// Create connection
app.post('/', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const body = await c.req.json();
  const {
    channel,
    name,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    credentials,
    config,
  } = body;

  if (!channel || !name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Test connection
  try {
    const provider = createChannelProvider(channel, {
      credentials: credentials || { accessToken, refreshToken, expiresAt: tokenExpiresAt },
    });

    const isValid = await provider.testConnection();
    if (!isValid) {
      return c.json({ error: 'Connection test failed' }, 400);
    }
  } catch (err) {
    return c.json({
      error: 'Invalid credentials',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 400);
  }

  const connectionId = `conn_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  // TODO: Encrypt sensitive fields before storing
  await db.insert(channelConnections).values({
    id: connectionId,
    tenantId,
    channel,
    name,
    status: 'active',
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    tokenExpiresAt: tokenExpiresAt || null,
    credentials: credentials ? JSON.stringify(credentials) : null,
    config: config ? JSON.stringify(config) : null,
    nextSyncAt: now, // Sync immediately
    createdAt: now,
    updatedAt: now,
  });

  const [connection] = await db
    .select()
    .from(channelConnections)
    .where(eq(channelConnections.id, connectionId))
    .limit(1);

  return c.json({
    connection: {
      ...connection,
      accessToken: connection.accessToken ? '****' : null,
      refreshToken: connection.refreshToken ? '****' : null,
      credentials: connection.credentials ? '****' : null,
    },
  }, 201);
});

// Update connection
app.patch('/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [existing] = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.id, id),
        eq(channelConnections.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  const body = await c.req.json();
  const { name, status, config } = body;

  const now = new Date().toISOString();

  await db
    .update(channelConnections)
    .set({
      name: name !== undefined ? name : existing.name,
      status: status !== undefined ? status : existing.status,
      config: config !== undefined ? JSON.stringify(config) : existing.config,
      updatedAt: now,
    })
    .where(eq(channelConnections.id, id));

  const [connection] = await db
    .select()
    .from(channelConnections)
    .where(eq(channelConnections.id, id))
    .limit(1);

  return c.json({
    connection: {
      ...connection,
      accessToken: connection.accessToken ? '****' : null,
      refreshToken: connection.refreshToken ? '****' : null,
      credentials: connection.credentials ? '****' : null,
    },
  });
});

// Delete connection
app.delete('/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [existing] = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.id, id),
        eq(channelConnections.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  await db.delete(channelConnections).where(eq(channelConnections.id, id));

  return c.json({ success: true });
});

// Test connection
app.post('/:id/test', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [connection] = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.id, id),
        eq(channelConnections.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!connection) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  try {
    const provider = createChannelProvider(connection.channel, {
      credentials: connection.credentials
        ? JSON.parse(connection.credentials)
        : {
            accessToken: connection.accessToken!,
            refreshToken: connection.refreshToken,
            expiresAt: connection.tokenExpiresAt,
          },
    });

    const isValid = await provider.testConnection();

    return c.json({ success: isValid });
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Trigger sync
app.post('/:id/sync', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [connection] = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.id, id),
        eq(channelConnections.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!connection) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  // Trigger sync worker via fetch
  try {
    const workerUrl = c.env.WORKER_CHANNEL_SYNC_URL || 'http://localhost:8788';
    const response = await fetch(`${workerUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: id }),
    });

    const result = await response.json();

    return c.json(result);
  } catch (err) {
    return c.json({
      error: 'Failed to trigger sync',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500);
  }
});

// Get sync logs
app.get('/:id/logs', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const limit = parseInt(c.req.query('limit') || '20', 10);

  const logs = await db
    .select()
    .from(channelSyncLogs)
    .where(
      and(
        eq(channelSyncLogs.connectionId, id),
        eq(channelSyncLogs.tenantId, tenantId)
      )
    )
    .orderBy(desc(channelSyncLogs.createdAt))
    .limit(limit);

  return c.json({ logs });
});

export default app;
