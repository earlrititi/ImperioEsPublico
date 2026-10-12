# Admin phase 1 checkpoint

## Current release checkpoint: 2026-10-09

Published `0b87da95a63b2885426b3e5f20276ecca9216a69` through isolated Preview -> main. Production deployment `dpl_2WAuFPUX9KempuQUhnWZofajpKeT` is READY on imperioes.com and www.imperioes.com. This checkpoint supersedes the older checkpoints below.

- Unified private dashboard now includes Auth accounts, confirmation status, verified paid subscriptions, reservations, orders and owner notification history. Imported 56 received Gmail notices idempotently: 55 free registrations and one checkout-interest notice explicitly stating payment was unconfirmed. Import created no accounts, paid access or marketing consents. Current Stripe account has no actual subscriptions; a registration notice is not evidence of payment.
- Exactly three historical subscription rows were reconciled to `legacy_unverified`, using current-account Stripe evidence, optimistic checks and an audit record. Records were retained; no Stripe subscriptions were canceled. Administrator article access remains separate.
- Migrations 025-027 applied transactionally to Test and Production. CMS supports legacy import, save, sanitized preview, publish changes, withdrawal and soft deletion. Published snapshots stay isolated from drafts. Public catalogue, article pages and sitemap use published metadata; premium bodies remain server-authorized. Only the original six articles are free. Image upload is not implemented; existing local image paths can be edited.
- Production flags: `RESERVATION_MODE=false`, `SHIRT_SALES_APPROVED=true`, `STRIPE_LIVE_CHECKOUT_ENABLED=true`. Shirt campaign activated immediately at the owner's explicit request, superseding the earlier 12 October plan. New orders hold stock transactionally for the 24-hour payment window. Price is 2699 cents plus 300 cents shipping per unit, inclusive VAT, mainland Spain only.
- Five existing reservation purchase invitations have provider delivery event `delivered`. The maintenance scheduler is active every five minutes. No unrelated admin email was queued or sent during activation.
- Live Stripe account `acct_1UCc4cDRITvLIOKF`: charges/payouts enabled; webhook, all four subscription prices, shirt price and inclusive 21% VAT verified. Five unpaid validation Checkout sessions were created and explicitly expired, without charges or subscriptions. Arcabucero copy and benefit are 15%; Maestre de Campo 20%; shipping excluded from discounts.
- Validation: 89 unit tests, Astro check (zero errors/warnings, six existing hints), production build, compiled integration suites and sanitizer bundling passed. Authenticated Preview verified private APIs, non-admin denial, draft revisions, publish, catalogue/sitemap integration, premium protection, draft isolation, withdrawal and deletion. Temporary Test users and articles were removed. Public production pages and private API rejection verified; no error logs found. Chrome verified live stock, enabled purchase controls, both product images and no horizontal overflow at desktop/mobile widths. Signed-in dashboard visual testing remains separate from the authenticated HTTP tests.

Original workspace preserves unrelated performance/assets/navigation changes. Current production commit contains only the scoped admin/editor/commerce work. Private local environment and Gmail import snapshot were not committed.

## Release checkpoint: 2026-10-08

Published commit `0378cdb13af51d8e08d2f650459524ed3a47e3c6` through Preview -> main. Production deployment `dpl_CCodRSG4GnsG8wskrWVYMsTBMVjn` is READY and assigned to imperioes.com and www.imperioes.com. Both domains return HTTP 200. Four subscription checkout pages have enabled submit buttons, shirts remain prereservations, /admin redirects anonymous visitors to login, and all five private admin APIs return 403 anonymously.

Migrations 020-024 were applied transactionally to production and verified. Preview was isolated onto Test Supabase and Stripe, with outbound mail disabled. Authenticated Preview tests passed for admin pages/APIs, normal-user rejection, draft creation, sanitized preview, revision updates and stale revision rejection; temporary Test fixtures were removed.

Validation: 88 unit tests, Astro check, lint, production build, compiled integration suites and sanitizer bundle checks passed. Dependency updates reduced npm audit to zero vulnerabilities. The sanitizer dependency closure is bundled for the Vercel Node 24 runtime.

No real charges, subscription cancellations or campaign sends were performed. Historical subscription reconciliation, authenticated desktop/mobile visual checks, campaign delivery reconciliation and full CMS publishing/import/uploads remain pending. This release includes draft-only CMS, not completion of the full master request.

Release worktree: `C:\Users\lorit\Imperio E Release`, branch `release/admin-commerce-20261008`. The original worktree retains unrelated local performance/asset edits. The following earlier checkpoint is historical; production and audit statements below are superseded by this release checkpoint.

## Implemented locally

- UUID-based confirmed-user authorization for Pablo and Adri; admin pages check access before rendering.
- Private `/admin`, `/admin/interacciones`, `/admin/suscripciones` and analytics/subscription APIs.
- Consent-gated anonymous interaction aggregates; cookie rejections separated from subsequent withdrawals.
- Canonical Stripe subscription/customer checks and persistent per-email checkout guard (migration 022).
- Checkout creation no longer sends an owner subscription-interest notification. Paid-invoice notifications remain in the webhook.
- Active Arcabucero 15% and Maestre de Campo 20% promotion eligibility and accurate discount email copy.
- Shirt Checkout separates the 2699-cent product from 300-cent delivery per unit. Product-scoped coupons exclude delivery; coupon retrieval explicitly expands `applies_to`, including validation when reusing a saved promotion.
- Mail worker rechecks explicit suppressions, reservation withdrawals and marketing-email consent withdrawals immediately before sending. Lookup failures prevent sending; cookie rejections are not email withdrawals.
- Newsletter audience deduplication, explicit suppression handling, and canonical Stripe verification that excludes unresolved records.
- Safe plain-text-to-HTML admin email renderer and validation; confirmed-send APIs, individual/campaign composers, unsubscribe page and durable worker with immutable provider payloads and idempotent retries. No campaign has been sent.
- `/admin/articles`: private Tiptap draft editor, formatting toolbar, metadata fields, paginated draft list, unsaved-change warning and sandboxed server-sanitized preview. API validates slugs, dates, HTML and local images. Existing file-backed articles cannot be shadowed by new drafts.
- Migration 024 adds transactional draft saves, optimistic revision checks, retry-safe creation and audit. Published snapshots and canonical URLs remain untouched by draft edits. Only applied to Test.

## Validation / blocker

- Local suite: 88 tests passed. Astro check, scoped `lint:admin` and production build passed after adding article drafts.
- `verify-shirt-discounts-test.mjs`: six real Stripe Test sessions passed (0/15/20 percent, quantities 1 and 3). Shipping remained 300 cents per unit. All sessions expired without payments.
- `verify-reservation-checkout.mjs`: 19 compiled Checkout/webhook scenarios passed with simulated transports, no outbound requests or charges.
- Anonymous HTTP checks: all three new admin pages redirect to login; analytics API returns 403 without private data.
- ImperioE Test (`joicpkgvggfxzrdazisx`) was restored through the authenticated Supabase dashboard and is ACTIVE_HEALTHY.
- Test migrations through 023 applied. Production remains unchanged. Isolated temporary CLI workdir leaves the production project link untouched.
- Test migration 024 applied and SQL assertions passed for CMS permissions, idempotency, duplicate slugs, stale revisions, audit and published snapshot isolation. Fixtures rolled back.
- `verify-admin-database-test.mjs` passed RLS/grants, checkout retry/expiry, cookie transitions, aggregation, email idempotency, leases and provider receipt assertions; all SQL fixtures rolled back.
- `verify-subscription-checkout-test.mjs` passed against real Stripe Test: four simultaneous attempts produced one checkout; retry reused it, a different plan was rejected, confirmed expiry allowed a replacement. No charges. Sessions expired and database fixture removed.
- Isolated local development server: http://127.0.0.1:4337, started with `--mode reservation-test`. No admin-auth bypass added. Anonymous checks: `/admin/correos` redirects and `/api/admin/newsletter` returns 403.

## Work remaining before release

1. Validate signed-in admin UI on desktop/mobile and the complete mail-worker flow with mocked provider failures before an approved test send.
2. Add approved campaign drafts and provider delivery reconciliation. Current logs distinguish provider acceptance from actual inbox delivery. Review campaign retry exhaustion before release; late suppression checks now have unit coverage.
3. Complete CMS image upload/captions, legacy import, publication/unpublication/delete workflow and public article integration preserving premium protection and existing URLs. Current editor saves new drafts only; public catalog remains unchanged.
4. Reconcile the three historical Stripe subscription records with an audited operation; current read-only verification excludes them from newsletter recipients but has not altered production entitlements.
5. Shirt price mismatch resolved locally and verified in Stripe Test (2699 product + 300 shipping). Verify the production configuration during release; do not activate shirt purchases early.
6. Verify discount redemption end-to-end, user identity/duplicate protection and admin UI with authenticated desktop/mobile browser tests.
7. Publish through preview, inspect, then promote to main. Preserve unrelated concurrent performance/asset edits; do not stage the entire worktree indiscriminately.
8. Dependency audit reports 7 findings (6 high, 1 moderate), including transitive runtime packages. Review and update before release. The local Node runtime is 22.13.0, below the repository requirement >=22.19.0; verify on a supported runtime before release.

Browser verification attempt: CUA returned no browsers/apps in this session. Anonymous HTTP verified `/admin/articles` -> 302 login and `/api/admin/articles` -> 403 no-store. Signed-in visual/editor checks remain pending; no auth bypass was added.

Master request: local attachment b48d64d6-5e4e-47cf-965c-d46b77b7e717. Later user instruction overrides subscription-reservation wording: subscriptions are purchases, shirts remain prereservations until 12 October 2026.
