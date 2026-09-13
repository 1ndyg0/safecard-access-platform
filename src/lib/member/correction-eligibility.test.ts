import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import { evaluateCorrectionEligibility } from './correction';

const applicant = {
  id: 'case', consent_state: 'agreed', application_state: 'correction_needed',
  application_review_state: 'resubmission_requested',
  consent_content_version_id: 'consent-v1', privacy_notice_version_id: 'privacy-v1',
};
function registry(unavailable = false) {
  return { from: () => {
    let contentType = ''; let invalidEnum = false;
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        if (column === 'content_type') contentType = String(value);
        if (column === 'approval_status' && value !== 'approved') invalidEnum = true;
        return query;
      },
      order: () => query,
      limit: async () => unavailable || invalidEnum
        ? { data: null, error: { message: 'Content registry unavailable' } }
        : { error: null, data: [{
            id: contentType === 'consent_text' ? 'consent-v2' : 'privacy-v1',
            version: 2, locale: 'tl', is_material_change: true,
            change_summary: 'Synthetic retention revision',
          }] },
    };
    return query;
  } } as unknown as SupabaseClient;
}

describe('correction consent revalidation', () => {
  it('blocks an old consent after a newer approved material revision', async () => {
    const result = await evaluateCorrectionEligibility(registry(), applicant, 'fil');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('consent_renewal_required');
  });
  it('fails closed when the content registry cannot be read', async () => {
    await expect(evaluateCorrectionEligibility(registry(true), applicant, 'fil')).rejects.toThrow();
  });
});
