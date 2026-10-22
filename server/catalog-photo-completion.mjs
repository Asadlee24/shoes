// Complete the owner's studio covers and remove hand-held gallery distractions.
// Exact URL matching protects every later administrator upload.
export const photoCompletionRevision =
  "owner-complete-studio-photos-2026-10-23-v2";
// This upload is byte-identical to the original Coffee Brown source photograph.
// SHA-256: 298bd92c1273c319dbb60eec58381b4fe273e17f6d7c3144452908957481ac20
export const copiedCoffeeOriginal =
  "/products/upload-80beb481-b430-4103-aaa8-8a6fa79d040f.jpg";
const uploads =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/";
export const completedCovers = [
  ["suede-penny", "/products/brown-suede.jpg", "/products/hero-loafer.png"],
  [
    "textured-bit",
    "/products/black-textured.jpg",
    "/products/hero-textured.png",
  ],
  [
    "brown-textured",
    `${uploads}f535888a-86a4-47f6-989f-eb95d33073a0.jpg`,
    "/products/coffee-cover-studio-v1.webp",
  ],
  [
    "product-1b0c8d9f",
    "/products/olive-loafer-studio-v1.webp",
    "/products/olive-cover-studio-v1.webp",
  ],
  [
    "product-4138da06",
    "/products/black-loafer-studio-v1.webp",
    "/products/black-suede-cover-studio-v1.webp",
  ],
  [
    "product-869254ac",
    "/products/brown-loafer-studio-v1.webp",
    "/products/chocolate-cover-studio-v1.webp",
  ],
  [
    "product-fa88ca40",
    "/products/glossy-loafer-studio-v1.webp",
    "/products/glossy-cover-studio-v1.webp",
  ],
];
export const cleanedGalleryPhotos = [
  [
    "suede-penny",
    "/products/brown-suede-alternate.jpg",
    "/products/taupe-gallery-clean-v1.webp",
  ],
  [
    "midnight-penny",
    "/products/dark-suede-alternate.jpg",
    "/products/midnight-gallery-clean-v1.webp",
  ],
];
// An accidentally attached storefront screenshot is not a product photograph.
export const coffeeScreenshot = `${uploads}3e56fb67-8bf6-48d5-b222-a0c0d9e7573d.jpg`;
const productIds = [
  ...new Set([...completedCovers, ...cleanedGalleryPhotos].map(([id]) => id)),
];

export function completedProductPhotos(product) {
  if (!product) return product;
  let result = product;
  const cover = completedCovers.find(
    ([id, original]) =>
      product.id === id &&
      (product.image === original ||
        (id === "brown-textured" && product.image === copiedCoffeeOriginal)),
  );
  if (cover) {
    const [, , replacement] = cover;
    const original = product.image;
    result = {
      ...result,
      image: replacement,
      imagePosition: "50% 50%",
      images: [...new Set([replacement, original, ...(result.images || [])])],
    };
  }
  if (Array.isArray(result.images)) {
    const replacements = new Map(
      cleanedGalleryPhotos
        .filter(([id]) => id === result.id)
        .map(([, from, to]) => [from, to]),
    );
    const images = [
      ...new Set(
        result.images
          .filter(
            (url) => result.id !== "brown-textured" || url !== coffeeScreenshot,
          )
          .map((url) => replacements.get(url) || url),
      ),
    ];
    if (JSON.stringify(images) !== JSON.stringify(result.images))
      result = { ...result, images };
  }
  return result;
}

// Called inside each adapter's existing startup transaction, after listing seeds.
export function completeProductPhotosSqlite(db) {
  if (
    db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(photoCompletionRevision)
  )
    return;
  for (const id of productIds) {
    const row = db.prepare("SELECT data FROM products WHERE id=?").get(id);
    if (!row) continue;
    const before = JSON.parse(row.data);
    const after = completedProductPhotos(before);
    if (after !== before)
      db.prepare("UPDATE products SET data=? WHERE id=?").run(
        JSON.stringify(after),
        id,
      );
  }
  db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)").run(
    photoCompletionRevision,
    new Date().toISOString(),
  );
}

export async function completeProductPhotosPostgres(store) {
  if (
    await store.db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(photoCompletionRevision)
  )
    return;
  for (const id of productIds) {
    const before = await store.product(id);
    const after = completedProductPhotos(before);
    if (after !== before) await store.saveProduct(after);
  }
  await store.db
    .prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(photoCompletionRevision, new Date().toISOString());
}
