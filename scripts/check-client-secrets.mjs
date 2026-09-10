import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const names = ['SUPABASE_SERVICE_ROLE_KEY', 'AUDIT_HASH_SALT', 'RATE_LIMIT_HASH_SALT', 'MEMBER_SESSION_SECRET', 'CRON_SECRET'];
const secrets = names.map((name) => {
  const value = process.env[name];
  if (!value || value.length < 16) throw new Error(`Missing verification secret: ${name}`);
  return { name, value };
});
let checked = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else {
      const content = await readFile(path, 'utf8');
      for (const { name, value } of secrets) {
        if (content.includes(value)) throw new Error(`Server-only secret ${name} found in client asset ${path}`);
      }
      checked += 1;
    }
  }
}
await scan('.next/static');
if (!checked) throw new Error('No production client assets were found.');
console.log(`Verified ${checked} client assets against ${secrets.length} server-only secrets.`);
