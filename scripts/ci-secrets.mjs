import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
if (!process.env.GITHUB_ENV) throw new Error('This script requires a disposable GitHub Actions runner.');
for (const name of ['AUDIT_HASH_SALT', 'RATE_LIMIT_HASH_SALT', 'MEMBER_SESSION_SECRET', 'CRON_SECRET']) {
  const value = randomBytes(32).toString('hex');
  console.log(`::add-mask::${value}`);
  appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}
