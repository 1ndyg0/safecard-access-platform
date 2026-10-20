import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Nothing about an application may be saved until the applicant presses the
 * final submit. Every write to the intake API must therefore live inside
 * createAndSubmitApplication, which only the payment panel's submit button runs.
 */
const source = readFileSync(new URL('./ApplicationWizard.tsx', import.meta.url), 'utf8');
const start = source.indexOf('async function createAndSubmitApplication');
const end = source.indexOf('const progress = PROGRESS_STEPS');

describe('application wizard writes', () => {
  it('finds the single submit function', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });

  it.each(['/api/intake/case', '/api/intake/comprehension', '/api/consent/grant', '/api/intake/profile', '/api/intake/submit'])(
    'only writes to %s from the final submit',
    (endpoint) => {
      const outside = source.slice(0, start) + source.slice(end);
      expect(outside).not.toContain(endpoint);
      expect(source.slice(start, end)).toContain(endpoint);
    },
  );
});
