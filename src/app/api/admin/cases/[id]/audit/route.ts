/**
 * GET /api/admin/cases/[id]/audit
 *
 * Immutable audit timeline for one case.
 *
 * Audit rows are written by every module and their `details` blob is not
 * a stable contract, so this route projects a fixed shape — action,
 * actor, timestamp, prior and resulting state, safe reason, severity —
 * rather than forwarding the raw blob to the browser. A details blob
 * written elsewhere could carry a free-text field that was never meant
 * for a screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, forbidden, notFound } from '@/lib/api/response';
import { assertCampaignAccess, rolesForCampaign, resolveStaffScope } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { resolveCaseAccessPolicy } from '@/lib/admin/field-policy';

export const dynamic = 'force-dynamic';

/** Reasons are shown to staff and may reach an applicant, so cap them. */
function safeReason(details: Record<string, unknown> | null): string | null {
  const reason = details?.reason;
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  return trimmed.length > 500 ? `${trimmed.slice(0, 497)}...` : trimmed;
}

function stateOf(details: Record<string, unknown> | null, key: string): string | null {
  const value = details?.[key];
  return typeof value === 'string' ? value : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return badRequest('Case id must be a UUID.');

    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .catch(50)
      .parse(request.nextUrl.searchParams.get('limit') ?? 50);

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,campaign_id')
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');
    assertCampaignAccess(scope, caseRecord.campaign_id as string);
    const policy = resolveCaseAccessPolicy(
      rolesForCampaign(scope, caseRecord.campaign_id as string),
    );
    if (!policy?.canViewAudit) return forbidden('Your role cannot view the case audit history.');

    const { data, error } = await admin
      .from('audit_events')
      .select('id,event_type,action,actor_id,actor_type,details,severity,created_at')
      .eq('case_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to load audit history: ${error.message}`);

    const actorIds = [
      ...new Set(
        (data ?? [])
          .map((row) => row.actor_id)
          .filter((value): value is string => typeof value === 'string'),
      ),
    ];
    const actorNames = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actors, error: actorError } = await admin
        .from('users')
        .select('id,full_name')
        .in('id', actorIds);
      if (actorError) throw new Error(`Failed to load actors: ${actorError.message}`);
      actors?.forEach((actor) => actorNames.set(actor.id as string, actor.full_name as string));
    }

    const events = (data ?? []).map((row) => {
      const details = (row.details ?? null) as Record<string, unknown> | null;
      return {
        id: row.id,
        action: row.action,
        eventType: row.event_type,
        actorType: row.actor_type,
        actorName:
          typeof row.actor_id === 'string'
            ? (actorNames.get(row.actor_id) ?? 'Unknown staff member')
            : 'System',
        occurredAt: row.created_at,
        priorState: stateOf(details, 'prior_state'),
        resultingState: stateOf(details, 'resulting_state'),
        reason: safeReason(details),
        severity: row.severity,
      };
    });

    return NextResponse.json({ events }, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    return handleAdminError(error, 'Admin case audit');
  }
}
