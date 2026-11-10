# MehrNuri — Peer-to-Peer Utility Bill Micro-Donation Platform (Uzbekistan)

**MehrNuri** is a production Next.js 16 + MongoDB platform where donors in Uzbekistan help vulnerable families pay their utility bills (*kommunalka*: electricity, natural gas, cold water, heating, hot water, and waste) **directly to official state utility accounts** — without a middleman holding funds — and verify donations via official **Uzbekistan Tax Committee (`ofd.soliq.uz`)** fiscal receipts.

- **Live Production**: [https://mehrnuri.netlify.app](https://mehrnuri.netlify.app)
- **GitHub Repository**: [https://github.com/Temurbeko/mehrnuri](https://github.com/Temurbeko/mehrnuri)
- **Supported Locales**: `uz-latn` (O'zbekcha), `uz-cyrl` (Ўзбекча), `ru` (Русский)

---

## 1. Core Features & End-to-End Flows

### A. Family Help Request Flow (`/[locale]/ask` -> `POST /api/bills`)
1. A family selects their **utility type** (`electricity`, `gas`, `water`, `heating`, `hot_water`, `waste`), **region** (14 regions), and **district** (68 districts mapped to official 7-digit **SOATO** codes and official regional suppliers such as *HET*, *Hududgazta'minot*, *Uzsuvta'minot*, *Veolia Energy*, *Maxsustrans*).
2. Enters the **utility account number** (*shaxsiy hisob raqami*, 5–20 digits), payment purpose (`main` or ` fine`), optional meter reading, amount needed (`1,000` – `5,000,000` UZS), contact phone (`+998XXXXXXXXX`), and short story.
3. The system prevents duplicate open bills for the same `{ utilityType, accountNumber }`, blocks accounts donors have reported (`403 account_blocked`), caps one open request per phone plus 3 per 30 days (`409 phone_has_open_bill` / `429 phone_limit_reached`), and sets an HTTP-only signed `mn_owner` cookie (`60 days`) so the family can send thank-you reactions once donors contribute.
4. **The request publishes immediately** (`reviewStatus: "approved"`) — no admin approves anything in the normal path. The only automatic brake is an implausible amount for the utility type (`PLAUSIBLE_MAX_UZS` in `src/lib/domain.ts`), which holds the request as `pending_review`. Each request also gets `expiresAt` (`BILL_TTL_DAYS`, 30 days) and closes itself after that, because utility debt is re-issued monthly.

### A2. Donor-Side Verification (`POST /api/bills/[id]/verdict`)
MehrNuri cannot read anybody's utility debt — that needs a supplier/aggregator contract. **Every donor can**: pasting the account number into Click / Payme / Uzum / Paynet shows the real balance before paying. So the donors are the verifiers (`src/lib/bills/verdicts.ts`, `src/components/DebtCheck.tsx`):
- The donor answers `match`, `amount_differs` (with the amount their app showed) or `no_debt`, on the payment page (step 2).
- **Who may vote** (`assertCanVote`): a vote can hide a family's request, so it must cost something. Only a donor who opened a payment on that bill (`401 donor_required` / `403 verdict_not_allowed`), never the family that posted it (owner cookie or same network as the request → `403`), and one vote per donor and per network on each bill (`409 already_voted`). Without this, one person with a free nickname could hide any real request alone.
- One `match` promotes the bill to `trustLevel: "donor_checked"`. `MISMATCH_LIMIT_BILL` (2) reports flip it to `reviewStatus: "flagged"`, which takes it off the feed and into the admin's reported queue. A `proven` bill needs double that, since its real debt can legitimately differ from the claim.
- A Soliq-verified payment marks the account `proven` in the `accounts` ledger, so **future requests on that account publish as trusted instantly**. `MISMATCH_LIMIT_ACCOUNT` (3) reports block the account for good — reputation follows the account number, not a name or phone.
- This is safe because MehrNuri never holds funds: a false request can only waste a donor's attention, and it dies the moment they open their app.

### B. Direct Utility Payment & Soliq OFD Verification Flow (`/[locale]/bill/[id]` -> `/[locale]/pay/[id]`)
Because MehrNuri operates **without holding user funds**, donors pay the family's utility account directly in their own banking/payment app (**Click**, **Payme**, **Uzum Bank**, or **Paynet**):
1. **Donor Identity (`POST /api/donors`)**: Donor picks or auto-generates a nickname (e.g., `Mehribon_412`). Stored via HTTP-only `mn_donor` cookie + recoverable via a `recoveryCode` (`/[locale]/me`).
2. **Reservation (`POST /api/payments/checkout`)**: Reserves the chosen amount on the bill for `RESERVATION_MINUTES` (default `20` min) and redirects to `/[locale]/pay/[paymentId]`.
3. **Step 1 — Direct Payment (`DirectPaymentClient.tsx`)**:
   - Auto-copies the family's utility `accountNumber` and displays the exact amount + official supplier + SOATO/district path.
   - Provides deep links to open **Click / Payme / Uzum / Paynet** on mobile or web checkout + scannable QR code on desktop (`src/lib/qr.ts`, zero external dependencies).
4. **Step 2 — Client-Side QR Extraction (`src/lib/qrDecode.ts`) + Live Soliq OFD Verification (`src/lib/payments/verifyReceipt.ts`)**:
   - **Zero-Media Storage**: If the donor uploads a screenshot of their payment receipt, the browser extracts the `ofd.soliq.uz` QR string in-memory (via native `BarcodeDetector` or custom Canvas finder-pattern check) and **never uploads image bytes to the database**. Donors can also paste the `https://ofd.soliq.uz/epi?t=...&r=...&c=...&s=...` link directly.
   - **Live Tax Committee (`new-ofd.soliq.uz`) Verification**:
     - Parses `terminalId` (`t`), `paymentNo` (`r`), `paymentDate` (`c`), and `fiscalSign` (`s` or `h`).
     - Enforces **anti-replay uniqueness** (`receiptKey = sha256(canonical)` with a unique MongoDB index on `payments.receiptKey`) so a receipt can never be used twice.
     - Signs the request on the server with HMAC-SHA256 (`X-Timestamp`, `X-Signature`) and queries `POST https://new-ofd.soliq.uz/api/payment`.
     - **Hosting requirement**: Soliq only answers requests from inside Uzbekistan (TAS-IX), so production must run on a server in Uzbekistan with `SOLIQ_MODE=live`. If Soliq can't be reached the API returns `503 soliq_unavailable`.
     - **Test mode (`SOLIQ_MODE=mock`)**: for test hosting outside Uzbekistan (e.g. Netlify). The Soliq call is skipped and any well-formed receipt link is accepted for the exact donation amount (label `OFD #... (TEST MODE)`). Parsing and anti-replay still run. Never use it in production.
     - Rejects fake/non-existent receipts (`422 soliq_receipt_not_found`), refunded receipts (`isRefund === 1` -> `422 soliq_receipt_refunded`), and receipts whose total is below the donation (`422 receipt_amount_mismatch`).
     - Verified receipts credit the donor on the **Top Donors Leaderboard** (`leaderboardCredited: true`).
5. **Step 3 — Skip Receipt Option (`skipLeaderboard: true`)**:
   - If the donor paid the bill but doesn't want to attach a fiscal receipt, they can confirm the bill payment without receiving Leaderboard points (`leaderboardCredited: false`).

### C. Family Thank-You Reactions (`POST /api/bills/[id]/react`)
- Families (authenticated via `mn_owner` cookie) or admins (`mn_admin` cookie) can toggle up to 4 gratitude badges on their bill (`thank_you`, `blessing`, `warm_home`, `accepted`).

### D. Admin Exception Panel (`/[locale]/admin`)
- Password-protected (`ADMIN_PASSWORD`, signed HTTP-only `mn_admin` cookie, timing-safe comparison).
- **Not a gate families wait in.** Three queues: `reported` (bills donors flagged), `pending` (held automatically for an implausible amount), and `payouts`.
- Approving clears the reports that hid a bill and unblocks its account. Rejecting can also block the utility account for good (`blockAccount: true`).

---

## 2. Complete Codebase Map (Fast Lookup for Devs & AI Agents)

```text
MehrNuri/
├── netlify.toml                         # Netlify build config (@netlify/plugin-nextjs)
├── next.config.ts                       # Security headers (CSP, X-Frame-Options, Referrer-Policy)
├── scripts/
│   ├── dev-local.mjs                    # Starts embedded MongoMemoryServer (if :27017 closed) + seeds + next dev
│   ├── local-mongo.mjs                  # Standalone embedded MongoDB runner on 127.0.0.1:27017
│   └── seed.mjs                         # Idempotent DB seeder (4 Olmazor utility bills + 2 sample donors)
└── src/
    ├── proxy.ts                         # Next.js 16 Middleware: locale routing, cookie sync, IP burst guard
    ├── config/
    │   ├── brand.ts                     # Brand name, logo paths, and localized taglines
    │   └── env.ts                       # Zod-validated server environment variables
    ├── i18n/                            # 100% CENTRALIZED LOCALIZATION (Zero inline locale strings elsewhere)
    │   ├── config.ts                    # LOCALES ("uz-latn", "uz-cyrl", "ru"), labels, Accept-Language detector
    │   ├── index.ts                     # getDictionary(locale), fmt() template helper, formatMoney()
    │   └── dictionaries/
    │       ├── uz-latn.ts               # Master dictionary & strict TypeScript `Dictionary` schema
    │       ├── uz-cyrl.ts               # Uzbek Cyrillic dictionary (implements `Dictionary`)
    │       └── ru.ts                    # Russian dictionary (implements `Dictionary`)
    ├── lib/
    │   ├── domain.ts                    # Core types: UtilityType, Region, PublicBill, PublicPayment, PublicDonor
    │   ├── uzbekistan.ts                # Pure data: 14 regions, 68 districts + SOATO codes, official suppliers
    │   ├── merchants.ts                 # Pure data: Click, Payme, Uzum, Paynet URLs, colors, and icons
    │   ├── validation.ts                # All Zod request schemas (createBill, checkout, confirmPayment, admin)
    │   ├── qr.ts                        # Zero-dependency QR Code Matrix encoder (ISO/IEC 18004) for SVG rendering
    │   ├── qrDecode.ts                  # Client-side QR decoder from receipt images (0 KB uploaded to server)
    │   ├── notify.ts                    # Optional Telegram Bot admin notifications (fire-and-forget)
    │   ├── admin/
    │   │   ├── service.ts               # listBillsForAdmin, approveBill, rejectBill, markBillPaidOut
    │   │   └── session.ts               # Admin login verification & signed `mn_admin` cookie (12h TTL)
    │   ├── bills/
    │   │   └── service.ts               # createBill, listOpenBills, getBill, toggleBillReaction, billsChangedSince
    │   ├── db/
    │   │   ├── models.ts                # MongoDB document interfaces (BillDoc, DonorDoc, PaymentDoc, RateLimitDoc)
    │   │   └── mongo.ts                 # Singleton MongoClient + automatic index creation (`ensureIndexes`)
    │   ├── donors/
    │   │   ├── leaderboard.ts           # topDonors() query sorted by totalDonated desc
    │   │   └── session.ts               # createDonor, currentDonor, restoreDonorByCode (`mn_donor` cookie)
    │   ├── payments/
    │   │   ├── core.ts                  # createPayment, markPaid, markUnsuccessful, sweepExpired reservations
    │   │   ├── providers.ts             # Direct checkout URL builder & HMAC paymentSignature(paymentId)
    │   │   └── verifyReceipt.ts         # Soliq OFD parser, HMAC signer, amount check, anti-replay, SOLIQ_MODE
    │   └── security/
    │       ├── crypto.ts                # sha256, hmacSha256, safeEqual, signPayload/verifySignedToken
    │       ├── http.ts                  # HttpError, handler() wrapper, readJson(), assertSameOrigin(), clientIp()
    │       └── rateLimit.ts             # Sliding-window rate limiter (Mongo TTL or in-memory store)
    ├── components/
    │   ├── api.ts                       # Typed client fetch wrapper + localized error code mapper
    │   ├── Header.tsx                   # Sticky navigation bar + locale switcher
    │   ├── LiveFeed.tsx                 # Filterable bill grid + EventSource("/api/bills/stream") live updates
    │   ├── BillCard.tsx                 # Utility card with progress bar, SOATO/district badge, reactions
    │   ├── DonatePanel.tsx              # Bill detail view, amount presets, nickname selector, merchant picker
    │   ├── DirectPaymentClient.tsx      # 3-step direct payment, QR scanner, Soliq OFD receipt submission
    │   ├── PaymentResultClient.tsx      # Post-payment confirmation screen
    │   ├── AskForm.tsx                  # Family bill submission form with dynamic region/district/purpose fields
    │   ├── ProfileClient.tsx            # Donor profile, recovery code backup, and restore form
    │   └── AdminClient.tsx              # Admin moderation dashboard
    └── app/
        ├── [locale]/
        │   ├── page.tsx                 # Home page (hero stats + LiveFeed + 3-step how-it-works)
        │   ├── ask/page.tsx             # Family help request page
        │   ├── bill/[id]/page.tsx       # Bill detail & donation page
        │   ├── pay/[id]/page.tsx        # Direct payment & Soliq receipt verification page
        │   ├── payment/[id]/page.tsx    # Payment result page
        │   ├── leaders/page.tsx         # Top Donors Leaderboard page
        │   ├── me/page.tsx              # Donor profile & recovery code page
        │   └── admin/page.tsx           # Admin dashboard page
        └── api/
            ├── health/route.ts          # GET: DB ping & active providers
            ├── bills/route.ts           # GET: open bills feed | POST: submit new bill
            ├── bills/[id]/route.ts      # GET: single bill details
            ├── bills/[id]/react/route.ts# POST: toggle family gratitude reaction
            ├── bills/stream/route.ts    # GET: serverless-compatible SSE live feed updates
            ├── donors/route.ts          # GET: current donor | POST: register nickname | DELETE: logout
            ├── donors/restore/route.ts  # POST: restore donor session via recoveryCode
            ├── leaderboard/route.ts     # GET: top 50 verified donors
            ├── payments/checkout/route.ts # POST: reserve bill amount & create payment session
            ├── payments/confirm/route.ts  # POST: verify Soliq receipt (or skip/cancel) & finalize payment
            ├── payments/[id]/route.ts   # GET: payment status
            ├── admin/session/route.ts   # POST: admin login | DELETE: admin logout
            └── admin/bills/route.ts     # GET: list bills by reviewStatus | PATCH: approve/reject/payout
```

---

## 3. API Endpoints Quick Reference

| Method | Endpoint | Auth / Guard | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Checks MongoDB ping (`db: "up"`) and enabled payment providers. |
| `GET` | `/api/bills` | Rate limit (`read`) | Lists approved, open bills (`?utilityType=&region=&limit=`). |
| `POST` | `/api/bills` | Same-origin + `billCreate` | Creates a bill, published immediately (`approved`), and sets `mn_owner` cookie. |
| `GET` | `/api/bills/[id]` | Rate limit (`read`) | Returns a single public bill + `reviewStatus`. |
| `POST` | `/api/bills/[id]/verdict` | Same-origin + `verdict` + `mn_donor` with a payment on this bill | Donor reports what their payment app showed (`match` / `amount_differs` + `seenAmount` / `no_debt`). Not the bill's owner; one per donor and per network per bill (`409 already_voted`). |
| `POST` | `/api/bills/[id]/react` | `mn_owner` or `mn_admin` | Toggles a thank-you reaction (`thank_you`, `blessing`, `warm_home`, `accepted`). |
| `GET` | `/api/bills/stream` | Rate limit (`stream`) | Serverless SSE endpoint (`retry: 8000`) pushing recent bill updates. |
| `GET` | `/api/donors` | Rate limit (`read`) | Returns current donor from `mn_donor` cookie. |
| `POST` | `/api/donors` | Same-origin + `donorCreate` | Registers a donor nickname, sets `mn_donor` cookie, returns `recoveryCode`. |
| `POST` | `/api/donors/restore` | Same-origin + `donorCreate` | Restores donor cookie from `recoveryCode`. |
| `GET` | `/api/leaderboard` | Rate limit (`read`) | Returns top 50 donors with `totalDonated > 0`. |
| `POST` | `/api/payments/checkout` | `mn_donor` + `checkout` | Atomically reserves amount on bill and returns `/[locale]/pay/[paymentId]`. |
| `POST` | `/api/payments/confirm` | HMAC `signature` + `paymentConfirm` | Verifies Soliq OFD receipt (or `skipLeaderboard` / `failure`), updates bill & leaderboard. |
| `GET` | `/api/payments/[id]` | Rate limit (`read`) | Returns public payment status. |
| `POST` | `/api/admin/session` | Same-origin + `adminLogin` | Verifies `ADMIN_PASSWORD` and sets `mn_admin` cookie. |
| `GET` | `/api/admin/bills` | `mn_admin` cookie | Returns the three exception queues: `reported`, `pending`, `payouts`. |
| `POST` | `/api/admin/bills?id=` | `mn_admin` + `admin` | Executes `approve`, `reject` (with `reason`, optional `blockAccount`), or `payout` (with `reference`). |

---

## 4. Database Collections & Indexes (`src/lib/db/mongo.ts`)

1. **`bills`**:
   - `{ reviewStatus: 1, isOpen: 1, utilityType: 1, region: 1, createdAt: -1 }` (`feed_idx`)
   - `{ utilityType: 1, accountNumber: 1, isOpen: 1 }` (`acct_open_idx`)
   - `{ updatedAt: -1 }` (`updated_idx`)
   - `{ code: 1 }` (`unique: true`, `code_uniq`)
2. **`donors`**:
   - `{ nicknameKey: 1 }` (`unique: true`, lowercase nickname)
   - `{ totalDonated: -1, donationsCount: -1 }` (`leaderboard_idx`)
   - `{ tokenHash: 1 }` (`token_idx`)
3. **`payments`**:
   - `{ billId: 1, status: 1 }` (`bill_status_idx`)
   - `{ donorId: 1, status: 1 }` (`donor_status_idx`)
   - `{ status: 1, expiresAt: 1 }` (`expiry_idx`)
   - `{ receiptKey: 1 }` (`unique: true, sparse: true`, `receipt_uniq` — prevents fiscal receipt replay)
4. **`rate_limits`**:
   - `{ expiresAt: 1 }` (`expireAfterSeconds: 0`, MongoDB TTL index)
5. **`verdicts`** (donor verifications):
   - `{ billId: 1, voterHash: 1 }` (`unique: true`, `one_verdict_per_voter` — one answer per visitor per bill)
   - `{ accountKey: 1, createdAt: -1 }`
6. **`accounts`** (reputation ledger keyed by `utilityType:accountNumber`):
   - `{ blocked: 1 }`, `{ lastSeenAt: -1 }`
   - Holds `provenPayments` (Soliq-verified payments received), `matchVotes`, `mismatchVotes`, `blocked`.

---

## 5. Local Development & Commands

```bash
# 1. Start local dev server (auto-starts embedded MongoDB if :27017 is not running & seeds data)
npm run dev:local

# 2. Typecheck (strict TypeScript, must pass with 0 errors)
npm run typecheck

# 3. Production build check
npm run build

# 4. Seed or force-reseed database
node scripts/seed.mjs --force
```

### Environment Variables (`.env.local` / Netlify)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017` | MongoDB connection string (`mongodb+srv://...` in production) |
| `MONGODB_DB` | No | `mehrnuri` | Database name |
| `APP_SECRET` | Yes | — | 32+ char secret for HMAC cookies & payment signatures |
| `ADMIN_PASSWORD` | Yes | — | Password for `/[locale]/admin` (min 8 chars) |
| `APP_URL` | No | `http://localhost:3000` | Public base URL (`https://mehrnuri.netlify.app`) |
| `RESERVATION_MINUTES` | No | `20` | Minutes a payment checkout reserves bill capacity |
| `MIN_DONATION_UZS` | No | `1000` | Minimum donation in UZS |
| `MAX_DONATION_UZS` | No | `10000000` | Maximum donation in UZS |
| `RATE_LIMIT_STORE` | No | `mongo` | `mongo` or `memory` |
| `SOLIQ_MODE` | No | `live` | `live` (real Soliq check, server must be in Uzbekistan) or `mock` (test hosting only: accepts any well-formed receipt link) |
| `TELEGRAM_BOT_TOKEN` | No | — | Optional Telegram bot token for admin alerts |
| `TELEGRAM_ADMIN_CHAT_ID` | No | — | Optional Telegram chat ID for admin alerts |

---

## 6. Deployment (Netlify + MongoDB Atlas)

- **Hosting**: Netlify (`mehrnuri`, Site ID `2d77b6e4-d292-40cc-a862-09530e076374`) linked to GitHub `Temurbeko/mehrnuri` (`main` branch). Pushing to `main` triggers automatic deployment.
- **Database**: MongoDB Atlas (`Cluster0`, Frankfurt `eu-central-1`, M0 Free Tier).
- **Custom Domain (`mehrnuri.uz`)**: Add `mehrnuri.uz` in Netlify -> **Domain management**, point the domain's DNS `A` / `CNAME` records to Netlify, and update `APP_URL=https://mehrnuri.uz` in Netlify Environment Variables.
