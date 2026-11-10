<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AI Agent Fast-Index & Architectural Rules (`MehrNuri`)

Read this section **before** running broad file searches to save tokens and time.

## 1. Strict Architectural Invariants (DO NOT VIOLATE)

1. **100% Centralized Localization (`src/i18n/`)**:
   - All user-facing strings (including all 68 district names, merchant descriptions, reaction labels, checkout steps, and error messages) live **exclusively** in:
     - `src/i18n/dictionaries/uz-latn.ts` (Master schema `Dictionary`)
     - `src/i18n/dictionaries/uz-cyrl.ts`
     - `src/i18n/dictionaries/ru.ts`
   - **NEVER** put inline `Record<Locale, ...>` translation objects or `"uz-latn"` / `"uz-cyrl"` string literals inside components, API routes, or `src/lib/` files.
   - `src/lib/uzbekistan.ts` and `src/lib/merchants.ts` store **pure data only** (IDs, SOATO codes, URLs, colors).
2. **Zero Mock / Dead / Hardcoded Form Defaults**:
   - Do not add mock payment gateways, fake bill verifiers, or hardcoded default input values in user-facing forms (`AskForm.tsx` inputs must start empty).
   - Sole exception: `SOLIQ_MODE=mock` in `verifyReceipt.ts`, an explicit env switch for test hosting outside Uzbekistan. Default is `live`.
3. **Next.js 16 Middleware Convention**:
   - Next.js 16 uses `src/proxy.ts` (`export function proxy(req: NextRequest)`), **not** `src/middleware.ts`.
4. **Zero-Media Receipt Storage & Server-Only Soliq Verification**:
   - Receipt images are decoded client-side in `src/lib/qrDecode.ts`; only the `ofd.soliq.uz` URL string is sent to the server.
   - `src/lib/payments/verifyReceipt.ts` signs and sends Soliq OFD requests **from the server only** (`SOLIQ_SIGN_KEY` must never be exposed in client code) and checks the receipt total covers the payment amount.
   - **Never accept Soliq results from the browser** (the old TAS-IX browser relay was removed: clients could forge the response). Soliq only answers from inside Uzbekistan, so production (`SOLIQ_MODE=live`) must run on a server in Uzbekistan; test hosting elsewhere (Netlify) uses `SOLIQ_MODE=mock`.

## 2. Fast Task-to-File Lookup

| Task / Feature | Exact File(s) to Read / Edit |
| :--- | :--- |
| Add/edit UI text or translations | `src/i18n/dictionaries/{uz-latn,uz-cyrl,ru}.ts` |
| Regions, districts, SOATO codes, suppliers | `src/lib/uzbekistan.ts` + `src/i18n/dictionaries/*.ts` (`districts`) |
| Click / Payme / Uzum / Paynet app links | `src/lib/merchants.ts` + `src/i18n/dictionaries/*.ts` (`merchants`) |
| Soliq OFD receipt verification logic | `src/lib/payments/verifyReceipt.ts`, `src/app/api/payments/confirm/route.ts` |
| Direct payment UI & QR upload | `src/components/DirectPaymentClient.tsx`, `src/lib/qrDecode.ts`, `src/lib/qr.ts` |
| Bill creation & feed queries | `src/lib/bills/service.ts`, `src/app/api/bills/route.ts`, `src/components/AskForm.tsx` |
| Bill detail & donation amount picker | `src/components/DonatePanel.tsx`, `src/app/[locale]/bill/[id]/page.tsx` |
| MongoDB schemas & indexes | `src/lib/db/models.ts`, `src/lib/db/mongo.ts` |
| Request validation schemas (Zod v4) | `src/lib/validation.ts` |
| Admin panel & moderation API | `src/components/AdminClient.tsx`, `src/lib/admin/service.ts`, `src/app/api/admin/bills/route.ts` |
| Seed data (4 Olmazor bills) | `scripts/seed.mjs` |

## 3. Verification Checklist Before Committing

```bash
npm run typecheck   # Must exit 0 (tsc --noEmit)
npm run build       # Must compile cleanly
```
