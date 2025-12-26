import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and, desc } from 'drizzle-orm';
import { propertyMedia, properties, units } from '@propflow360/db/schema';
import type { AppEnv } from '../../lib/context';
import { success, created, noContent, notFound, badRequest } from '../../lib/responses';
import { authMiddleware, requirePermission } from '../../middleware/auth';
import { tenancyMiddleware, requireTenant } from '../../middleware/tenancy';

const mediaRouter = new Hono<AppEnv>();

// Apply middleware to all routes
mediaRouter.use('*', authMiddleware);
mediaRouter.use('*', tenancyMiddleware);
mediaRouter.use('*', requireTenant);

const createUploadUrlSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  type: z.enum(['photo', 'floorplan', 'video', 'document', '360_tour']),
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

const _createMediaSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  type: z.enum(['photo', 'floorplan', 'video', 'document', '360_tour']),
  url: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  altText: z.string().max(200).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isCover: z.boolean().default(false),
});

const updateMediaSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  altText: z.string().max(200).optional(),
  sortOrder: z.number().int().optional(),
  isCover: z.boolean().optional(),
});

// Get upload URL (pre-signed URL for direct upload to R2)
mediaRouter.post(
  '/upload-url',
  requirePermission('properties:write'),
  zValidator('json', createUploadUrlSchema),
  async (c) => {
    const tenantId = c.get('tenantId')!;
    const db = c.get('db');
    const { propertyId, unitId, type, filename, contentType } = c.req.valid('json');

    // Validate property/unit ownership
    if (propertyId) {
      const property = await db.query.properties.findFirst({
        where: and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)),
      });
      if (!property) {
        return badRequest(c, 'Property not found');
      }
    }

    if (unitId) {
      const unit = await db.query.units.findFirst({
        where: and(eq(units.id, unitId), eq(units.tenantId, tenantId)),
      });
      if (!unit) {
        return badRequest(c, 'Unit not found');
      }
    }

    // Generate unique key
    const fileId = nanoid();
    const extension = filename.split('.').pop() || '';
    const key = `tenants/${tenantId}/${propertyId || 'general'}/${unitId || 'property'}/${type}/${fileId}.${extension}`;

    // For R2 signed URLs, we need to use the multipart upload API
    // In production, you would use a Worker to generate signed URLs
    // For now, we'll return the key and expect direct upload through the API

    // Create a multipart upload
    const multipartUpload = await c.env.R2_MEDIA.createMultipartUpload(key, {
      httpMetadata: {
        contentType,
      },
      customMetadata: {
        tenantId,
        propertyId: propertyId || '',
        unitId: unitId || '',
        type,
        originalFilename: filename,
      },
    });

    return success(c, {
      uploadId: multipartUpload.uploadId,
      key,
      // In a full implementation, you would return signed URLs for each part
      // For simplicity, we'll use a different approach with direct API upload
    });
  }
);

// Upload file directly (for smaller files)
mediaRouter.post('/upload', requirePermission('properties:write'), async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const propertyId = formData.get('propertyId') as string | null;
  const unitId = formData.get('unitId') as string | null;
  const type = formData.get('type') as string;

  if (!file) {
    return badRequest(c, 'No file provided');
  }

  if (!type || !['photo', 'floorplan', 'video', 'document', '360_tour'].includes(type)) {
    return badRequest(c, 'Invalid file type');
  }

  // Validate property/unit ownership
  if (propertyId) {
    const property = await db.query.properties.findFirst({
      where: and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)),
    });
    if (!property) {
      return badRequest(c, 'Property not found');
    }
  }

  if (unitId) {
    const unit = await db.query.units.findFirst({
      where: and(eq(units.id, unitId), eq(units.tenantId, tenantId)),
    });
    if (!unit) {
      return badRequest(c, 'Unit not found');
    }
  }

  // Generate key
  const fileId = nanoid();
  const extension = file.name.split('.').pop() || '';
  const key = `tenants/${tenantId}/${propertyId || 'general'}/${unitId || 'property'}/${type}/${fileId}.${extension}`;

  // Upload to R2
  await c.env.R2_MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      tenantId,
      propertyId: propertyId || '',
      unitId: unitId || '',
      type,
      originalFilename: file.name,
    },
  });

  // Create media record
  const mediaId = nanoid();
  const newMedia = await db
    .insert(propertyMedia)
    .values({
      id: mediaId,
      tenantId,
      propertyId,
      unitId,
      type: type as 'photo' | 'floorplan' | 'video' | 'document' | '360_tour',
      url: key,
      title: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    })
    .returning();

  return created(c, newMedia[0]);
});

// List media for property/unit
mediaRouter.get('/', requirePermission('properties:read'), async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');
  const propertyId = c.req.query('propertyId');
  const unitId = c.req.query('unitId');

  const conditions = [eq(propertyMedia.tenantId, tenantId)];

  if (propertyId) {
    conditions.push(eq(propertyMedia.propertyId, propertyId));
  }

  if (unitId) {
    conditions.push(eq(propertyMedia.unitId, unitId));
  }

  const media = await db
    .select()
    .from(propertyMedia)
    .where(and(...conditions))
    .orderBy(propertyMedia.sortOrder, desc(propertyMedia.createdAt));

  return success(c, media);
});

// Get signed URL for viewing media
mediaRouter.get('/:id/url', requirePermission('properties:read'), async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');
  const mediaId = c.req.param('id');

  const media = await db.query.propertyMedia.findFirst({
    where: and(eq(propertyMedia.id, mediaId), eq(propertyMedia.tenantId, tenantId)),
  });

  if (!media) {
    return notFound(c, 'Media');
  }

  // Get object from R2 and create signed URL
  const object = await c.env.R2_MEDIA.get(media.url);

  if (!object) {
    return notFound(c, 'File');
  }

  // For private R2 buckets, you would generate a signed URL here
  // For now, return the object directly or a temporary URL pattern
  // In production, use R2's signed URL feature

  return success(c, {
    url: `/api/media/${mediaId}/download`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
  });
});

// Download media file
mediaRouter.get('/:id/download', requirePermission('properties:read'), async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');
  const mediaId = c.req.param('id');

  const media = await db.query.propertyMedia.findFirst({
    where: and(eq(propertyMedia.id, mediaId), eq(propertyMedia.tenantId, tenantId)),
  });

  if (!media) {
    return notFound(c, 'Media');
  }

  const object = await c.env.R2_MEDIA.get(media.url);

  if (!object) {
    return notFound(c, 'File');
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return new Response(object.body, {
    headers,
  });
});

// Update media metadata
mediaRouter.patch(
  '/:id',
  requirePermission('properties:write'),
  zValidator('json', updateMediaSchema),
  async (c) => {
    const tenantId = c.get('tenantId')!;
    const db = c.get('db');
    const mediaId = c.req.param('id');
    const input = c.req.valid('json');

    const existing = await db.query.propertyMedia.findFirst({
      where: and(eq(propertyMedia.id, mediaId), eq(propertyMedia.tenantId, tenantId)),
    });

    if (!existing) {
      return notFound(c, 'Media');
    }

    // If setting as cover, unset other covers for same property/unit
    if (input.isCover) {
      if (existing.propertyId) {
        await db
          .update(propertyMedia)
          .set({ isCover: false })
          .where(
            and(
              eq(propertyMedia.propertyId, existing.propertyId),
              eq(propertyMedia.tenantId, tenantId)
            )
          );
      }
      if (existing.unitId) {
        await db
          .update(propertyMedia)
          .set({ isCover: false })
          .where(and(eq(propertyMedia.unitId, existing.unitId), eq(propertyMedia.tenantId, tenantId)));
      }
    }

    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.altText !== undefined) updateData.altText = input.altText;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
    if (input.isCover !== undefined) updateData.isCover = input.isCover;

    const updated = await db
      .update(propertyMedia)
      .set(updateData)
      .where(and(eq(propertyMedia.id, mediaId), eq(propertyMedia.tenantId, tenantId)))
      .returning();

    return success(c, updated[0]);
  }
);

// Delete media
mediaRouter.delete('/:id', requirePermission('properties:delete'), async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');
  const mediaId = c.req.param('id');

  const media = await db.query.propertyMedia.findFirst({
    where: and(eq(propertyMedia.id, mediaId), eq(propertyMedia.tenantId, tenantId)),
  });

  if (!media) {
    return notFound(c, 'Media');
  }

  // Delete from R2
  await c.env.R2_MEDIA.delete(media.url);

  // Delete thumbnail if exists
  if (media.thumbnailUrl) {
    await c.env.R2_MEDIA.delete(media.thumbnailUrl);
  }

  // Delete record
  await db.delete(propertyMedia).where(eq(propertyMedia.id, mediaId));

  return noContent(c);
});

export { mediaRouter };
