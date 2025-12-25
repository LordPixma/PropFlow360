import { Hono } from 'hono';
import type { AppEnv } from '../../lib/context';

export const icsRouter = new Hono<AppEnv>();

/**
 * Generate ICS content from availability blocks
 */
function generateICS(
  unitName: string,
  propertyName: string,
  blocks: Array<{
    id: string;
    blockType: string;
    startDate: string;
    endDate: string;
    notes?: string;
  }>
): string {
  const now = new Date();
  const timestamp = formatICSDate(now);

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PropFlow360//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICS(unitName)} - ${escapeICS(propertyName)}
X-WR-TIMEZONE:UTC
`;

  for (const block of blocks) {
    const uid = `${block.id}@propflow360.com`;
    const summary = getBlockSummary(block.blockType);
    const startDate = formatICSDateOnly(block.startDate);
    const endDate = formatICSDateOnly(block.endDate);

    ics += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${timestamp}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${escapeICS(summary)}
DESCRIPTION:${escapeICS(block.notes || getBlockDescription(block.blockType))}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`;
  }

  ics += `END:VCALENDAR`;

  return ics;
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatICSDateOnly(dateStr: string): string {
  // dateStr is in YYYY-MM-DD format
  return dateStr.replace(/-/g, '');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function getBlockSummary(blockType: string): string {
  switch (blockType) {
    case 'booking':
      return 'Booked';
    case 'hold':
      return 'On Hold';
    case 'blocked':
      return 'Blocked';
    case 'maintenance':
      return 'Maintenance';
    case 'owner_use':
      return 'Owner Use';
    default:
      return 'Unavailable';
  }
}

function getBlockDescription(blockType: string): string {
  switch (blockType) {
    case 'booking':
      return 'This unit is booked';
    case 'hold':
      return 'This unit is on hold for a pending booking';
    case 'blocked':
      return 'This unit has been manually blocked';
    case 'maintenance':
      return 'This unit is under maintenance';
    case 'owner_use':
      return 'This unit is reserved for owner use';
    default:
      return 'This unit is unavailable';
  }
}

/**
 * Export ICS feed for a unit
 * GET /calendar/ics/:unitId/:token
 *
 * The token is stored on the unit for security
 * This endpoint does not require authentication - it uses the token instead
 */
icsRouter.get('/:unitId/:token', async (c) => {
  const db = c.get('db');
  const unitId = c.req.param('unitId');
  const token = c.req.param('token');

  try {
    // Verify unit and token
    const unit = await db
      .prepare(
        `SELECT u.id, u.name, u.ics_token, u.tenant_id, p.name as property_name
         FROM units u
         JOIN properties p ON p.id = u.property_id
         WHERE u.id = ?`
      )
      .bind(unitId)
      .first<{
        id: string;
        name: string;
        ics_token: string | null;
        tenant_id: string;
        property_name: string;
      }>();

    if (!unit) {
      return c.text('Unit not found', 404);
    }

    if (!unit.ics_token || unit.ics_token !== token) {
      return c.text('Invalid token', 403);
    }

    // Get availability blocks for the next year
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      .toISOString()
      .split('T')[0];

    const blocks = await db
      .prepare(
        `SELECT id, block_type as blockType, start_date as startDate, end_date as endDate, notes
         FROM availability_blocks
         WHERE tenant_id = ? AND unit_id = ?
           AND end_date > ?
           AND block_type != 'hold'
         ORDER BY start_date`
      )
      .bind(unit.tenant_id, unitId, startDate)
      .all<{
        id: string;
        blockType: string;
        startDate: string;
        endDate: string;
        notes?: string;
      }>();

    const icsContent = generateICS(unit.name, unit.property_name, blocks.results);

    return new Response(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${unit.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error('ICS export error:', err);
    return c.text('Internal server error', 500);
  }
});

/**
 * Generate a new ICS token for a unit
 * POST /calendar/ics/:unitId/token
 */
icsRouter.post('/:unitId/token', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const unitId = c.req.param('unitId');

  if (!tenantId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Verify unit belongs to tenant
    const unit = await db
      .prepare('SELECT id FROM units WHERE id = ? AND tenant_id = ?')
      .bind(unitId, tenantId)
      .first();

    if (!unit) {
      return c.json({ error: 'Unit not found' }, 404);
    }

    // Generate new token
    const newToken = crypto.randomUUID();

    await db
      .prepare('UPDATE units SET ics_token = ?, updated_at = ? WHERE id = ?')
      .bind(newToken, Math.floor(Date.now() / 1000), unitId)
      .run();

    // Return the ICS URL
    const baseUrl = c.req.url.split('/calendar')[0];
    const icsUrl = `${baseUrl}/calendar/ics/${unitId}/${newToken}`;

    return c.json({
      success: true,
      token: newToken,
      url: icsUrl,
    });
  } catch (err) {
    console.error('Generate ICS token error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Revoke ICS token for a unit
 * DELETE /calendar/ics/:unitId/token
 */
icsRouter.delete('/:unitId/token', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const unitId = c.req.param('unitId');

  if (!tenantId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await db
      .prepare('UPDATE units SET ics_token = NULL, updated_at = ? WHERE id = ? AND tenant_id = ?')
      .bind(Math.floor(Date.now() / 1000), unitId, tenantId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Unit not found' }, 404);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('Revoke ICS token error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
