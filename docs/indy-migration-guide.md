# SafeCard Pilot 2026 — Account Setup Guide for Indy

This is a one-time setup you run inside Supabase to create the login accounts for the pilot. It takes about 5 minutes.

---

## What this does

Running the SQL script below will create:
- ✅ Login accounts for `ivvuriarte@gmail.com` (Ian Vince) and `tigparagas@gmail.com` (Indy) with temporary password `Password123`
- ✅ All 6 admin roles for both accounts (school admin, PRC liaison, support agent, finance export, content approver, privacy admin)
- ✅ Ambassador entries tied to the **Safe Card Pilot 2026** campaign

---

## Steps

### 1. Open Supabase
Go to [https://supabase.com](https://supabase.com) and log in.

### 2. Open the SafeCard project
From your Supabase dashboard, click on the **SafeCard** project (not a new one — the existing one).

### 3. Open the SQL Editor
In the left sidebar, click **SQL Editor** (looks like a terminal icon `<>`).

### 4. Paste the SQL
Click **New query**, then paste the entire contents of the file `indy-pilot-accounts-setup.sql` (shared separately) into the editor.

### 5. Run it
Click the **Run** button (green play button, top right). You should see:
```
Success. No rows returned.
```
If you see any error, send a screenshot to Ian Vince before proceeding.

### 6. Verify it worked
Paste this into a new query and run it:
```sql
SELECT id, email FROM auth.users
WHERE email IN ('ivvuriarte@gmail.com', 'tigparagas@gmail.com');
```
You should see 2 rows — one for each email.

Then run this:
```sql
SELECT user_id, role FROM public.role_assignments
WHERE user_id IN (
  '00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001002'
);
```
You should see 12 rows — 6 roles for each account.

---

## After setup — first login

1. Go to the SafeCard app (link from Ian Vince)
2. Click **Admin / Staff login** or go to `/admin`
3. Log in with:
   - **Email:** `tigparagas@gmail.com`
   - **Password:** `Password123`
4. Change your password immediately after logging in

> ⚠️ Do NOT use `Password123` for anything real. This is a temporary pilot credential.

---

## Files shared

| File | What it is |
|------|-----------|
| `indy-pilot-accounts-setup.sql` | The SQL script to paste and run in Supabase |
| This guide | Step-by-step instructions |

---

Questions? Contact Ian Vince.
