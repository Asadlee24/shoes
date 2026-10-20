# QADAM FLEX

A complete local footwear boutique built around the owner's loafer photographs and approved logo. Includes a monochrome light/dark storefront, an interactive Three.js studio, product browsing, persistent bag and wishlist, customer enquiries, configurable cash-on-delivery checkout, and protected store management.

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

- Black/chalk monochrome design, bold display typography, a persistent light/dark toggle and a new editorial homepage.
- Lazy-loaded Three.js studio with a dimensional display plinth, scene lighting, alpha-aware product shadows and limited pointer-driven perspective. Switch between the black textured and brown suede pairs.
- Scroll-linked detail imagery, responsive product cards, GSAP transitions and reduced-motion alternatives. The WebGL scene pauses offscreen and retains a photographic fallback on unsupported devices.
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
- Settings: contact email, WhatsApp, Instagram, address, announcement, delivery price, delivery/return wording and cash-on-delivery availability.
- Discounts: percentage/fixed codes, minimum spend and expiry.

Passwords are hashed with scrypt. Sessions use hashed random tokens and HTTP-only SameSite cookies. Admin changes require a session and CSRF token. Customer records and the local database are not public assets.

## Real business data still needed

The owner has not supplied prices, size-specific stock, the sizing system, shipping fees, business contacts or final exchange/return terms. These are intentionally **not invented**.

All original products initially show **Price on request**. Customers can submit an enquiry without payment or a false purchase confirmation. When a product has a price and known inventory for the selected size, shipping is configured, and COD is enabled, the same form can create a local cash-on-delivery order. Availability and totals are validated on the server. Stock is reserved transactionally and restored once if an order is cancelled.

The supplied labels are **7–11**; do not describe them as UK/US/EU or add conversion tables without confirmation. Product material descriptions reflect appearance, not certifications. Confirm the dark suede loafer's final black/navy color name. Manufacturer markings in the photographs are preserved.

Online card payments, courier bookings, live email/SMS and a public deployment are not connected. A recorded enquiry is visible in the administrator area; it is not automatically sent to a phone or email address. WhatsApp links appear only after a valid business number is configured.

## Files and data

- `server/catalog.mjs`: initial catalog and default settings, seeded once for a new database.
- `server/index.mjs`: HTTP server, API, authentication, checkout and file uploads.
- `server/store.mjs`: SQLite persistence, catalog and input validation, total calculation.
- `src/Home.tsx`, `src/monochrome.css`: redesigned showroom layout and monochrome design system.
- `src/Showroom.tsx`: optional Three.js display scene, lighting and product presentation.
- `src/theme.tsx`: persistent light/dark theme; the head script in `index.html` applies the saved choice before rendering.
- `src/styles.css`: shared storefront and administration components.
- `src/Pages.tsx`: storefront routes and forms.
- `src/Admin.tsx`: protected management UI.
- `public/products`: owner-supplied photographs and the black/brown studio cutouts.
- `public/brand/approved-logo.png`: approved logo; `logo-transparent.png` is the transparent web adaptation. The header uses the original emblem and letterforms in a horizontal lockup; the footer shows the complete stacked logo.
- `data/store.db`: runtime SQLite database (ignored by Git).
- `.env`: private local configuration (ignored by Git).

The black and brown studio images are AI-assisted photographic cutouts for visual presentation. Original product photographs remain available in each gallery. The display environment uses actual Three.js geometry and lighting; the shoes remain photo-textured planes with tightly limited perspective. This is not a genuine 360-degree product model; no unrelated shoe model is substituted.

Back up `data/`, uploaded photos under `public/products/upload-*`, and `.env` privately. Do not commit customer data or secrets to GitHub. Editing seed data does not overwrite an existing database: use the administrator for ongoing changes.

## Validation

```bash
npm test
npm run build
```

Tests cover real HTTP requests, enquiry persistence, idempotency, validation, authentication/CSRF, discount totals, size inventory, checkout rollback and cancellation restoration. Test prices and customer records use a temporary database; they never enter the real store catalog.

## Deployment notes

This implementation requires a persistent **Node.js process and writable disk** for SQLite and uploaded images. A static-only host cannot run the backend. Keep one application instance, or migrate persistence to a shared database before scaling. Set `SECURE_COOKIES=true` when serving behind HTTPS. Complete the actual business details and applicable policies before accepting public purchases.

Typography: DM Sans and Manrope, loaded from Google Fonts with local system fallbacks. Interface icons: Lucide. Product photography supplied by the store owner.
