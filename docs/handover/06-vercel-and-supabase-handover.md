# Vercel and Supabase handover

*How Ian's live SafeCard hosting (Vercel) and database (Supabase) are transferred to Indy, and everything Indy needs to know to run them afterwards.*

**Who this is for:** Indy. It is written in the same plain style as the rest of the [handover pack](README.md). Words in *italics* are in the [glossary](05-glossary-and-faq.md). Boxes of code are things you type into the **Terminal**; a line starting with `#` is a note to you, not a command.

**Nothing in this document is a secret.** It names settings but never their values. Do not add keys, passwords or personal data to it.

**If you were sent an earlier "Supabase → Vercel handoff" note** (it said the Vercel site had no settings and every submission was a demo), it predates the live setup. This document replaces it.

### How it was checked

Checked on 4 November 2026 against `main` at commit `e1b4c4c` (everything through pull request #29), against the public pages of both live sites, and against read-only Vercel command-line listings of Ian's project (setting **names** only; values are never shown). Nobody opened the Supabase dashboard while this was prepared.

| Mark | Meaning |
|---|---|
| ✅ | Confirmed from the code or from a read-only check |
| 🔎 | Only visible inside a dashboard. **Look at it yourself** before relying on it |
| ⚠️ | A trap that has already caught people, or would |

**In this document:**
[1. This handover](#1-this-handover) · [2. What exists today](#2-what-exists-today) · [3. Vercel](#3-vercel) · [4. Supabase](#4-supabase) · [5. After the transfer](#5-after-the-transfer-clean-up) · [6. Accounts and access](#6-accounts-and-access) · [7. Check it works](#7-check-it-works-without-touching-real-data) · [8. Gaps found](#8-gaps-and-out-of-date-documents-found-while-preparing-this) · [9. Sign-off list](#9-sign-off-list) · [Appendix: rebuilding from scratch](#appendix-rebuilding-from-scratch)

---

## 1. This handover

**What happens.** Ian's live Vercel project and Ian's Supabase project are *transferred* into accounts Indy controls. Nothing is copied or rebuilt: the same site, the same database, the same stored receipts and the same staff sign-ins carry on. Only the owner changes.

**What is not part of it.** Indy's own separate deployment (`safecard-access-platform.vercel.app` and its database) is untouched. The code repository already belongs to Indy.

### What moves and what does not

| Moves | Does not move |
|---|---|
| The Vercel project `safecard-access-platform`: its deployments, its **14 settings (copied)**, addresses, configuration, region | Vercel integrations (add them again), usage numbers, runtime and build logs, log drains |
| The Supabase project (database, sign-in accounts, stored files) | Billing history, which stays with the organization it left |
| | Everything else in Ian's Vercel account. Only this one project moves. |
| | Ian's own folders and command-line logins ([section 5](#5-after-the-transfer-clean-up)) |

Supabase's documentation does not spell out that the database, accounts and files come across intact, or that the project address stays the same. A transfer moves a project rather than rebuilding it, so they are expected to; [4.6](#46-transferring-the-supabase-project) says how to confirm.

### Who needs what before starting

| | Vercel | Supabase |
|---|---|---|
| **Ian** | Owner of the account the project is in ✅ (a personal account) | Owner of the organization the project is in 🔎 |
| **Indy** | An account or team to receive it. **A team** needs a valid payment method, and Ian must be a **member** of it. **A personal account** also works; Vercel supports moving a project to one. | An **organization** to receive it, where **Indy is an Owner** and Ian is at least a **member** |

⚠️ Make Indy an **Owner** of the receiving Supabase organization *before* the transfer. Supabase says a person's permissions on the project afterwards depend on their role in the new organization, and that a former Owner may end up with read-only access.

### The order

1. **Record** the current state ([3.2](#32-environment-variables-the-settings-) and [4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-)).
2. **Transfer Supabase first** ([4.6](#46-transferring-the-supabase-project)) and confirm the project address and keys. If the address changed, the Vercel settings must change too, so it is better to learn that before Vercel moves.
3. **Transfer Vercel** ([3.6](#36-transferring-the-vercel-project)).
4. **Run the checks** in [section 7](#7-check-it-works-without-touching-real-data).
5. **Clean up** ([section 5](#5-after-the-transfer-clean-up)). Delete nothing on the old side until step 4 passes.

### Decisions to make before starting

These are for Ian, Indy and (where it concerns the program) the Philippine Red Cross. They are not answered here.

| Decision | Facts that bear on it |
|---|---|
| **Keep taking applications during the transfer?** | While Vercel's transfer runs, Vercel does **not** allow new deployments or setting changes ([3.6](#36-transferring-the-vercel-project)). The [Stop button](04-hypercare-and-runbooks.md#2-the-stop-button) needs both (steps 2 and 3), so it **cannot be completed mid-transfer.** Its first step, making the campaign inactive with one line of SQL in Supabase, does not depend on Vercel. |
| **Which Vercel plan?** | See the plan note in [3.6](#36-transferring-the-vercel-project). |
| **Which Supabase plan, and the project limit** | Supabase counts projects against the Free plan's limit of two. If Indy's receiving organization is on Free and already holds his own project, this one makes two ([4.6](#46-transferring-the-supabase-project)). |
| **What happens to Indy's existing deployment** | After the transfer Indy holds two deployments, each with its own database. Keep both, or retire one. |
| **Who deploys afterwards, and how** | [3.5](#35-how-deploys-happen-and-what-changes-after-handover) |
| **Who is accountable for the data** | [Section 6](#responsibilities-for-the-data) |

---

## 2. What exists today

SafeCard has **two live deployments, each with its own database.** Each was confirmed from the security headers the live site sends.

| | **Ian's (the one being transferred)** | **Indy's (not part of the transfer)** |
|---|---|---|
| Website | `safecard-access-platform-phi.vercel.app` | `safecard-access-platform.vercel.app` |
| Supabase project | `ubkbrgxgpxycoqsqiwga` | `ajyhlkzbocjeepglkhrl` |
| What it reports (4 Nov 2026) | ✅ `/api/pilot/config` answers **live**: launch gates complete, one active campaign, approved content present | ✅ `/api/pilot/config` answers **503 "unavailable"**: production is missing the live switches, so it is not taking applications |
| Hosted from | Ian's personal Vercel account | 🔎 Indy's Vercel account |
| How it is deployed | By Ian, from his Mac, with the Vercel command-line tool | 🔎 |

> **Never run a database command against, or deploy to, a project that is not the one you mean.** The older repository documents (`release-gates.md`, `controlled-production-pilot.md`) describe **Indy's** deployment and are dated 12 September. They are out of date in places; see [section 8](#8-gaps-and-out-of-date-documents-found-while-preparing-this).

**Everything below is about Ian's deployment.**

---

## 3. Vercel

Vercel runs the website. It builds the code into a site, serves it, and keeps the secret settings.

### 3.1 The project today ✅

| Item | Value |
|---|---|
| Project name | `safecard-access-platform` |
| Owner | Ian's personal Vercel account (not a team) |
| Framework | Next.js (automatic) |
| Build command | The default: `npm run build` |
| Node.js version | 24.x |
| Region | `sin1` (Singapore), set in `vercel.json` |
| Addresses | `safecard-access-platform-phi.vercel.app`, plus two automatic `*.vercel.app` addresses that include the account name. **No custom domain.** |
| Scheduled jobs (cron) | **None.** See [3.3](#33-the-scheduled-jobs-are-not-scheduled-) |
| Settings with values | **14, all in the Production scope.** Nothing in Preview or Development |
| Git connection | 🔎 Open **Settings → Git** and confirm. The rule is that none is connected, on purpose ([3.5](#35-how-deploys-happen-and-what-changes-after-handover)) |
| Billing plan | 🔎 Open **Settings → Billing**. See the plan note in [3.6](#36-transferring-the-vercel-project) |

### 3.2 Environment variables (the settings) ✅

An *environment variable* is a named setting the site reads when it starts. In Vercel they live under **Project → Settings → Environment Variables**. **Vercel applies a changed setting only to a new deployment**, so every change needs a redeploy.

"Live needs it" means: with `NEXT_PUBLIC_DATA_MODE=live`, the site refuses to run without it. This list is enforced in `src/lib/safety/data-mode.ts`.

| Name | Secret? | Live needs it? | Set on Ian's production? | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | **yes** | ✅ | Must look like `https://<project>.supabase.co`. It also tells the browser's security policy which database it may talk to. ⚠️ Pointing at another project means changing this **and** redeploying. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (public) | **yes** | ✅ | Can only do what the database's row rules allow. |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | **yes** | ✅ | Bypasses all row rules. Server only. Never in chat, email, code, or any name starting `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_APP_URL` | no | **yes** (must be `https://…`) | ✅ | Must equal the address people really use. It is the one extra website address allowed to make changes through the API (besides the site's own address), it is sent as the cross-origin header, it sets the page-preview base address, and it decides whether the member cookie is marked secure. Staff invitations sent from the bootstrap script take their link from the same name typed in the **Terminal**, not from Vercel. |
| `NEXT_PUBLIC_DATA_MODE` | no | `live` | ✅ | Safety switch 1 |
| `LAUNCH_GATES_COMPLETE` | no | `true` | ✅ | Safety switch 2 |
| `ENABLE_OFFICIAL_PAYMENT_HANDOFF` | no | `true` | ✅ | Safety switch 3 |
| `PAYMENT_PROOFS_BUCKET` | no | **yes** | ✅ | `payment-proofs` |
| `APPROVED_CAMPAIGN_ID` | no | **yes** (a UUID) | ✅ | The one campaign allowed to take applications. Also visible in `/api/pilot/config`. |
| `APPROVED_CONTENT_VERSION` | no | **yes** (whole number ≥ 1) | ✅ | The reviewed wording version. |
| `AUDIT_HASH_SALT` | **YES** | **yes** (≥ 32 characters) | ✅ | See [rotation effects](#rotating-a-secret-what-each-one-affects) |
| `RATE_LIMIT_HASH_SALT` | **YES** | **yes** (≥ 32) | ✅ | |
| `MEMBER_SESSION_SECRET` | **YES** | **yes** (≥ 32) | ✅ | |
| `CRON_SECRET` | **YES** | **yes** (≥ 32) | ✅ | Required by the live check even though nothing calls the cron route today |
| `APP_ENVIRONMENT` | no | optional | not set | When absent, Vercel's own production/preview label decides. Both work. |
| `STORYBOARD_TIMEOUT_MS` | no | optional | not set | A timeout, with a default in code |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `WEBHOOK_SIGNING_SECRET` | yes | **no** | not set | In `.env.example`, but **nothing in `src/` reads them.** Leave them unset. |
| `BOOTSTRAP_*`, `CONFIRM_CONTROLLED_PILOT_BOOTSTRAP`, `CONTROLLED_PILOT_CONFIG_PATH` | partly | no | not set | For the one-time script. Typed into a Terminal, **never** into Vercel. |

To list the names Vercel holds (values are shown as "Encrypted"). Run this before the transfer to keep a record, and after it to compare:

```bash
vercel env ls
```

> ⚠️ **Do not run `vercel env pull` on a shared or backed-up machine.** It writes every secret into a file on disk.

To add or change one without leaving the value in your shell history, let Vercel ask for it:

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production   # it prompts for the value
```

A new secret must be different from every other, at least 32 random characters, and never reused from a Supabase key:

```bash
openssl rand -base64 48
```

#### Rotating a secret: what each one affects

Rotating means replacing a value. Whether and when to do it is a decision for the owners; these are the effects.

| Secret | What changes when it is replaced |
|---|---|
| `MEMBER_SESSION_SECRET` | Signs the 30-minute member sessions. Every current member session stops working; members sign in again. |
| `AUDIT_HASH_SALT` | Mixed into the stored fingerprint of each visitor's IP address in the audit log. After a change, the same IP produces a **different** fingerprint, so new entries cannot be matched with old ones. |
| `RATE_LIMIT_HASH_SALT` | Used for the counters that slow repeated requests. Counters start fresh. |
| `CRON_SECRET` | Matters only to whatever calls the cron route. Today nothing does. |
| `SUPABASE_SERVICE_ROLE_KEY` / anon key | Reset in the Supabase dashboard, then update Vercel and redeploy straight away; until you do, the site cannot reach its database. |

### 3.3 The scheduled jobs are not scheduled ⚠️

The route `src/app/api/jobs/cron/route.ts` says it is "configured in `vercel.json`". **It is not:** `vercel.json` contains only the framework and region, with no `crons` block, and the Vercel project has none. So nothing calls that route.

The route would, when called with the `CRON_SECRET`, queue and run three jobs:

| Job | What it does | While unscheduled |
|---|---|---|
| `aggregate_metrics` | Recalculates the daily summary numbers for active campaigns | The daily summary numbers are never refreshed |
| `release_stale_locks` | Frees records left locked by an interrupted action | Stale locks are never released |
| `check_content_expiry` | Marks published wording past its `expiry_date` as expired | Never runs. The wording created by the bootstrap script has a review date but no expiry date, so it would not expire either way. |

(A fourth type, `send_notification`, deliberately fails: notifications are parked.)

Whether to schedule it, and how often, is **open**. Vercel's plan decides what is possible: see [Vercel's cron documentation](https://vercel.com/docs/cron-jobs). The transfer carries cron settings across, but there are none to carry.

### 3.4 Preview deployments

Preview deployments (built from branches) get **none** of the 14 settings, so they run in **practice mode** with no live database. That is the safe default. If previews should ever talk to a database, give them their **own** Supabase project and their **own** secrets: production data and secrets must never be reused there ([technical handover §5](03-technical-handover.md#5-settings-and-the-safety-switches), rule 4).

### 3.5 How deploys happen, and what changes after handover

**Today:** Ian deploys from his Mac with the Vercel command-line tool, only after saying "yes, deploy", and no automation deploys from the GitHub repository. Vercel's GitHub app is not installed on `1ndyg0/safecard-access-platform`, because Ian is a collaborator on that repository, not its owner.

```bash
vercel --prod     # from the project folder, logged in to the account that owns the project
```

**After the transfer those reasons change.** Indy owns the repository *and* the Vercel project, so connecting them (deploying automatically when `main` changes) becomes possible. That is a **decision for Indy.** Several pages of the pack still say "only the owner's own Vercel account"; [section 5](#5-after-the-transfer-clean-up) lists them. Make sure only **one** place can deploy: not the old account and the new one at once.

**Runtime logs:** Vercel's documentation says the Hobby plan keeps about one hour of runtime logs and Pro about one day. Anything you need for an investigation has to be read before it ages out. Logs from before the transfer do not move.

### 3.6 Transferring the Vercel project

Per Vercel's documentation (checked 4 November 2026):

- **Who:** the person doing it must be an **owner** of the account it leaves, and a **member** of the team it goes to. A project can also move from a team to a personal account.
- **No downtime.** While the transfer runs you cannot deploy, edit settings or delete the project. The original is hidden, and Vercel creates the project in the destination.
- **What moves with it:** deployments, configuration, **environment variables (copied)**, domains and aliases, the Git link, security settings, function region and cron settings.
- **What does not:** integrations (re-add them), usage numbers, runtime and build logs, log drains, and any setting defined inside `vercel.json`'s `env` / `build.env` (this project has none).
- **Secrets are copied for you.** Because the settings travel with the project, Indy does not have to be sent the service-role key or the salts. Do not send them anyway.

Steps (after the Supabase transfer in [4.6](#46-transferring-the-supabase-project) has been checked):

1. Indy has the receiving Vercel account or team ready. If it is a team, Ian is added as a **member** for the length of the transfer.
2. **Record the state.** Write down the current addresses, and run `vercel env ls` so there is a list of the 14 names.
3. Ian: **Project → Settings → General → Transfer Project**. Pick the destination, read the list of what moves, and confirm. The project keeps its name unless the destination already has one with that name.
4. Indy: open the project in his account. **Settings → Environment Variables** should show all 14 names. Compare with the list from step 2.
5. ⚠️ **Check the addresses.** The automatic addresses contain the account name and will change. Whether the `-phi` address survives is not stated in Vercel's documentation: **look.** If the address people use changes, update `NEXT_PUBLIC_APP_URL`, redeploy, and update Supabase's site URL and allowed redirects ([4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-)). Also tell anyone who holds the old address (links, printed material, partners).
6. Look at **Settings → Git**, and at **Settings → Billing**, in the new place.
7. Redeploy once from the new owner, then run [section 7](#7-check-it-works-without-touching-real-data).

> **Plan fit 🔎.** Vercel's Hobby plan is, in Vercel's words, restricted to non-commercial personal use ([fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)), and Hobby has no team collaboration. Ian's project sits in a personal account. SafeCard supports a program that charges a ₱1,200 annual fee (the site itself never handles the money). Which plan fits is for the new owner to read and decide.

---

## 4. Supabase

Supabase is the database, the sign-in system and the private file vault, all in one project.

### 4.1 What is in the project ✅

| Part | What it holds | Defined by |
|---|---|---|
| Tables | Cases, profiles, consent records, submissions, payment declarations and receipt versions, review decisions, audit events, staff role assignments, versioned bilingual wording, campaigns, rate-limit counters, job queue | `supabase/migrations/00001` to `00023` |
| Extensions | `uuid-ossp`, `pgcrypto`, `citext`, installed in the `extensions` schema | `00001` |
| Private bucket | `payment-proofs`: **not public**, 10 MiB limit, JPEG / PNG / WebP / PDF only | `00010`, re-asserted by `00020` and `00021` |
| Row rules (RLS) | Browsers cannot read tables directly; the site's server uses the service-role key | `00008`, hardened in `00018` |
| Append-only records | Audit events, submissions, receipt versions, status events and review decisions refuse edits and deletes | triggers in the migrations |
| Two `2026…` files | `202609050001_…` and `202609050002_…` are **no-ops**. They exist so a project whose history already contains them is not "repaired". | |

⚠️ **`supabase/seed.sql` is fake sample data with a known test password. Never run it against a real project.**

### 4.2 Settings that exist only in the Supabase dashboard 🔎

`supabase/config.toml` says: "Disposable local/CI stack only. Hosted configuration is managed separately." So **none of the following is in the code,** and a transferred project may not carry all of it. Open the dashboard and **write down each value before the transfer, then compare after.**

| Setting | Where (dashboard) | Must be | What breaks if it is not |
|---|---|---|---|
| **Anonymous sign-ins** | Authentication → Sign In / Providers | **On** | Every applicant starts with an anonymous session (`src/app/api/intake/case/route.ts`). If off, applying fails with "Failed to create session". The local test stack turns this on in `config.toml`; a hosted project does not inherit that. |
| **Email sign-in** | Authentication → Sign In / Providers | **On** | Staff sign in with email and password. |
| **Custom email sending (SMTP)** | Authentication → Emails / SMTP | **Configured** | Supabase's built-in email sends only to addresses on your Supabase organization's own team, at a very low hourly limit (per Supabase's documentation). Staff invitations go to outside addresses, so they fail until your own mail provider is set. **After a transfer, the "own team" is Indy's organization, not Ian's.** |
| **Site URL** | Authentication → URL Configuration | The site's real address | Invitation links point at the wrong place. |
| **Redirect URLs** | Authentication → URL Configuration | Includes `<site address>/auth/callback` | The invitation link is refused. The callback honours one destination only: `/admin/setup`. |
| **Anonymous sign-in limits** | Authentication → Rate Limits | Looked at | Supabase's documented default limits anonymous sign-ins per IP address (30 an hour at the time of writing). People applying from one shared network (a school or an office) share that limit. Supabase also recommends a CAPTCHA for anonymous sign-ins. |
| **Billing plan, backups, pausing** | Organization → Billing; Project → Database → Backups | Known | The owner waived backups for the MVP (GitHub issue #7); a backup plan is required before "R2" and before any destructive migration. The plan can change with the transfer, so read what the receiving plan includes and what it does when a project is idle. |
| **Region** | Project → Settings → General | Known | It decides where the personal data physically sits (see [6](#responsibilities-for-the-data)). A transfer cannot change it. |
| **Exposed API schemas** | Project → Settings → API | `public` | Matches the local setup. |
| **GitHub integration, log drains, project-scoped roles** | Project → Settings → Integrations; Organization → Team | **None connected** | Supabase **refuses the transfer** while any of them exists ([4.6](#46-transferring-the-supabase-project)). |

### 4.3 The receipt vault and the payment QR ✅

- The bucket `payment-proofs` is created and locked by the migrations. Nobody can open a file by guessing its address; reviewers get a **short-lived signed link**, and each one is logged.
- ⚠️ **The official GCash QR is not created by any migration.** It is an object someone uploaded by hand to `payment-proofs` at `official/gcash-qr.webp`. After the transfer, check it is still there ([section 7](#7-check-it-works-without-touching-real-data)).
- If the object is missing or cannot be signed, `/api/payment-config` **falls back to the QR image bundled in the code** (`public/payment/prc-gcash-qr.png`), so a QR still shows. The written runbook says live mode "fails closed" in that case; **the code does not** ([section 8](#8-gaps-and-out-of-date-documents-found-while-preparing-this)).
- The payee details the bootstrap script requires are checked **in the script itself**. A different payee means editing the script and the configuration together.

### 4.4 Migrations: the recipe

`supabase/migrations/` holds the numbered steps that build the database. The rules in [technical handover §6](03-technical-handover.md#6-the-database-supabase) apply: forward only, never edit an applied file, try on a copy first, release code and migration together, no reset and no seed in production. A transfer does not change any of this, and it is not a moment to apply migrations.

Two migrations are especially coupled to code: **`00022`** removes the ambassador, Red Cross export, finance role and sponsor paths, and **`00023`** replaces the administrator view. The previous code release still reads what they drop.

Check which migrations a project already has. Open **SQL Editor** and run (read-only):

```sql
select version from supabase_migrations.schema_migrations order by version;
```

(That table exists when migrations were applied with the Supabase command-line tool. If some were pasted into the SQL Editor, they will not be listed there; check for their effects instead.)

Apply pending ones from the code folder. The tool is part of the project, so no separate install is needed:

```bash
npx supabase link --project-ref <project reference>   # asks for the database password
cat supabase/.temp/project-ref                         # confirm it printed YOUR project
npx supabase migration list                            # local vs. remote, side by side
npx supabase db push                                   # applies what is missing
```

⚠️ If `migration list` shows the remote has versions your folder lacks (or the reverse), **stop.** Do not run `migration repair`, which rewrites history. Ask first.

### 4.5 Keys

The app needs exactly two keys from **Project Settings → API**:

| Key | Goes in | Treat as |
|---|---|---|
| Public key (`anon` / "publishable") | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Not secret |
| Server key (`service_role` / "secret") | `SUPABASE_SERVICE_ROLE_KEY` | A master password |

Supabase now has two key formats. Which pair is in Ian's Vercel settings is not visible from outside (values show as "Encrypted"). Do not switch formats during a transfer; whatever is in Vercel works today.

### 4.6 Transferring the Supabase project

Per Supabase's documentation (checked 4 November 2026), a project can be *transferred* to another organization if:

- you **own** the organization it leaves and are at least a **member** of the one it goes to;
- the project has **no active GitHub integration**, **no log drains**, and no project-scoped roles pointing at it.

Also from that page:

- Moving to a lower plan can cause a short downtime and loss of paid features. Moving to the Free plan counts against its limit of two free projects.
- The organization it leaves is billed for usage up to the transfer; the new one afterwards.
- Your own permissions afterwards depend on your role in the new organization.
- A transfer moves a project between organizations only. It cannot change the region.

Steps:

1. **Before starting,** Indy creates the receiving organization (he is its Owner), adds Ian as a member, and decides its plan. Ian records every value in [4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-), the project URL, and the plan.
2. **Remove blockers:** in Ian's project, disconnect any GitHub integration and any log drain.
3. Ian: **Project → Settings → General → Transfer project**, choose Indy's organization, and confirm in the dialog.
4. Indy: open the project in his organization. **Project Settings → API** should show the same project URL as `NEXT_PUBLIC_SUPABASE_URL` in Vercel. Expected, but not promised by the documentation: confirm.
5. Go through every row of [4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-) against the record from step 1. **Do not assume any of it came across.**
6. Run the read-only SQL checks in [section 7](#7-check-it-works-without-touching-real-data), step 4.
7. **If the project address *did* change,** update `NEXT_PUBLIC_SUPABASE_URL`, the anon key and `SUPABASE_SERVICE_ROLE_KEY` in Vercel and redeploy before anything else. Until then the site cannot reach its database.

---

## 5. After the transfer: clean-up

### On Ian's side

- **Remove the old Vercel link from every folder where Ian ran the Vercel tool.** Those folders hold a hidden `.vercel` folder naming the *old* project. Delete it (`rm -r .vercel`) or re-link to the new project, so nobody deploys to a project that no longer holds the live site.
- **Decide which access Ian keeps:** membership of Indy's Vercel team, membership of Indy's Supabase organization, and collaborator access on the GitHub repository. Remove what is not needed.
- **Do not deploy** to the live site from Ian's account again.

### Pages of the pack that become wrong

These say the live website belongs to "the owner's own Vercel account" or that only the owner deploys. Rewrite them to match what is decided in [3.5](#35-how-deploys-happen-and-what-changes-after-handover), in the same pull request:

| Page | Where |
|---|---|
| [README](README.md) | "Who owns what" (the live-website row), and "Things worth knowing" item 1 (which deployment is "ours") |
| [Technical handover](03-technical-handover.md) | §1 ingredients table (Vercel row), §6 callout ("Ours"), §10 step 9 and "Two rules that never bend" rule 2 |
| [Hypercare and runbooks](04-hypercare-and-runbooks.md) | The Stop button, step 3, and runbook R7 (both say only the owner's own account is used) |
| This page | Sections 2 and 3.5 |

---

## 6. Accounts and access

No secret values belong in this table; it says where each one lives.

| Thing | Before | After the transfer |
|---|---|---|
| Vercel project | Ian's personal Vercel account | Indy's account or team |
| Vercel command-line login | Ian's login, on Ian's Mac | Indy logs in with his own. Nothing to hand over. |
| Supabase organization and project | 🔎 Ian's organization | Indy's organization |
| Supabase database password | 🔎 Set when the project was created; not in the repository | Resettable under **Project Settings → Database** |
| Service-role key and the four secrets | Only inside Vercel's encrypted settings | Copied with the Vercel project. If you must move one by hand: a password manager, never chat, email or a shared document. |
| GitHub repository | Indy owns it; Ian is a collaborator | No change; decide whether Ian keeps access |
| Administrator logins | Named staff accounts | Each person holds their own private password |
| Notes or files where anyone kept an admin password | Outside the repository | Treat as retired. Each administrator should set their own. |

### Carried-over security items

Both come from [technical handover §11](03-technical-handover.md#11-security-housekeeping); they do not stop applying when ownership changes.

1. ⚠️ **The retired setup guide gave accounts for Ian and for Indy a shared temporary password.** The guide was deleted from `main`, but it is in the repository's history, so treat that password as public. In **each** Supabase project that guide could have touched (check both), confirm those two accounts have a private password now. See who exists and when they last signed in:

   ```sql
   select email, last_sign_in_at from auth.users where not is_anonymous order by email;
   ```

   Change any password in **Authentication → Users**.
2. **Keep a written list of who holds which staff role.** There is no screen for it. Read-only:

   ```sql
   select u.email, r.role, r.is_active
   from public.role_assignments r join public.users u on u.id = r.user_id
   order by u.email, r.role;
   ```

### Responsibilities for the data

Ian's site is in **live mode**: it collects real applicants' personal information and payment receipts. Whoever owns the Vercel and Supabase accounts after the transfer holds that data. Questions for the owners and the Philippine Red Cross to settle, not answered here: who is accountable for the data, what the privacy notice should name, and what terms are in place with Vercel and Supabase. The region of each (`sin1` for Vercel's functions; 🔎 Supabase's, from [4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-)) is the factual starting point.

---

## 7. Check it works, without touching real data

⚠️ **Never create fake applicants on a live site.** These checks only read. Run them after the Supabase transfer, after the Vercel transfer, and after any change of address.

**1. The site reports itself ready.** Replace the address with the one you are checking.

```bash
curl -s https://<site address>/api/pilot/config | head -c 300
```

| You see | Meaning |
|---|---|
| `"mode":"live"` with a campaign | Ready and active |
| 503, "No active approved pilot campaign" | Configured, but the campaign is inactive or `APPROVED_CAMPAIGN_ID` does not match a row |
| 503, "Production requires NEXT_PUBLIC_DATA_MODE=live and LAUNCH_GATES_COMPLETE=true" | A safety switch is off (safe, but not taking applications) |
| 503, "Live configuration is incomplete: …" | Names exactly which settings are missing |
| 503, "Required governed benefit and bilingual consent/privacy content is incomplete" | The wording rows are missing or `APPROVED_CONTENT_VERSION` is wrong |

**2. The browser is allowed to talk to the right database.** The security policy names the Supabase project; make sure it is the one you meant.

```bash
curl -sI https://<site address>/ | grep -i content-security-policy | grep -oE 'https://[a-z0-9]+\.supabase\.co'
```

**3. The payment details load.** `curl -s https://<site address>/api/payment-config` should say `"available":true` with the amount and routes.

**4. In the dashboard (read-only SQL):**

```sql
-- the vault is private and accepts the right file types
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'payment-proofs';
-- expect: public = false, 10485760, four types including application/pdf

-- the QR is still in the vault
select name from storage.objects where bucket_id = 'payment-proofs' and name = 'official/gcash-qr.webp';

-- exactly the campaign you pinned is active
select id, name, is_active, start_date, end_date, max_applications from public.pilot_campaigns order by start_date desc;

-- the pinned wording is approved and published
select content_type, locale, version, approval_status, is_published from public.content_versions order by content_type, locale;
```

**5. A staff member signs in** at `/admin/login`, and the sign-in appears in the audit timeline.

---

## 8. Gaps and out-of-date documents found while preparing this

| # | Finding | Status |
|---|---|---|
| 1 | **Cron is not scheduled.** The route says it is configured in `vercel.json`; it is not ([3.3](#33-the-scheduled-jobs-are-not-scheduled-)). | Open: decide whether to schedule |
| 2 | **`controlled-production-pilot.md` says live mode fails closed if the QR cannot be signed.** The code falls back to the bundled QR image. | The code is right about behaviour; the runbook line is out of date |
| 3 | **`controlled-production-pilot.md` and `release-gates.md` describe Indy's deployment** as of 12 September: migrations `00001`–`00020`, and `00021` "not yet applied". `main` now has `00001`–`00023`. | Out of date; not corrected here |
| 4 | **[Technical handover §14](03-technical-handover.md#14-open-decisions-and-known-gaps) item 1 and [README "Things worth knowing" item 3](README.md#things-worth-knowing-before-you-rely-on-this-pack)** asked whether the first-administrator branch was merged. It **is**: `/admin/setup` and `npm run bootstrap:pilot` are on `main`. | Resolved; both pages updated in this change |
| 5 | **No settings in Preview or Development** on Ian's project. | By design ([3.4](#34-preview-deployments)); recorded here so it isn't mistaken for a mistake |
| 6 | **`APP_ENVIRONMENT` is set in the runbook's list but not on Ian's production.** | Works; Vercel's own label is used |
| 7 | **Unused settings in `.env.example`:** `UPSTASH_*` and `WEBHOOK_SIGNING_SECRET`. | Harmless; nothing reads them |
| 8 | **Node versions differ:** Vercel runs 24.x, the README says 24+, the automated checks run 22. | Open ([technical handover §14](03-technical-handover.md#14-open-decisions-and-known-gaps) item 5) |
| 9 | **No backup strategy.** Waived for the MVP (issue #7); required before "R2" and any destructive migration. | Open |
| 10 | **The bootstrap example sets an end date of 31 December 2026 and a cap of 50 applications.** The live campaign's real values were not read. | 🔎 Check the `pilot_campaigns` row ([section 7](#7-check-it-works-without-touching-real-data), step 4) |
| 11 | **Applicants share an anonymous-sign-in limit per IP** ([4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-)). | 🔎 Look at the Rate Limits page |
| 12 | **`src/app/layout.tsx` falls back to Indy's address** (`safecard-access-platform.vercel.app`) for the page-preview base address when `NEXT_PUBLIC_APP_URL` is unset. Live mode requires the setting, so it only shows in previews and local runs. | Harmless today; worth fixing in code so a copy never points at the wrong site |
| 13 | **Several pack pages assume Ian owns the Vercel project** ([section 5](#5-after-the-transfer-clean-up)). | Open until the transfer is decided and done |

---

## 9. Sign-off list

Tick each box as it is *seen*, not assumed. Dates and names are written in by the people who did them.

**Decisions** (see [section 1](#decisions-to-make-before-starting))
- [ ] Whether applications continue during the transfer; if not, the campaign was made inactive first
- [ ] Vercel plan chosen, having read the fair-use guidelines
- [ ] Supabase plan chosen; the receiving organization's project limit checked
- [ ] What happens to Indy's existing deployment
- [ ] Who deploys after the transfer, and how
- [ ] Who is accountable for the data
- [ ] Whether to rotate secrets (effects in [3.2](#rotating-a-secret-what-each-one-affects))

**Before the transfer**
- [ ] Indy is an Owner of the receiving Supabase organization; Ian is a member of it (and of the receiving Vercel team, if it is a team)
- [ ] Every value in [4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-) recorded; the 14 Vercel setting names recorded; current addresses recorded
- [ ] Supabase GitHub integration and log drains disconnected

**Supabase**
- [ ] Project is under Indy's organization; project URL unchanged (or Vercel updated)
- [ ] Anonymous sign-ins on; email sign-in on; custom SMTP set; site URL and redirect URL set
- [ ] `payment-proofs` bucket private; `official/gcash-qr.webp` present
- [ ] Migration list reviewed; nothing pending that the running code needs
- [ ] Billing plan and backup position known

**Vercel**
- [ ] Project is under Indy's account or team; the 14 setting names are present
- [ ] The address people use works; `NEXT_PUBLIC_APP_URL` matches it; people who held the old address have been told
- [ ] Settings → Git and Settings → Billing looked at and match the decisions above
- [ ] One redeploy done by the new owner

**Smoke test**
- [ ] All five checks in [section 7](#7-check-it-works-without-touching-real-data) pass

**Clean-up and security**
- [ ] Ian's old `.vercel` links removed; Ian's retained access decided
- [ ] Shared temporary password retired on every account that had it
- [ ] Written list of staff roles exists
- [ ] The pack pages listed in [section 5](#pages-of-the-pack-that-become-wrong) rewritten

---

## Appendix: rebuilding from scratch

**Not part of this transfer.** This is kept for recovery or for building a separate copy later (no data from Ian's database). The order matters: the bootstrap script runs **before** Vercel gets its live settings, because it prints the campaign ID that `APPROVED_CAMPAIGN_ID` needs.

1. **Create the Supabase project.** Keep the database password in a password manager. Note the region.
2. **Set the dashboard settings** in [4.2](#42-settings-that-exist-only-in-the-supabase-dashboard-): anonymous sign-ins, email sign-in, SMTP, site URL, redirect URLs.
3. **Apply the migrations:** `npx supabase link …`, then `npx supabase db push` ([4.4](#44-migrations-the-recipe)).
4. **Upload the official QR** to the `payment-proofs` bucket as `official/gcash-qr.webp` ([4.3](#43-the-receipt-vault-and-the-payment-qr-)).
5. **Review the configuration.** Copy `config/controlled-pilot.example.json` to a new file and read it. It carries the organization, the campaign, the approved fields and payment routes, the bilingual wording, and, in the example, a **start and end date, a cap on the number of applications, and stop conditions.** Point `CONTROLLED_PILOT_CONFIG_PATH` at your copy.
6. **Run the bootstrap** from a Terminal (never Vercel). It needs Node 24 or newer:

   ```bash
   APP_ENVIRONMENT=production \
   CONFIRM_CONTROLLED_PILOT_BOOTSTRAP=YES \
   NEXT_PUBLIC_SUPABASE_URL='https://<project>.supabase.co' \
   NEXT_PUBLIC_APP_URL='https://<site address>' \
   SUPABASE_SERVICE_ROLE_KEY='<server key>' \
   BOOTSTRAP_ADMIN_EMAIL='<named administrator email>' \
   BOOTSTRAP_ADMIN_NAME='<administrator full name>' \
   CONTROLLED_PILOT_CONFIG_PATH='<path to your copy>' \
   npm run bootstrap:pilot
   ```

   It is repeatable. It creates the organization, an **inactive** campaign, the four bilingual consent and privacy records, the benefit storyboard, the administrator's profile and one `privacy_admin_owner` role, then emails the invitation and **prints the campaign ID.** Copy that ID.
7. **Create the Vercel project** and add the settings from [3.2](#32-environment-variables-the-settings-): `APPROVED_CAMPAIGN_ID` is the printed ID; `APPROVED_CONTENT_VERSION` is `1` for the example configuration; generate four different secrets; set the three switches to live **last**.
8. **Deploy.** Until the campaign is activated, `/api/pilot/config` correctly answers 503 "No active approved pilot campaign".
9. **The administrator** opens the email, lands on `/admin/setup`, and chooses a private password of at least 12 characters. SafeCard never generates or sees it.
10. **Add the other staff** in the console and test each role with its own account. Role names and duties are in [`controlled-production-pilot.md`](../controlled-production-pilot.md).
11. **Run the activation checks** in that same runbook. Then activate the campaign (the same table the [Stop button](04-hypercare-and-runbooks.md#2-the-stop-button) turns off):

    ```sql
    update public.pilot_campaigns set is_active = true where id = '<campaign id>';
    ```
