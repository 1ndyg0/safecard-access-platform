/**
 * GET /api/admin/campaigns?org_id=xxx
 * POST /api/admin/campaigns
 * PATCH /api/admin/campaigns
 *
 * Campaign lifecycle management.
 * GET: List campaigns for an organization.
 * POST: Create a new pilot campaign.
 * PATCH: Update campaign settings (capacity, dates, status).
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { writeAuditEvent } from '@/lib/audit';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, created, badRequest, forbidden, notFound, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const createCampaignSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(3).max(200),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  start_date: z.string().date(),
  end_date: z.string().date().nullable().optional(),
  max_applications: z.number().int().positive().max(10000).default(50),
  max_sponsors: z.number().int().positive().max(500),
  membership_fee: z.number().positive().max(100000),
  approved_fields: z.array(z.string().min(1)).max(50),
  approved_payment_routes: z.array(z.record(z.string(), z.unknown())).max(10),
  stop_conditions: z.array(z.record(z.string(), z.unknown())).max(20),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateCampaignSchema = z.object({
  campaign_id: z.string().uuid(),
  name: z.string().min(3).max(200).optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().nullable().optional(),
  max_applications: z.number().int().positive().max(10000).optional(),
  max_sponsors: z.number().int().positive().max(500).optional(),
  membership_fee: z.number().positive().max(100000).optional(),
  approved_fields: z.array(z.string().min(1)).max(50).optional(),
  approved_payment_routes: z.array(z.record(z.string(), z.unknown())).max(10).optional(),
  stop_conditions: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();
    const orgId = request.nextUrl.searchParams.get('org_id');
    if (!orgId) return badRequest('org_id is required');
    const roleCheck = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'prc_liaison'], undefined, orgId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from('pilot_campaigns')
      .select(`
        id, organization_id, name, slug, start_date, end_date,
        max_applications, max_sponsors, membership_fee, approved_fields,
        approved_payment_routes, stop_conditions, is_active, metadata,
        created_at, updated_at
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list campaigns: ${error.message}`);

    return success({ campaigns: data ?? [] });
  } catch (error) {
    return handleApiError(error, 'Campaign list');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = createCampaignSchema.parse(body);

    const roleCheck = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin'], undefined, parsed.organization_id);
    if (!roleCheck.allowed) return forbidden('Only organization administrators can create campaigns');

    // Validate dates
    if (parsed.end_date && parsed.end_date < parsed.start_date) {
      return badRequest('end_date must be on or after start_date');
    }

    const admin = getSupabaseAdminClient();

    // Verify organization exists
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('id', parsed.organization_id)
      .single();

    if (!org) return notFound('Organization not found');

    const { data, error } = await admin
      .from('pilot_campaigns')
      .insert({
        organization_id: parsed.organization_id,
        name: parsed.name,
        slug: parsed.slug,
        start_date: parsed.start_date,
        end_date: parsed.end_date ?? null,
        max_applications: parsed.max_applications,
        max_sponsors: parsed.max_sponsors,
        membership_fee: parsed.membership_fee,
        approved_fields: parsed.approved_fields,
        approved_payment_routes: parsed.approved_payment_routes,
        stop_conditions: parsed.stop_conditions,
        metadata: parsed.metadata ?? {},
      })
      .select('id, name')
      .single();

    if (error) throw new Error(`Failed to create campaign: ${error.message}`);

    await writeAuditEvent({
      event_type: 'campaign_created',
      actor_id: auth.userId,
      actor_type: 'user',
      action: `Created campaign "${parsed.name}"`,
      campaign_id: data.id,
      target_type: 'pilot_campaign',
      target_id: data.id,
      details: {
        max_sponsors: parsed.max_sponsors,
        max_applications: parsed.max_applications,
        start_date: parsed.start_date,
        end_date: parsed.end_date,
      },
    });

    return created({
      campaignId: data.id,
      name: data.name,
    });
  } catch (error) {
    return handleApiError(error, 'Campaign creation');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = updateCampaignSchema.parse(body);

    const admin = getSupabaseAdminClient();

    // Get existing campaign
    const { data: existing } = await admin
      .from('pilot_campaigns')
      .select(`
        id, organization_id, name, start_date, end_date, max_applications,
        max_sponsors, membership_fee, approved_fields, approved_payment_routes,
        stop_conditions, is_active, metadata
      `)
      .eq('id', parsed.campaign_id)
      .single();

    if (!existing) return notFound('Campaign not found');
    const roleCheck = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin'], parsed.campaign_id);
    if (!roleCheck.allowed) return forbidden('Only campaign administrators can update campaigns');

    // Build update payload (only include changed fields)
    const updates: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    const fields = [
      'name', 'start_date', 'end_date', 'max_applications', 'max_sponsors',
      'membership_fee', 'approved_fields', 'approved_payment_routes',
      'stop_conditions', 'is_active', 'metadata',
    ] as const;

    for (const field of fields) {
      const value = parsed[field as keyof typeof parsed];
      if (value !== undefined && value !== existing[field as keyof typeof existing]) {
        updates[field] = value;
        changes[field] = {
          from: existing[field as keyof typeof existing],
          to: value,
        };
      }
    }

    if (Object.keys(updates).length === 0) {
      return success({ updated: false, message: 'No changes detected' });
    }

    // Validate date ordering if either date changed
    const startDate = (updates.start_date ?? existing.start_date) as string;
    const endDate = (updates.end_date ?? existing.end_date) as string | null;
    if (endDate && endDate < startDate) {
      return badRequest('end_date must be on or after start_date');
    }

    const { error } = await admin
      .from('pilot_campaigns')
      .update(updates)
      .eq('id', parsed.campaign_id);

    if (error) throw new Error(`Failed to update campaign: ${error.message}`);

    await writeAuditEvent({
      event_type: 'campaign_updated',
      actor_id: auth.userId,
      actor_type: 'user',
      action: `Updated campaign "${existing.name}"`,
      campaign_id: parsed.campaign_id,
      target_type: 'pilot_campaign',
      target_id: parsed.campaign_id,
      details: { changes },
    });

    return success({ updated: true, changes: Object.keys(changes) });
  } catch (error) {
    return handleApiError(error, 'Campaign update');
  }
}
