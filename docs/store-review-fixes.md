# Storefront and owner workspace fixes

The review found payment instructions on availability enquiries, seven main styles with unconfirmed inventory, a Coffee Brown filter that displayed the Black variant, shared homepage metadata on product pages, and twelve failing legacy tests.

## Checkout and availability

- Availability enquiries show no bank recipient or payment instructions, including older enquiry records that contain a payment method. Confirmed orders use the recipient snapshot saved with that order.
- Payment instructions appear after an order reference and total exist. Checkout offers only payment methods configured by the owner.
- Guests can send an availability enquiry and receive a reference without creating an account. Confirmed orders continue to use accounts for private payment receipts and order tracking.
- Unknown inventory is labelled clearly on product pages and stays an enquiry. Physical stock is never inferred. The old twenty-pair migration is restricted to the five styles covered by that original instruction; later styles retain their own quantities.

## Owner workspace

Overview → **Complete setup** now opens **Collection → Needs setup**. Each affected product lists the missing price/photo/size stock. **Edit product** includes a shortcut to apply an explicitly entered, confirmed quantity to all selected sizes. Blank quantities remain unknown; zero means sold out.

The product editor includes optional supplier-confirmed sizing system, recommended foot lengths in centimetres and fit notes. The size guide displays those measurements when supplied and otherwise provides measuring steps and a contact link. No size conversions or measurements are invented.

Store settings includes an optional delivery estimate and exchange request window. These appear with the owner's delivery and return terms. The owner must supply their actual courier estimate, policy, quantities and measurements.

Product uploads accept JPG/PNG/WebP files up to 20 MB and resize them in the browser before sending at most 2.7 MB to the existing validated upload API. Existing successful uploads remain in the editor if a later photo fails. Payment receipts retain their original upload flow. Owner-selected cover images are respected.

## Catalogue and performance

- Color and text search display the matching variant's own cover, name, price and link. Black/black filter choices are merged without rewriting owner data.
- The homepage counts main styles consistently with the shop. Card numbering uses 01–11 rather than 010/011.
- Landing category imagery uses the approved studio retouches.
- Three frequently loaded PNG images now use WebP copies with identical dimensions and alpha channels. Total transfer size falls from 5,354,770 to 608,882 bytes (about 89%); original files are retained.
- Small-screen admin navigation uses readable buttons with adequate tap targets; stock and measurement forms wrap to the available width.

## Product discovery

Public page HTML includes the page's own title, description, canonical and social image before JavaScript runs. Product JSON-LD uses actual catalogue prices and only states availability when quantities are known. Client-side navigation updates the same metadata. Private pages are noindex, and missing/unpublished product URLs return 404.

The sitemap reads published product URLs from the live database, so products added in admin appear without a source edit. Vercel explicitly includes `dist/index.html` in the function bundle and routes page/sitemap requests to the existing server. Static assets remain served directly. See [Google's ecommerce URL guidance](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites) and [Vercel's file handling guidance](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).

## Validation

- All **112 tests pass**, with no skips. Coverage includes authenticated writes/CSRF, enquiry stock preservation, measurement/policy validation, private receipts, live Postgres page/sitemap generation, unpublished product removal, HEAD requests and escaped metadata/JSON-LD.
- Production TypeScript/Vite build and smoke checks pass.
- Built production HTML was checked through a real local HTTP server for the homepage, shop, product, admin, account, sitemap and missing-page routes; referenced JS/CSS assets load.
- Existing production products, inventory, prices, order records and policies are not overwritten by these fixes. New measurement and policy fields remain optional until the owner supplies their actual values.
