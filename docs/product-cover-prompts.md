# Single-shoe collection covers

Owner-requested first-photo updates for collection positions 3, 4, 9, 10 and 11,
22 October 2026. Created with the built-in ImageGen editor from each product's
original photograph; the supplied collection screenshot was used only to match
the first two cards' composition. Existing first and second product covers are
unchanged. Original photographs remain in each updated product's gallery.

| Position | Product ID | Edit target(s) | Saved asset |
| --- | --- | --- | --- |
| 3 | `evening-bit` | `public/products/black-formal.jpg` | `public/products/evening-cover-studio-v1.webp` |
| 4 | `midnight-penny` | `public/products/dark-suede.jpg`, `dark-suede-alternate.jpg` | `public/products/midnight-cover-studio-v1.webp` |
| 9 | `metro-court-mocha` | `public/products/qf-mocha-3.webp`, `qf-mocha-1.webp` | `public/products/mocha-cover-studio-v1.webp` |
| 10 | `metro-court-onyx` | `public/products/qf-onyx-1.webp`, `qf-onyx-2.webp` | `public/products/onyx-cover-studio-v1.webp` |
| 11 | `regent-bit-black-2026` | Original first photo ending `c9fe1009-d647-489a-ad35-9ade717fc6e7.jpg` from its existing public listing | `public/products/regent-cover-studio-v1.webp` |

All final assets are 1536 × 1024 WebP images with transparency, encoded at
quality 91 with full alpha quality. The storefront adds its existing neutral
background and a soft CSS shadow. No API/CLI generation fallback was used.

## Shared final prompt

Use case: precise-object-edit. Asset type: first product photo for Qadam Flex
shoe store. Edit the product in image 1; any further product photo is a second
source of the SAME shoe's details. The LAST image is only a composition/style
reference: match the SINGLE SHOE catalogue composition of its first two product
cards; do not copy either reference shoe's design. Create one photorealistic
studio-quality shoe cutout, heel to the LEFT, toe pointing RIGHT, low outside
three-quarter view showing a little of the top, entire sole approximately level
horizontally. One complete shoe only, centered, occupying 88% of a landscape 3:2
canvas width with comfortable transparent margins. Genuinely TRANSPARENT
background including under the shoe: no ground, no plinth, no baked shadow, no
glow. Soft neutral studio illumination, detailed natural materials. Preserve
the source shoe's actual proportions, toe shape, stitching, seams, material,
colors, hardware, sole and visible existing branding exactly; do not redesign
the product or add invented branding. Remove only second shoe, shop background,
supports, wires, price tags and packaging. The website will add the background
and soft shadow. Do not include UI, text labels, border, or watermark.

## Product-specific final prompts

**Evening:** Subject: The Evening Loafer, source image 1. Black polished formal
shoe, glossy toe and outer sidewalls, fine horizontal ribbing on vamp, dark
metallic rounded bit hardware on a shiny strap, slim black formal sole and
small heel. Remove hanging white price tag/string. Preserve the rounded
hardware shape as in THIS source; it differs from the Regent shoe.

**Midnight:** Subject: The Midnight Penny. Use source images 1 and 2 for exact
shoe identity. Very dark midnight navy/near-black fine textile/suede-like upper,
simple cutout penny strap, curved moccasin toe seam with matching dark stitches,
tan lining, thin honey/gum tan sole with modest heel. No metal hardware. Keep
the refined low profile, exact penny strap and deep navy color.

**Mocha:** Subject: The Metro Court Mocha sneaker. Extract/repose the FRONT shoe
from source image 1 with its outer branded side visible. Preserve dark
mocha-brown smooth upper and suede toe overlays, tonal flat laces and eyelets,
ivory/light-gray side panel with existing oval monogram and existing small
SAMBA lettering, white heel patch, and white stitched cup sole with its
existing AIR marking. Keep the EXACT marks and panel layout visible in the
source, no new logos or redesign.

**Onyx:** Subject: The Metro Court Onyx sneaker. Extract the FRONT black
sneaker from source image 1. Preserve deep black smooth upper and suede toe
overlays, black flat laces and eyelets, white/ivory side panel with existing
oval monogram and existing small SAMBA lettering, white heel patch, white
stitched cup sole with existing AIR marking. Keep EXACT existing marks, shape
and panel layout.

**Regent:** Subject: The Regent Bit Black formal loafer, source image 1.
Preserve the glossy black toe and outer leather sidewalls, almond toe shape,
finely horizontally ribbed vamp, shiny black strap with polished dark/silver
horsebit bar and round rings, slim black sole and low formal heel. Keep THIS
shoe's precise hardware, proportions and ribbed panel; do not turn it into the
chunkier loafer from the reference.

## Applying the covers

`server/studio-cover-refresh.mjs` applies the changes once during either
database adapter's existing startup transaction, after listing seeds. Only the
five exact original cover URLs are eligible. It prepends each new first photo
and retains every original gallery URL, price, size, stock and product ID.
Later owner-uploaded covers take precedence. Collection cards, quick views
and product pages all use the updated product data.

## Validation

Production build and smoke checks pass. Both new migration integration tests
pass against SQLite and embedded Postgres, including original-gallery retention,
unchanged prices/inventory and later administrator-cover protection. Existing
cover, sneaker and Regent tests also pass. The complete suite has 82 passes
and 12 failures; those same 12 failures were reproduced on the unchanged
`135c320` baseline (old catalog-count, inventory and order expectations).
The pre-existing malformed JSX closing delimiter in `src/Pages.tsx` was corrected
so the production build can deploy.
