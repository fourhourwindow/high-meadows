# Wedding Venue Booking — Scaffold

This is a starting structure for the booking system we designed: multi-unit
property (venue grounds, cottage, main house), tiered packages, seasonal +
day-of-week pricing, atomic booking holds, and upgrade/downgrade requests.

## Layout

```
firestore.rules              Security rules for every collection below
firebase.json                Wires Firestore rules + Functions together

functions/src/
  types.ts                   Shared domain types (also copied to src/types.ts)
  pricing.ts                 getPriceForRange — the ONE place price is computed
  availability.ts            Transaction-safe check/hold/confirm/release helpers
  booking.ts                 createBookingHold + confirmBookingPayment
  upgradeDowngrade.ts        requestPackageChange, approveUpgrade, approveDowngrade
  scheduled.ts               Sweeps expired holds every 5 minutes
  stripeWebhook.ts           Routes Stripe events to the confirm/approve functions
  index.ts                   Exports everything as deployable Cloud Functions

src/
  types.ts                   Same types, for frontend imports
  lib/firebase.ts            Client SDK init + callable function bindings
  components/
    PackageAvailabilityCalendar.tsx   Read-only availability check for the UI
    BookingFlow.tsx                    Guest details form → createBookingHold
```

## What's NOT included (next steps)

- **Stripe Checkout Session creation** — the client-side call that turns a
  `bookingId` + `totalPrice` into a `session.url` to redirect to. This is a
  thin wrapper (`stripe.checkout.sessions.create(...)`) best added as its
  own callable function once you've set up your Stripe account and decided
  on deposit vs. full-payment-at-booking.
- **Admin dashboard** — screens for managing `units`, `packages`,
  `dayOfWeekRates`, and `seasonalAdjustments`, plus a bookings list/calendar
  view. All the Firestore structure is ready for it; it's just CRUD UI
  behind the `isAdmin()` rule.
- **Google Calendar sync** — a Cloud Function triggered on booking
  confirmation (`onDocumentUpdated` on `bookings/{id}`) that pushes to the
  Google Calendar API so you see bookings in your own calendar.
- **Seed data** — you'll want a one-time script to create your actual
  `units` (venue grounds, cottage, main house), `packages`, and initial
  `dayOfWeekRates`/`seasonalAdjustments` documents.
- **Balance payment flow** — the deposit flow is scaffolded; charging the
  remaining balance closer to the event date follows the same pattern
  (Checkout Session with `purpose: "balance"` metadata, handled in
  `stripeWebhook.ts`).

## Setup order

1. `firebase init` in this directory if you haven't already (link your
   Firebase project), keeping the existing `firebase.json`/`firestore.rules`.
2. `cd functions && npm install`
3. Set Stripe secrets: `firebase functions:secrets:set STRIPE_SECRET_KEY`
   and `STRIPE_WEBHOOK_SECRET`
4. Seed `units`, `packages`, `dayOfWeekRates`, `seasonalAdjustments` (via
   the Firebase console or a small script — worth building once the admin
   UI doesn't exist yet)
5. `firebase deploy --only firestore:rules,functions`
6. Point your Stripe webhook endpoint at the deployed `stripeWebhook` URL
7. Wire `VITE_FIREBASE_*` env vars into Netlify's build settings
# high-meadows
