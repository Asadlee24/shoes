# QADAM FLEX

A complete local footwear boutique built around the owner's loafer photographs and approved logo. Includes the second “GOOD FORM” monochrome storefront, the approved transparent logo, an interactive Three.js studio, product browsing, persistent bag and wishlist, customer enquiries, configurable cash-on-delivery checkout, and protected store management.

## Run locally

Install **Node.js 24 LTS or newer**. No Docker, paid API, external database or payment account is required.

```bash
git clone https://github.com/Asadlee24/shoes.git
cd shoes
npm install
npm run admin:setup
npm run dev
```

Open **http://localhost:3000**. Store management is **http://localhost:3000/admin**.

`admin:setup` creates `.env` with a salted password hash and prints a generated administrator password once. Save it privately. Username: `admin`. Restart the server after changing credentials. Reset with `npm run admin:setup -- --reset`.

For a production build:

```bash
npm run build
npm start
```

To use another port: `npm run dev -- --port 3001`. The server binds to 127.0.0.1 by default. Configure `HOST` explicitly when needed. Windows PowerShell supports the same npm commands.

## Storefront

- The owner-selected second “GOOD FORM” design: black/chalk monochrome palette, bold typography, responsive layouts and a persistent light/dark switch.
- Clear horizontal logo lockups in the header/menu and the full approved stacked logo in the footer.
- Lazy-loaded Three.js studio with a display plinth, lighting, photo-textured footwear and visible mouse-driven perspective. Switch between black textured and brown suede pairs.
- Mouse movement, horizontal/touch drag, arrow-key controls and a reset button share one motion controller. The interactive photo works immediately, including during WebGL loading or failure.
- The optional renderer loads separately and draws on demand. Reduced-motion mode keeps intentional controls available without interpolation; offscreen motion and settled animation loops stop.
- Short product-focused copy replaces the repeated slogans, ticker and brand manifesto. GSAP entrance/scroll transitions remain.
- Four published products from the supplied photos; the unpictured dark-brown textured loafer is retained as a draft.
- Shop with URL-based search, collection/color/size filters and sorting.
- Product galleries, quick view, image enlargement, size selector and related products.
- Browser-persistent wishlist and variant-aware bag.
- Guest enquiry/checkout form with server-side validation and idempotent submissions.
- Contact form that saves messages for the administrator.
- About, FAQ, delivery/exchange, privacy and terms pages.
- Mobile layouts, native modal focus handling and keyboard controls.

## Administrator

- Products: add/edit products, photos, gallery order, descriptions, category, color, size labels, price and **inventory for each size**; publish/unpublish and choose homepage features.
- Enquiries/orders: view saved customer details and selections; change statuses.
- Settings: official website, phone, WhatsApp, Instagram, TikTok, bank/Easypaisa details, email, address, announcement, delivery price, delivery/return wording and cash-on-delivery availability.
- Discounts: percentage/fixed codes, minimum spend and expiry.

Passwords are hashed with scrypt. Sessions use hashed random tokens and HTTP-only SameSite cookies. Admin changes require a session and CSRF token. Customer records and the local database are not public assets.

## Real business data still needed

The owner supplied these PKR prices: brown suede Rs 3,500; black textured Rs 2,200; black formal Rs 2,800; dark brown textured Rs 2,200. The dark brown textured style remains a draft until its full product photograph is supplied. The separate dark suede style remains unpriced in the seed catalog because it does not appear in the supplied price list; existing administrator prices are preserved. Stock is configured below, and the owner confirmed free delivery on 21 October 2026. The sizing system and final exchange/return terms are still needed.

Confirmed prices appear on cards, product pages and bag subtotals. Unpriced products show **Price on request**. Customers can submit an enquiry without payment or a false purchase confirmation. When a product has a price and known inventory for the selected size, shipping is configured, and COD is enabled, the same form can create a local cash-on-delivery order. Availability and totals are validated on the server. Stock is reserved transactionally and restored once if an order is cancelled.

The supplied labels are **7–11**; do not describe them as UK/US/EU or add conversion tables without confirmation. Product material descriptions reflect appearance, not certifications. Confirm the dark suede loafer's final black/navy color name. Manufacturer markings in the photographs are preserved.

Online card payments, courier bookings and SMS are not connected. The store is deployed at https://www.qadamflex.bond/; owner email notifications use the verified Resend sending domain and the private production API key. Official phone and social links are configured. The Bank & Easypaisa page has copyable account details; customers confirm their order before transferring, and receipts are checked manually. Bank details do not create or verify a payment.

## Files and data

- `server/catalog.mjs`: initial catalog and default settings, seeded once for a new database.
- `server/index.mjs`: HTTP server, API, authentication, checkout and file uploads.
- `server/store.mjs`: SQLite persistence, catalog and input validation, total calculation.
- `src/Home.tsx`, `src/monochrome.css`: the selected second storefront layout and monochrome design system.
- `src/styles.css`: shared storefront and administration components.
- `src/Showroom.tsx`: immediate input handling and the interactive photographic fallback.
- `src/StudioScene.tsx`: optional on-demand Three.js scene with photo-textured footwear.
- `src/studio-motion.ts`: shared bounded movement and animation scheduling, independent of the renderer.
- `src/theme.tsx`: persistent light/dark theme. The head script applies the stored preference before rendering.
- `src/brand.css`: approved logo placement, theme-context contrast and responsive lockups.
- `src/styles.css`: shared storefront and administration components.
- `src/Pages.tsx`: storefront routes and forms.
- `src/Admin.tsx`: protected management UI.
- `public/products`: owner-supplied photographs and the black/brown studio cutouts.
- `public/brand/approved-logo.png`: approved logo; `logo-transparent.png` is the transparent web adaptation. The header uses the original emblem and letterforms in a horizontal lockup; the footer shows the complete stacked logo.
- `data/store.db`: runtime SQLite database (ignored by Git).
- `.env`: private local configuration (ignored by Git).

The homepage displays the approved black textured and brown suede photographic cutouts, with mouse/touch perspective movement above a Three.js plinth. Both have the same visible width, and their lowest visible pixels stay above the platform throughout supported tilts. Product identity, texture and buckle are preserved. These are photographs with a perspective effect; an exact full 360-degree product view needs a product scan or complete turntable photography. Original product photographs remain in the galleries.

Back up `data/`, uploaded photos under `public/products/upload-*`, and `.env` privately. Do not commit customer data or secrets to GitHub. Ordinary seed edits do not overwrite an existing database. The one-time owner price migration fills the four previously unpriced entries on startup and preserves administrator price edits, size inventory and customer records. Use the administrator for ongoing changes.

## Validation

```bash
npm test
npm run build
npm run smoke
```

Tests cover real HTTP requests, enquiry persistence, idempotency, validation, authentication/CSRF, discount totals, size inventory, checkout rollback and cancellation restoration. Motion tests cover stage coordinates, visible rotation limits, reduced-motion manual input, frame settling, offscreen pause/resume and cleanup. Test prices and customer records use a temporary database; they never enter the real store catalog.

## Deployment notes

This implementation requires a persistent **Node.js process and writable disk** for SQLite and uploaded images. A static-only host cannot run the backend. Keep one application instance, or migrate persistence to a shared database before scaling. Set `SECURE_COOKIES=true` when serving behind HTTPS. Complete the actual business details and applicable policies before accepting public purchases.

Typography: DM Sans and Manrope, loaded from Google Fonts with local system fallbacks. Interface icons: Lucide. Product photography supplied by the store owner.

The `/admin/demo` route previews the admin interface using published catalog data only. Customer records and discount codes are excluded, and saves/uploads are disabled. It does not grant access to the protected admin API. Use `/admin` with the running Node backend for real store management.

### Owner email notifications

Admin → Store settings → Order notifications holds the **private receiving email**.
The testing recipient is `asadaly416@gmail.com`. Replace it with the client's
email and save during handover, then use **Send test email**. The recipient is
excluded from the public catalog and admin demo. Changing it affects future
alerts; already queued alerts retain the address saved when the event occurred.
The one-time 21 October 2026 migration fixes the previous misspelling without
overwriting later admin changes.

Set `RESEND_API_KEY` privately in **Vercel Production**, then redeploy. Never add
it to Git, screenshots, chat or `VITE_` variables. The default verified sender is
`Qadam Flex <orders@qadamflex.bond>`; `RESEND_FROM` can override it with another
verified address. The provider's domain verification must be complete. Receiving
these alerts at Gmail does not require buying a mailbox for the sending address.
The first configured Production startup queues one connection test, deduplicated
across cold starts; further tests require authenticated admin access and CSRF.

The store sends owner alerts for new orders/enquiries, website support messages,
enquiry-to-order confirmations, status changes, receipt uploads and receipt
approval/rejection. These are owner notifications, not customer marketing or
email verification. Support means messages submitted through this website;
Instagram/WhatsApp conversations are not imported. Receipt verification remains
manual. Customer addresses, bank details, credentials and private receipt images
are excluded from emails; the button opens the protected dashboard.

An email outbox commits in the same database transaction as the event. Sending
happens **after commit**, so a provider outage cannot undo a saved order. Stable
idempotency keys prevent duplicate sends after interrupted attempts. Network,
429 and 5xx failures retry with backoff on subsequent API activity, up to five
attempts; this is not a separately scheduled worker. Configuration failures need
a fix and **Retry failed alerts** in admin. After 23 hours without confirmation,
check Resend before resending to avoid a duplicate beyond its deduplication
window. Old store records are not backfilled with notification emails.

Admin shows queued, failed and **accepted** alerts. Accepted means Resend has
received the message, not that the recipient's mail server delivered it. Final
provider delivery/bounce status is available in Resend; check inbox and spam.

### Vercel with Neon Postgres

The live Vercel APIs use `DATABASE_URL` (Production, private) from the dedicated
Neon database connected to this project. Keep Preview separate from the client's
Production database. Add private `ADMIN_PASSWORD` (12–200 characters) or
`ADMIN_PASSWORD_HASH` to Production, then redeploy. `ADMIN_USER` defaults to
`admin`. Do not put any of these values in Git or browser-prefixed variables.

The first API invocation creates the namespaced `qf_` tables and seeds the
owner-approved catalog once. Subsequent deployments preserve product changes,
stock, settings, requests and sessions. The schema does not import local test
customers or local `.env` values. Existing local development continues to use
SQLite via `npm run dev`.

The protected API and its CSRF checks are shared between SQLite and Postgres.
Cloud writes take a Postgres transaction lock before reading stock or idempotency
keys; responses and cookies are released only after commit. Login limits are
stored persistently, including failed attempts. Uploaded product images (up to
3 MB, JPG/PNG/WebP with verified file signatures) are stored in Postgres and
served at their original `/products/upload-*` paths with immutable cache headers.

`GET /api/health` reports database connectivity and whether administrator login
is configured; it never returns credentials. Catalog responses exclude discount
codes and the private notification email. Set the test notification address in
the real admin Store settings after signing in; email sending uses the private
Resend configuration described above and is not enabled by attaching a database alone.

The backend uses `@neondatabase/serverless` WebSocket pools scoped to each request.
`npm test` also exercises the adapter against embedded Postgres (PGlite), including
persistence, transactions, protected admin actions, orders, media and rate limits.

### Customer accounts and manual transfer receipts

Customers register/sign in at `/account` with email and a password of at least
12 characters. This uses the existing store session architecture with separate
customer cookies and CSRF tokens, asynchronous scrypt password hashing, persistent
cloud rate limits and private per-customer order associations. Administrator and
customer sessions never grant one another's permissions. An email address is a
login identifier; it is not marked verified and no verification email is sent.

Registration shows a private recovery code once. The customer must save it.
`Forgot password` accepts this code, rotates it on use and invalidates all old
sessions. Changing a password also signs out other sessions. Never ask a customer
to share their recovery code. Email password reset requires a configured mail
provider and is not enabled here.

Checkout requires customer sign-in in the storefront. Existing guest COD/enquiry
API clients remain compatible; guest requests cannot be claimed by merely knowing
an email or phone number. A confirmed, priced order reserves size stock and records
the selected payment method and a snapshot of the owner's account details. If
stock, price or delivery is unknown, it remains an enquiry and cannot accept a
receipt. In Admin → Orders & enquiries, open it and choose `Confirm enquiry as
order` after configuring prices, size stock, shipping and the payment method.

Bank and Easypaisa orders appear in the customer's account with the exact amount,
copyable recipient details and private receipt upload. JPG/PNG/WebP receipts are
limited to 2 MB and checked against their file signatures. Their bytes live in
SQLite/Postgres, not in public product image storage. Only the owning customer or
an authenticated admin can access them; responses are `private, no-store`.

Admin → Orders & enquiries shows payment status and the receipt. Approve only
after independently checking the actual transfer; a receipt is not automatic
payment verification. Rejection requires a note and permits a replacement receipt.
Unreviewed transfers cannot move into confirmed/processing/shipped/delivered.
Cancelled orders cannot accept more receipts, and cancellation restores stock
only once. Any money already transferred must be refunded manually by the owner.

New `qf_customers`, `qf_customer_sessions`, `qf_customer_orders` and
`qf_payment_proofs` tables are created automatically on the next cloud startup;
existing inventory, orders and administrator settings are preserved. No new
third-party account, API secret, card gateway or paid service is required for
these manual transfers. Order and receipt notifications are visible in admin;
owner email sending uses the verified Resend sender and private API key described above.

### Owner stock update and test-record cleanup

The 21 October 2026 owner instruction sets **20 available pairs per style**, split
as 4 each across sizes 7–11. A named, transaction-protected migration applies this
once to the existing catalog, including draft styles, preserving prices, images,
publish status, business settings and orders. Later redeploys never refill sold
stock or overwrite administrator inventory edits.

The owner also confirmed **free delivery (PKR 0)** on 21 October 2026. A separate,
transaction-protected migration sets the existing store's delivery fee to zero
once. New stores also start with zero delivery charges. Existing order totals,
prices, stock and other settings stay intact, and later admin delivery-fee edits
survive redeploys. Existing enquiries can now be confirmed when their prices,
selected-size stock and payment method are configured.

To hide a test record: Admin → Orders & enquiries → open its reference →
**Archive request**. For an actual order, first set its status to **cancelled**;
this returns reserved stock once. Then archive it. Archived records are excluded
from the active admin lists, overview counts and customer order history, while
remaining stored privately. Choose **Archived requests** in the admin filter and
open a record to **Restore request**. Restoring does not reopen a cancelled order
or change inventory. No test or customer records are automatically deleted.
