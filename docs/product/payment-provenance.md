# Payment asset and account provenance

Status: controlled-pilot implementation; owner verification still required.

The payment configuration in `src/lib/payment/config.ts` is a single typed server-side adapter for the manual GCash and bank-transfer workflow requested for this release. It is intentionally protected by the launch-gate and payment-handoff switches. Payment verification never changes membership to `active_confirmed`.

## Supplied QR asset

- Source supplied in the task: `/Users/indyp/Downloads/Image 4.webp`
- Local preserved copy: `private-reference-assets/payment/gcash-qr.webp`
- SHA-256: `8849d13e01ac320db9fc6276629da497563eb7b574f17c0ade47967cc776e638`
- The preserved copy is ignored by Git and is not served from `public/`.
- A production upload requires an approved private Supabase Storage bucket and an owner verification that the QR is current and authorized by PRC.

## Account values

The account name, account numbers, SWIFT codes, branches, fee, and route labels are centralized in the server-only payment config module. They are not duplicated in components or client bundles. The supplied values remain a controlled-pilot fixture until the named owner records verification.

## Change history

| Date | Change | Approval state |
| --- | --- | --- |
| 2026-09-08 | Added the supplied QR provenance record and centralized manual payment configuration. | Awaiting PRC/payment-owner verification |
