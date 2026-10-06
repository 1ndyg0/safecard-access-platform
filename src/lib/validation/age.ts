/** Calendar age, including whether the birthday has occurred this year. */
export function ageOn(dateOfBirth: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(today);
  const field = (name: string) => Number(parts.find((part) => part.type === name)?.value);
  const currentYear = field('year');
  const currentMonth = field('month');
  const currentDay = field('day');
  const age = currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
  return age >= 0 ? age : null;
}

export function isEligibleAge(dateOfBirth: string, today = new Date()): boolean {
  const age = ageOn(dateOfBirth, today);
  return age !== null && age >= 3 && age <= 85;
}
