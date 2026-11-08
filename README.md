# 🕯️ MehrNuri

Peer-to-peer micro-donation platform helping vulnerable families in Uzbekistan pay their winter utility bills (*kommunalka*: gas, electricity, water, heating, hot water, waste).

## Quick Start (Zero Setup)

```bash
# Starts an embedded local MongoDB (if port 27017 isn't already running),
# seeds sample bills & donors, and launches Next.js dev server:
npm run dev:local
```

Or if you already have MongoDB running locally or on Atlas (configured in `.env.local`):

```bash
npm run seed
npm run dev
```

Open **http://localhost:3000** (defaults to `uz-latn`, switchable between **O'zbekcha**, **Ўзбекча**, and **Русский**).

- **Admin Panel**: `http://localhost:3000/uz-latn/admin` (default password in `.env.local`: `mehr-admin-2026`).

---

## Renaming the Brand in 1 Place

Change `NEXT_PUBLIC_BRAND_NAME` in `.env.local` (or fallback in `src/config/brand.ts`) and restart. Every page, metadata title, and notification updates automatically.

---

## Payment Gateway Architecture (Mock → Click / Payme)

- **Mock Gateway (enabled by default in development)**:
  1. Donor selects a bill, chooses an amount, and clicks **Pay**.
  2. Redirects to `/[locale]/mock-pay/[paymentId]`.
  3. Clicking **Simulate Successful Payment** or **Simulate Failed Payment** sends a signed webhook POST to `/api/payments/mock/callback`.
  4. The webhook atomically updates `paidAmount`, releases `reservedAmount`, updates the donor's leaderboard total, and streams the new status (`unpaid` / `partially_paid` / `fully_paid`) to connected browsers via SSE (`/api/bills/stream`).

- **Going Live with Click or Payme (Zero Code Changes)**:
  - **Click**: Fill `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` in `.env.local`. Point Click's Prepare URL to `{APP_URL}/api/payments/click/prepare` and Complete URL to `{APP_URL}/api/payments/click/complete`.
  - **Payme**: Fill `PAYME_MERCHANT_ID`, `PAYME_KEY` in `.env.local`. Point Payme's Merchant endpoint to `{APP_URL}/api/payments/payme` (account field: `payment_id`).
