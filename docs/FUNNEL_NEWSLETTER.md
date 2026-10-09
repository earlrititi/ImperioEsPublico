# Funnel and newsletter release - 9 October 2026

The owner confirmed that shirt and subscription payments must remain open now; no 12 October activation gate is added.

## Administration

- `/admin/embudo`: 7/30/90-day flow cohorts, stage losses after 30 minutes of inactivity, ongoing sessions and the most-clicked public elements.
- Flow metrics begin with this release and only record browsers with current analytics consent. Random per-flow/tab identifiers contain no account, form values, query string or private management URL. Records expire after 90 days.
- The final browser stage is opening Stripe, not payment. Actual paid/expired/pending Checkout counts are queried separately from Stripe; free registrations and technical readiness sessions are not counted as sales.
- Manifesto requests now record provider acceptance/failure and separate optional newsletter consent. Historical privacy acknowledgements are reported separately; they are not evidence of delivery.
- `/admin/newsletter`: save/reopen versioned drafts, preview the exact content and current audience, then explicitly confirm sending. Preview approval cannot queue a different draft revision.
- Eligible segments require explicit marketing consent and exclude withdrawals, suppressions, duplicate addresses and unverified subscription records. Receiving the manifesto alone does not subscribe anyone to marketing.
- The existing maintenance scheduler now processes mail-only queues and checks recent provider receipts. Accepted mail is not presented as verified delivery. Observed bounces and complaints are suppressed before the next admin send.

## Validation

- Node 24: 93 unit tests; Astro check without errors; admin ESLint and production build.
- Compiled endpoint/transport scenarios for subscriptions, shirt stock/payment/webhooks, auth, premium access, manifesto idempotency/failures, provider receipts and consented newsletter audiences. Simulated transports cannot open real sockets.
- Supabase Test: migrations 028/029, service-only access, stage deduplication, draft revision conflicts, atomic approval/queue checks and default marketing opt-out. Transactional fixtures roll back; no emails.
- Preview authenticated API checks include admin/non-admin separation and newsletter draft save/preview/conflict without queuing messages.

Apply migrations 028/029 before production promotion. Do not enqueue or send launch campaigns merely to verify this release. No test purchase or live charge is required.
