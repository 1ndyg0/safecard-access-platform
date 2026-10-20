import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ACCESS_SOURCE = readFileSync(join(process.cwd(), 'src/lib/admin/access.ts'), 'utf8');

describe('campaign-scoped staff roles', () => {
  it('does not expand a campaign assignment into organization-wide access', () => {
    expect(ACCESS_SOURCE).toContain('.filter((assignment) => !assignment.campaign_id)');
    expect(ACCESS_SOURCE).toContain('!assignment.campaign_id');
    expect(ACCESS_SOURCE).toContain('rolesByCampaign');
  });

  it('denies a cross-campaign case id instead of returning an empty result', () => {
    expect(ACCESS_SOURCE).toContain('class CampaignAccessError');
    expect(ACCESS_SOURCE).toContain('Permission denied for this campaign.');
  });
});
