/**
 * GET /api/export/download?batch_id=xxx
 *
 * Download a previously created export batch.
 * Staff-only: requires finance_export or school_admin role.
 * Logs the download as an audit event.
 *
 * Persona: Aira downloads CSV for PRC handoff.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { requireMfa } from '@/lib/auth/permissions';
import { writeAuditEvent } from '@/lib/audit';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, forbidden, notFound, handleApiError } from '@/lib/api/response';
import { createHash, timingSafeEqual } from 'node:crypto';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const batchId = request.nextUrl.searchParams.get('batch_id');
    if (!batchId) return badRequest('batch_id is required');

    const admin = getSupabaseAdminClient();

    // Get the batch metadata
    const { data: batch } = await admin
      .from('prc_export_batches')
      .select('id, batch_ref, campaign_id, column_order, format, checksum, record_count')
      .eq('id', batchId)
      .single();

    if (!batch) return notFound('Export batch not found');

    const roleCheck = await requireAnyRole(
      auth.userId,
      ['finance_export', 'school_admin'],
      batch.campaign_id,
    );
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);
    const mfaCheck = await requireMfa();
    if (!mfaCheck.allowed) return forbidden(mfaCheck.reason);

    // Reconstruct the export data
    const { data: items } = await admin
      .from('prc_export_items')
      .select(`
        case_id, original_values, export_order
      `)
      .eq('batch_id', batchId)
      .order('export_order', { ascending: true });

    if (!items || items.length === 0) {
      return notFound('No records found in this batch');
    }

    // Build export rows
    const columnOrder = batch.column_order as string[];
    const rows = items.map((item) => item.original_values as Record<string, unknown>);

    if (batch.format === 'csv') {
      // CSV with formula injection protection
      const headerLine = columnOrder.map(sanitizeCell).join(',');
      const dataLines = rows.map((row: Record<string, unknown>) =>
        columnOrder.map((h) => sanitizeCell(row[h])).join(',')
      );
      const csv = [headerLine, ...dataLines].join('\n');
      assertChecksum(csv, batch.checksum);
      await auditDownload(auth.userId, batch, batchId);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${batch.batch_ref}.csv"`,
          'X-Checksum': batch.checksum,
        },
      });
    }

    // JSON format
    const jsonPayload = JSON.stringify(rows);
    assertChecksum(jsonPayload, batch.checksum);
    await auditDownload(auth.userId, batch, batchId);
    return NextResponse.json({
      batchRef: batch.batch_ref,
      checksum: batch.checksum,
      recordCount: batch.record_count,
      records: rows,
    });
  } catch (error) {
    return handleApiError(error, 'Export download');
  }
}

async function auditDownload(
  userId: string,
  batch: { batch_ref: string; campaign_id: string; record_count: number; format: string },
  batchId: string,
): Promise<void> {
  await writeAuditEvent({
    event_type: 'export_downloaded',
    actor_id: userId,
    actor_type: 'user',
    action: `Downloaded export batch ${batch.batch_ref}`,
    campaign_id: batch.campaign_id,
    target_type: 'prc_export_batch',
    target_id: batchId,
    details: { record_count: batch.record_count, format: batch.format },
  });
}

function assertChecksum(content: string, expected: string): void {
  const actual = createHash('sha256').update(content).digest();
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
    throw new Error('Export integrity check failed');
  }
}

function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
