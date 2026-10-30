# SafeCard Handover Pack

**Who this is for:** Indy, and anyone else who takes over looking after SafeCard.
**Who it is written for:** someone smart who has never built a website. If you can use Facebook and a phone camera, you can follow every page. Every technical word is explained the first time it appears, and there is a [glossary](05-glossary-and-faq.md) for the rest.

> **The one-minute version.** SafeCard is a website where people learn about the Philippine Red Cross *Safe Card* (₱1,200 a year, accident protection), apply for it, and pay. A human administrator checks each application and the proof of payment, then approves or rejects it. Approved members get a digital card. That's the whole product.

![The big picture: applicants, members and administrators use the SafeCard website, which stores data in Supabase](images/diagram-big-picture.png)

## What is in the pack

| # | Document | Read it if you… |
|---|---|---|
| 1 | [User manual: applicants and members](01-user-manual-applicants-and-members.md) | want to understand what the public sees, or need to help someone apply |
| 2 | [User manual: administrators](02-user-manual-administrators.md) | will review applications and approve or reject them |
| 3 | [Technical handover](03-technical-handover.md) | will look after the code, the database or the website hosting |
| 4 | [Hypercare plan and runbooks](04-hypercare-and-runbooks.md) | are on watch after launch, or something just went wrong |
| 5 | [Glossary and FAQ](05-glossary-and-faq.md) | meet a word you do not know |
| + | [Christmas mode guide](../christmas-mode.md) | need to preview, stop or remove the Christmas campaign |

## Where to start

```
 Never seen the app?  ──►  Read 1, then look at the live site
 Reviewing people?    ──►  Read 2, then practise with the sample data
 Looking after it?    ──►  Read 3, then 4
 Something is on fire ──►  Jump straight to the Stop button in 4
```

## Three promises the app makes (never break these)

1. **Practice mode is the default.** Unless every safety switch is deliberately set to “live”, the site accepts no real personal data.
2. **Only the right person sees private things.** Applicant details and payment receipts are visible only to signed-in reviewers, and every look is recorded.
3. **Nothing is deleted to fix a problem.** Evidence and history are kept. Stopping the site is safe and reversible; deleting is not.

## Who owns what

| Thing | Owner | Notes |
|---|---|---|
| The code | GitHub repository `1ndyg0/safecard-access-platform` | Changes go through a *pull request*. Never push straight to `main`. |
| The live website | The owner’s own Vercel account | Only the owner deploys, and only after a clear “yes, deploy”. |
| The database and receipt vault | Supabase | Details and cautions in the [technical handover](03-technical-handover.md#6-the-database-supabase). |
| The Safe Card program rules | Philippine Red Cross | SafeCard explains the program; it is not the insurer. The insurance is underwritten by Prudential Guarantee and Assurance Inc. (PGAI). |

## About the pictures

- **Screenshots** were taken from the real app running in practice mode. Every name, number and receipt in them is fake sample data.
- **Diagrams** are drawn for this pack. Their source files (`.svg`) sit next to the pictures in [`images/`](images/).
- To retake every screenshot after the app changes, see [Retaking the pictures](03-technical-handover.md#13-retaking-the-pictures).

## Things worth knowing before you rely on this pack

1. **There are two SafeCard deployments, each with its own database.** Ours (the owner’s own Vercel account, `safecard-access-platform-phi.vercel.app`) uses Supabase project `ubkbrgxgpxycoqsqiwga`. The repository owner’s separate deployment (`safecard-access-platform.vercel.app`) uses `ajyhlkzbocjeepglkhrl`. The repository’s older docs (`release-gates.md`, `controlled-production-pilot.md`) describe that second one. See [the technical handover](03-technical-handover.md#6-the-database-supabase).
2. **The old shared-password guide has been retired.** The files `docs/indy-migration-guide.md` and `docs/indy-pilot-accounts-setup.sql` were removed from the repository. The accounts they created must still have their passwords changed in Supabase. See [Security housekeeping](03-technical-handover.md#11-security-housekeeping).
3. **Some documents describe a controlled-pilot branch** that adds a first-administrator setup page (`/admin/setup`) and a bootstrap script. Check whether that branch has been merged before following those steps.

*If you change the app, update the matching page here in the same pull request.*
