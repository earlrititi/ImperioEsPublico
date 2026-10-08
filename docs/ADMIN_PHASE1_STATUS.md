# Admin phase 1 checkpoint

Not published. No production migrations, charges, subscription cancellations, or campaign sends performed in this phase.

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
