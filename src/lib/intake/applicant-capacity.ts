import { ageOn } from '@/lib/validation/age';

export function applicantCategory(dateOfBirth: unknown, today = new Date()): 'adult' | 'child' | 'invalid' {
  if (typeof dateOfBirth !== 'string') return 'invalid';
  const age = ageOn(dateOfBirth, today);
  if (age === null || age < 3 || age > 85) return 'invalid';
  return age < 18 ? 'child' : 'adult';
}

