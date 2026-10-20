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

The owner supplied these PKR prices: brown suede Rs 3,500; black textured Rs 2,200; black formal Rs 2,800; dark brown textured Rs 2,200. The dark brown textured style remains a draft until its full product photograph is supplied. The separate dark suede style remains unpriced because it does not appear in the supplied price list. Size-specific stock, the sizing system, shipping fees and final exchange/return terms are still needed.

Confirmed prices appear on cards, product pages and bag subtotals. Unpriced products show **Price on request**. Customers can submit an enquiry without payment or a false purchase confirmation. When a product has a price and known inventory for the selected size, shipping is configured, and COD is enabled, the same form can create a local cash-on-delivery order. Availability and totals are validated on the server. Stock is reserved transactionally and restored once if an order is cancelled.

The supplied labels are **7–11**; do not describe them as UK/US/EU or add conversion tables without confirmation. Product material descriptions reflect appearance, not certifications. Confirm the dark suede loafer's final black/navy color name. Manufacturer markings in the photographs are preserved.

Online card payments, courier bookings, live email/SMS and a public deployment are not connected. A recorded enquiry is visible in the administrator area; it is not automatically sent to a phone or email address. Official phone and social links are configured. The Bank & Easypaisa page has copyable account details; customers confirm their order before transferring, and receipts are checked manually. Bank details do not create or verify a payment.

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

A private order notification recipient can be saved under Admin → Store settings → Order notifications. The address is excluded from the public catalog and admin demo, and can be replaced during client handover. Saving a recipient does not enable sending: the email provider and verified sender still need to be connected.
