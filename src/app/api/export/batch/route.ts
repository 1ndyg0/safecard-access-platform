/**
 * POST /api/export/batch
 *
 * Create a PRC export batch.
 * Requires: finance_export or school_admin role, MFA, reauthentication.
 * Logs: reason, creator, timestamp, checksum.
 *
 * Returns immutable batch metadata. Content is served only by the separately
 * authorized, MFA-gated download endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createExportBatch } from '@/lib/export';
import { createExportBatchSchema } from '@/lib/validation/schemas';
import { requireStaffAuth } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    // Require authenticated staff (not anonymous)
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = createExportBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

    const result = await createExportBatch({
      campaignId: parsed.data.campaign_id,
      creationReason: parsed.data.creation_reason,
      caseIds: parsed.data.case_ids,
      reauthMethod: 'mfa',
      format: parsed.data.format,
      userId: auth.userId,
      userIp: ip,
    });

    return NextResponse.json(
      {
        batchId: result.batchId,
        batchRef: result.batchRef,
        recordCount: result.recordCount,
        checksum: result.checksum,
        format: parsed.data.format,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'Export batch creation');
  }
}
