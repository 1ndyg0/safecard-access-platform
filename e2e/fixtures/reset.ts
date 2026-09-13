import { execFileSync } from 'node:child_process';

/** Reset an explicitly disposable local database without weakening immutable-row triggers. */
export async function resetSyntheticDatabase(tables: readonly string[]): Promise<void> {
  const target = new URL(process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://missing.invalid');
  const connection = process.env.E2E_DATABASE_URL;
  if (!connection) throw new Error('E2E_DATABASE_URL must name the disposable database used by the API.');
  const database = new URL(connection);
  // Hosted staging resets require a separately reviewed backup/reset procedure.
  // These automated fixtures only reset the standard local Supabase stack.
  if (!['127.0.0.1', 'localhost'].includes(target.hostname)
      || !['127.0.0.1', 'localhost'].includes(database.hostname)
      || target.port !== '54321' || database.port !== '54322'
      || !['postgres:', 'postgresql:'].includes(database.protocol)) {
    throw new Error('Automatic fixture reset requires the isolated loopback Supabase stack.');
  }
  if (tables.some((table) => !/^[a-z_]+$/.test(table))) throw new Error('Invalid fixture table name.');
  // Also purge any @e2e.safecard.test users from auth.users. GoTrue's admin.deleteUser()
  // performs a soft-delete that leaves the identity mapping in place, which then causes
  // createUser() to return "already registered" while listUsers() no longer sees the user,
  // trapping createStaff() with no recovery path. Deleting the auth rows via SQL right after
  // truncating public.users (which drops the FK that would otherwise block the delete) gives
  // every seedWorld() a fully clean auth state, matching what public tables already have.
  const sql = [
    `TRUNCATE ${[...tables, 'users'].map((table) => `public.${table}`).join(', ')} CASCADE;`,
    `DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@e2e.safecard.test');`,
    `DELETE FROM auth.users WHERE email LIKE '%@e2e.safecard.test';`,
  ].join('\n');
  try {
    execFileSync('psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1'], {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PGHOST: database.hostname, PGPORT: database.port,
        PGDATABASE: database.pathname.slice(1),
        PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password),
      },
    });
  } catch {
    throw new Error('Disposable fixture reset failed; check PostgreSQL access and migration state.');
  }
}
