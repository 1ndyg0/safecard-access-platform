---
name: safecard-platform
description: SafeCard Access Platform architecture, user roles, security boundaries, and canonical verification commands.
category: software-development
---

# SafeCard Access Platform Skill

## Repository Map
- `src/app/api/admin`: Staff and operations API routes (cases, overview, roles, users, campaigns).
- `src/app/api/intake`: Recipient intake and consent pipeline.
- `src/app/api/member`: Member session authentication and e-card access.
- `src/app/api/payment`: Payment handoff, payer notification, and staff verification.
- `src/app/api/export`: Dual-control PRC export batching, download, and acknowledgment.
- `src/components/admin`: Admin dashboard, case detail, submission queue, and role components.
- `src/lib/auth`: BFF permissions (`permissions.ts`), staff session (`session.ts`), and member session (`member-session.ts`).
- `supabase/migrations`: 9 SQL migrations defining 18 tables, RLS policies (`00008_rls_policies.sql`), and seed functions.

## Privacy & Security Principles
1. **BFF Pattern:** Browser never queries Supabase tables directly using public keys. All requests route through Next.js Route Handlers.
2. **PII Isolation:** `recipient_profiles` PII is isolated from `recipient_cases`. Staff list endpoints never expose PII.
3. **No-OTP Member Session:** Passwordless member login uses Application Reference + Mobile Number, setting a 30-minute HTTP-only signed session cookie.

## Canonical Verification Commands
Execute in project root:
```bash
/bin/zsh -lc "export PATH=$HOME/.local/bin:$PATH && npm run test && npx tsc --noEmit && npm run lint"
```
