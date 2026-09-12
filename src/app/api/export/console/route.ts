/**
 * GET /api/export/console
 *
 * Minimal, campaign-scoped data for the export workspace. Eligible rows carry
 * case references and workflow states only; exported profile values remain in
 * the immutable batch and are available only through the MFA-gated download.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import {
  assertCampaignAccess,
  listAccessibleCampaigns,
  resolveStaffScope,
  rolesForCampaign,
} from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { badRequest, forbidden, notFound } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const EXPORT_ROLES = [
  'finance_export',
  'school_admin',
  'prc_liaison',
  'privacy_admin_owner',
] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const requestedCampaign = request.nextUrl.searchParams.get('campaign_id');
    const requestedBatch = request.nextUrl.searchParams.get('batch_id');
    if (requestedCampaign && !z.string().uuid().safeParse(requestedCampaign).success) {
      return badRequest('campaign_id must be a UUID.');
    }
    if (requestedBatch && !z.string().uuid().safeParse(requestedBatch).success) {
      return badRequest('batch_id must be a UUID.');
    }

    const allCampaigns = await listAccessibleCampaigns(scope);
    const campaigns = allCampaigns.filter((campaign) =>
      rolesForCampaign(scope, campaign.id as string).some((role) =>
        EXPORT_ROLES.includes(role as (typeof EXPORT_ROLES)[number]),
      ),
    );
    const campaignId = requestedCampaign ?? (campaigns[0]?.id as string | undefined);

    if (!campaignId) {
      return forbidden('No export or PRC liaison role is assigned to an accessible campaign.');
    }
    assertCampaignAccess(scope, campaignId);
    const roles = rolesForCampaign(scope, campaignId);
    if (!roles.some((role) => EXPORT_ROLES.includes(role as (typeof EXPORT_ROLES)[number]))) {
      return forbidden('Your role cannot access exports for this campaign.');
    }

    const admin = getSupabaseAdminClient();
    const { data: eligible, error: eligibleError } = await admin
      .from('recipient_cases')
      .select(
        'id,application_ref,application_state,application_review_state,payment_state,prc_handoff_state,updated_at',
      )
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .eq('consent_state', 'agreed')
      .in('application_state', ['submitted', 'resubmitted'])
      .eq('application_review_state', 'approved')
      .eq('payment_state', 'verified_by_official_source')
      .eq('prc_handoff_state', 'ready_for_export')
      .order('updated_at', { ascending: true })
      .limit(500);
    if (eligibleError) throw new Error(`Failed to load export eligibility: ${eligibleError.message}`);

    const { data: batches, error: batchError } = await admin
      .from('prc_export_batches')
      .select('id,batch_ref,record_count,checksum,format,created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (batchError) throw new Error(`Failed to load export batches: ${batchError.message}`);

    let selectedBatch: Record<string, unknown> | null = null;
    let items: Array<Record<string, unknown>> = [];
    if (requestedBatch) {
      const { data: batch, error } = await admin
        .from('prc_export_batches')
        .select('id,batch_ref,campaign_id,record_count,checksum,format,created_at')
        .eq('id', requestedBatch)
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load export batch: ${error.message}`);
      if (!batch) return notFound('Export batch not found for this campaign.');
      selectedBatch = batch as Record<string, unknown>;

      const { data, error: itemError } = await admin
        .from('prc_export_items')
        .select(
          'id,case_id,export_order,prc_status,prc_responded_at,prc_notes,correction_reason,prc_membership_id,prc_effective_date,prc_expiry_date,recipient_cases!inner(application_ref)',
        )
        .eq('batch_id', requestedBatch)
        .order('export_order', { ascending: true });
      if (itemError) throw new Error(`Failed to load export items: ${itemError.message}`);
      items = (data ?? []).map((item) => {
        const caseRecord = Array.isArray(item.recipient_cases)
          ? item.recipient_cases[0]
          : item.recipient_cases;
        return {
          id: item.id,
          case_id: item.case_id,
          application_ref: caseRecord?.application_ref,
          export_order: item.export_order,
          prc_status: item.prc_status,
          prc_responded_at: item.prc_responded_at,
          prc_notes: item.prc_notes,
          correction_reason: item.correction_reason,
          prc_membership_id: item.prc_membership_id,
          prc_effective_date: item.prc_effective_date,
          prc_expiry_date: item.prc_expiry_date,
        };
      });
    }

    return NextResponse.json(
      {
        campaigns,
        selectedCampaignId: campaignId,
        roles,
        capabilities: {
          canCreateBatch: roles.some((role) =>
            ['finance_export', 'school_admin'].includes(role),
          ),
          canAcknowledge: roles.includes('prc_liaison'),
        },
        eligibleCases: eligible ?? [],
        batches: batches ?? [],
        selectedBatch,
        items,
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Export console');
  }
}
