# Complete studio covers and gallery cleanup

Owner-requested follow-up on 23 October 2026. All eleven collection styles and the Coffee Brown color variant now use single-shoe first photographs. The approved first two cutouts and the existing olive/chocolate cutouts were reused. The built-in ImageGen editor produced three additional transparent covers and two cleaned gallery photographs. No CLI/API generation fallback was used.

| Product | First-photo asset |
| --- | --- |
| The Suede Penny | `public/products/hero-loafer.png` (existing approved asset) |
| The Textured Bit | `public/products/hero-textured.png` (existing approved asset) |
| Olive Suede Penny Loafer | `public/products/olive-cover-studio-v1.webp` (copy of approved `hero-olive-v1.webp`) |
| Black Suede Penny Loafer | `public/products/black-suede-cover-studio-v1.webp` |
| Brown Suede Penny Loafer | `public/products/chocolate-cover-studio-v1.webp` (copy of approved `hero-chocolate-v1.webp`) |
| Glossy Black Formal Horsebit Loafer | `public/products/glossy-cover-studio-v1.webp` |
| The Textured Bit — Coffee | `public/products/coffee-cover-studio-v1.webp` |

The five covers from the preceding update remain unchanged. Gallery edits are saved as `public/products/taupe-gallery-clean-v1.webp` and `public/products/midnight-gallery-clean-v1.webp`. They replace the exact two photographs containing a hand or fingers; original sources remain recoverable in the repository. All other gallery angles are retained. An accidentally attached storefront screenshot was removed from the Coffee Brown gallery by its exact URL, without deleting its original file.

New covers are 1536 × 1024 with genuine transparency. New gallery photographs are portrait 4:5 on a neutral studio background. WebP quality is 91; cover alpha quality is 100.

Coffee Brown's original photo was reuploaded during the update. The new upload
was verified byte-for-byte with SHA-256 against the edited source before its
exact URL was added to migration revision v2. Other later owner uploads remain
protected.

`server/catalog-photo-completion.mjs` applies changes once inside both database adapters' existing startup transactions. Matching is restricted to exact product IDs and original image URLs; later owner uploads win. Prices, inventory, descriptions, order/customer data and product identities are preserved.

## Final ImageGen prompts

Validation: all six targeted photo-migration tests pass, including real SQLite
and embedded Postgres startup, later-owner-cover protection and gallery cleanup.
Production build and smoke routes pass. Each new WebP was fully decoded and
checked for expected dimensions and cover transparency before publication.

### black-suede

Use case: precise-object-edit. Asset: first product photograph for Qadam Flex online store. Image 1 is the edit target; any additional product photograph shows the same product's details. The LAST image is only a composition reference: match the single-shoe clean catalogue composition of its two SNEAKER cards at the bottom, without copying their design. Create ONE complete shoe, heel left, toe pointing right, low outside three-quarter view with a little top visible, approximately level sole. Center it in a landscape 3:2 canvas with at least 5% transparent margins, full shoe visible and about 88% canvas width. Photorealistic neutral studio lighting, crisp natural material texture. Genuinely TRANSPARENT background including below the shoe. No floor, pedestal, cast shadow or glow; website supplies its own neutral background and soft shadow. Preserve the exact source shoe design, color, proportions, toe shape, stitching, hardware, sole and existing visible marks. Do not redesign. Remove background, other shoe, tags, props, supports and packaging. No new logos, caption, UI, watermark or border. Subject: Front black suede penny loafer from image 1. Very dark black suede, tan/cognac lining, brown stacked heel and thin brown outsole, matching black moccasin stitching and simple penny strap, no metal hardware. Distinct from the navy Midnight loafer; keep THIS product's brown stacked heel construction.

### glossy

Use case: precise-object-edit. Asset: first product photograph for Qadam Flex online store. Image 1 is the edit target; any additional product photograph shows the same product's details. The LAST image is only a composition reference: match the single-shoe clean catalogue composition of its two SNEAKER cards at the bottom, without copying their design. Create ONE complete shoe, heel left, toe pointing right, low outside three-quarter view with a little top visible, approximately level sole. Center it in a landscape 3:2 canvas with at least 5% transparent margins, full shoe visible and about 88% canvas width. Photorealistic neutral studio lighting, crisp natural material texture. Genuinely TRANSPARENT background including below the shoe. No floor, pedestal, cast shadow or glow; website supplies its own neutral background and soft shadow. Preserve the exact source shoe design, color, proportions, toe shape, stitching, hardware, sole and existing visible marks. Do not redesign. Remove background, other shoe, tags, props, supports and packaging. No new logos, caption, UI, watermark or border. Subject: Glossy Black Formal Horsebit Loafer from image 1. Preserve polished patent black outer walls and toe, fine crosshatched/textured black vamp, shiny rounded dark-metal bit hardware with central textured bar, almond toe, black stacked low heel and thin black formal sole. Repose slightly into the same low three-quarter catalogue view while preserving the precise source hardware and textured vamp.

### coffee

Use case: precise-object-edit. Asset: first product photograph for Qadam Flex online store. Image 1 is the edit target; any additional product photograph shows the same product's details. The LAST image is only a composition reference: match the single-shoe clean catalogue composition of its two SNEAKER cards at the bottom, without copying their design. Create ONE complete shoe, heel left, toe pointing right, low outside three-quarter view with a little top visible, approximately level sole. Center it in a landscape 3:2 canvas with at least 5% transparent margins, full shoe visible and about 88% canvas width. Photorealistic neutral studio lighting, crisp natural material texture. Genuinely TRANSPARENT background including below the shoe. No floor, pedestal, cast shadow or glow; website supplies its own neutral background and soft shadow. Preserve the exact source shoe design, color, proportions, toe shape, stitching, hardware, sole and existing visible marks. Do not redesign. Remove background, other shoe, tags, props, supports and packaging. No new logos, caption, UI, watermark or border. Subject: Coffee Brown color variant of the embossed Textured Bit loafer, source images 1 and 2. Preserve its very dark reddish coffee/chocolate-brown woven/checker embossed leather texture, black lugged outsole, chunky silhouette, stitched moccasin toe, shiny dark metallic strap with the exact geometric linked monogram-shaped hardware in the source. Neutral exposure revealing the deep coffee-brown color without making it black or tan. Source has existing geometric marks: preserve those only.

### taupe-gallery-clean

Use case: precise-object-edit. Asset: ecommerce gallery product photograph. Image 1 is the edit target. Remove ALL human hands/fingers/arms and the improvised shop background, wires, cardboard, lights and supports. Retouch professionally with balanced studio lighting and a seamless neutral warm light-gray backdrop with a subtle contact shadow. Preserve the exact source shoe's design, material, color, silhouette, stitching, strap, sole, lining, scale and perspective. Do not redesign or add hardware or new branding. Keep product sharp, natural and completely in frame with modest breathing room; use a portrait 4:5 crop. No people or body parts, no new text, no watermark. There are TWO taupe-brown suede penny loafers in the source: front shoe faces camera/toe down, rear shoe behind points down-right. Preserve both shoes and their original arrangement. Remove the dark intrusive hand/fingers in the lower foreground entirely and all surrounding shop clutter. Preserve the pair's warm taupe suede, simple penny straps, tan linings and gum tan soles. Replace only non-product elements and improve photographic clarity.

### midnight-gallery-clean

Use case: precise-object-edit. Asset: ecommerce gallery product photograph. Image 1 is the edit target. Remove ALL human hands/fingers/arms and the improvised shop background, wires, cardboard, lights and supports. Retouch professionally with balanced studio lighting and a seamless neutral warm light-gray backdrop with a subtle contact shadow. Preserve the exact source shoe's design, material, color, silhouette, stitching, strap, sole, lining, scale and perspective. Do not redesign or add hardware or new branding. Keep product sharp, natural and completely in frame with modest breathing room; use a portrait 4:5 crop. No people or body parts, no new text, no watermark. Keep only the ONE dark midnight navy penny loafer held in the hand in the center of image 1; remove the holding hand/arm and every other shoe, clamp and shop item. Preserve this shoe's original elevated three-quarter angle, heel upper left and toe lower right, simple penny strap, fine navy textile/suede-like texture, tan lining and honey gum thin sole. Present the complete same shoe in that angle naturally against the clean studio background, with no hand or support.

