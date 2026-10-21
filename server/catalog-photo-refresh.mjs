// Match exact original covers so subsequent owner uploads always win.
export const photoRefreshRevision = "catalog-cover-quality-2026-10-21-v1";
export const coverRefreshes = [
  [
    "product-1b0c8d9f",
    "/products/upload-15cfa65a-e9b3-4091-9084-a40031221c6d.png",
    "/products/olive-loafer-studio-v1.webp",
  ],
  [
    "product-4138da06",
    "/products/upload-000e73f6-67f1-4e43-a9ec-34cd0f5b7381.png",
    "/products/black-loafer-studio-v1.webp",
  ],
  [
    "product-869254ac",
    "/products/upload-2ac4300e-336c-4aea-b97e-0bf95ef47d66.png",
    "/products/brown-loafer-studio-v1.webp",
  ],
  [
    "product-fa88ca40",
    "/products/upload-deb6460d-4c0e-42d9-a7ed-2079742d47b1.png",
    "/products/glossy-loafer-studio-v1.webp",
  ],
];

export function refreshedCover(product, original, replacement) {
  if (!product || product.image !== original) return product;
  return {
    ...product,
    image: replacement,
    imagePosition: "50% 50%",
    // Keep original photography available after the enhanced cover.
    images: [replacement, ...new Set([original, ...(product.images || [])])],
  };
}

// Call inside the existing write transaction; all commercial data stays intact.
export async function refreshCatalogCovers(store) {
  if (
    await store.db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(photoRefreshRevision)
  )
    return;
  for (const [id, original, replacement] of coverRefreshes) {
    const product = await store.product(id);
    const refreshed = refreshedCover(product, original, replacement);
    if (refreshed !== product) await store.saveProduct(refreshed);
  }
  await store.db
    .prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(photoRefreshRevision, new Date().toISOString());
}
