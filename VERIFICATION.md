# Verification

Verification for the selected second storefront and confirmed prices:

- TypeScript check and Vite production build: passed.
- 23 HTTP/database, price migration and studio motion tests: passed.
- Local development server startup: passed.
- 17 local HTTP smoke checks cover homepage, shop, product route, admin route, catalog API, transformed React modules, product images, the approved logo and its transparent web version.
- Secrets and runtime customer database excluded from Git.

The automated checks cover authentication, CSRF, private records, valid/invalid customer selections, persistent enquiries, duplicate-submission handling, server-calculated discounts, size-specific inventory, transaction rollback and cancellation restoration.

Browser rendering, pointer interactions, mobile screenshots, keyboard navigation and animation frame rate were **not** verified in an interactive browser in this environment. The source includes responsive layouts, native dialogs and reduced-motion alternatives, but those need a visual browser review before launch.

The owner-selected second “GOOD FORM” layout and light/dark switch retain the approved transparent logo. Manual mouse/drag/keyboard movement now runs through one tested controller for both the immediate photo and optional on-demand WebGL renderer. Reduced-motion input remains available. Extra slogans and duplicate headings have been removed. The owner’s four confirmed prices are saved in the initial catalog and a one-time migration updates previously unpriced existing entries without overwriting administrator edits or inventory.

The store starts in enquiry mode because size inventory, shipping and business details have not been supplied. Three published styles now have confirmed prices, and the priced dark-brown draft still awaits its product photograph. The automated priced-order tests use an isolated temporary database and synthetic fixtures only.
