import { appendFileSync, readFileSync } from 'node:fs';
if (!process.env.GITHUB_ENV) throw new Error('This script requires a disposable GitHub Actions runner.');
const content = readFileSync(process.argv[2], 'utf8');
const values = Object.fromEntries([...content.matchAll(/^([A-Z_]+)="([^"\r\n]*)"$/gm)].map((match) => [match[1], match[2]]));
for (const name of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'DB_URL']) {
  if (!values[name]) throw new Error(`Supabase status did not return ${name}.`);
}
if (new URL(values.API_URL).hostname !== '127.0.0.1') throw new Error('CI requires loopback Supabase.');
for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  E2E_SUPABASE_URL: values.API_URL,
  E2E_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  E2E_DATABASE_URL: values.DB_URL,
})) {
  console.log(`::add-mask::${value}`);
  appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}
