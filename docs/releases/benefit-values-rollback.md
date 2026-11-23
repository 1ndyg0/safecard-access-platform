# Benefit value section: release and rollback checkpoint

Recorded 23 November 2026, before changing production.

## Current production (verified in Vercel)

- Project: `safecard-access-platform`, team `sc-dc92`.
- Live address: https://safecard-access-platform-phi.vercel.app/
- Current production deployment: `dpl_DkyhRbxgTMb3ACdpdBp6oFedDg8y`.
- Deployment dashboard: https://vercel.com/sc-dc92/safecard-access-platform/DkyhRbxgTMb3ACdpdBp6oFedDg8y
- Immutable deployment URL: https://safecard-access-platform-nqfw53j4u-ivvuriarte-5014s-projects.vercel.app/
- Created: 30 October 2026; dashboard reports Ready, Production, Current.
- Source: Vercel CLI upload (`vercel deploy`), not a verified Git-linked source commit.
- Do not delete this deployment. The checkpoint records the existing deployment; it does not create a second deployment or override retention rules.

## Code checkpoint

- GitHub main at preparation: `e1b4c4c253f29d2b3c22c4206dd84ad65203f6d3`.
- Annotated tag: `safecard-before-benefit-values-2026-11-23`.
- Review branch: `codex/benefit-value-scenarios`.
- This tag preserves GitHub main, not a claim that the CLI-uploaded production source is byte-for-byte identical. Verify deployed source against this baseline before any production promotion.

## Scope and publication gate

One presentation-only component after the existing benefits, a scoped CSS module, its import/render, and this record. English and Filipino copy. No dependencies, database migrations, queries, Supabase settings, environment variables, application handling, or authentication changes.

Keep this work on the review branch. Do not merge or promote until the owner reviews the actual preview and PRC/PGAI confirms combined benefits and annual limits. The arithmetic illustrations are labelled unconfirmed: PHP332,000 survival and PHP337,000 fatal outcome. They are alternatives, not cumulative benefits. Service references are separately labelled: PHP20,000 (upper end of other ambulance providers’ prices cited by PRC, not a SafeCard maximum) and PHP1,800 (PRC Palawan blood processing fee reported by PIA, not a nationwide maximum). Combined illustrative totals are PHP353,800 and PHP358,800, not cash payouts or confirmed maximum benefit values.

## Immediate rollback after a future approved release

1. Open the saved deployment dashboard and use Vercel's rollback/promote action to restore that deployment to the production address. Confirm that Vercel identifies the intended old deployment before executing.
2. Verify the production landing page, navigation and application entry point without submitting personal information or writing data.
3. Revert only the merged benefit-value change through a reviewed GitHub revert commit/PR. Do not reset main, force-push or discard unrelated newer work.
4. Verify production remains on the intended version after the revert deployment. Review any Vercel rollback automation pause before re-enabling normal deployments.

A Vercel rollback restores deployment code/configuration associated with that deployment; it does not restore Supabase data. This change requires no data rollback. Never run database reset, seed, migration repair or production test submissions for this section.

## Preview checks

Use synthetic configuration for local builds and browser checks. Never copy production service keys or submit preview forms to production. Check English/Filipino, light/dark themes, desktop/phone widths, keyboard disclosure, and existing application links. Verify preview environment before interacting with forms.
