import 'server-only';
import { applicantCategory } from './applicant-capacity';
import { LaunchGateError } from '@/lib/safety/data-mode';

// Pending approved guardian rules: never substitute adult self-consent.
export function requireAdultSelfApplication(dateOfBirth: unknown): void {
  if (applicantCategory(dateOfBirth) !== 'adult') {
    throw new LaunchGateError('Adult self-application requires an eligible applicant aged 18 or older. The child/guardian workflow is awaiting approved rules.');
  }
}
