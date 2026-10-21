// Exact URL replacements only: never replace a later owner upload.
export const galleryRefreshRevision = "catalog-gallery-quality-2026-10-21-v2";
export const galleryRefreshes = [
  [
    "product-1b0c8d9f",
    [
      [
        "/products/upload-15cfa65a-e9b3-4091-9084-a40031221c6d.png",
        "/products/olive-loafer-studio-v1.webp",
      ],
      [
        "/products/upload-9fabc1c8-4892-4f95-934b-0c942e050415.png",
        "/products/olive-loafer-gallery-1-v2.webp",
      ],
      [
        "/products/upload-98008876-19b2-49f7-b321-275232d8c0e8.png",
        "/products/olive-loafer-gallery-2-v2.webp",
      ],
      [
        "/products/upload-eba17acb-9cd7-45cd-8bde-d03aa54d1daf.png",
        "/products/olive-loafer-gallery-3-v2.webp",
      ],
    ],
  ],
  [
    "product-4138da06",
    [
      [
        "/products/upload-000e73f6-67f1-4e43-a9ec-34cd0f5b7381.png",
        "/products/black-loafer-studio-v1.webp",
      ],
      [
        "/products/upload-427f43d0-b0b2-44f8-b4ca-4b083ae41603.png",
        "/products/black-loafer-gallery-1-v2.webp",
      ],
      [
        "/products/upload-d91f4050-f570-4c51-8635-2ac7905f1e4d.png",
        "/products/black-loafer-gallery-1-v2.webp",
      ],
      [
        "/products/upload-9031f8ea-9a67-46a8-ab45-9d0c7476f0f6.png",
        "/products/black-loafer-gallery-3-v2.webp",
      ],
    ],
  ],
  [
    "product-869254ac",
    [
      [
        "/products/upload-2ac4300e-336c-4aea-b97e-0bf95ef47d66.png",
        "/products/brown-loafer-studio-v1.webp",
      ],
      [
        "/products/upload-d2ea2e0f-e04e-4cc6-ac15-05ea34770735.png",
        "/products/brown-loafer-gallery-1-v2.webp",
      ],
      [
        "/products/upload-a2f752f1-2792-47f0-a82e-ee4eff18390a.png",
        "/products/brown-loafer-gallery-2-v2.webp",
      ],
      [
        "/products/upload-98222cd6-d696-4bbc-84d9-b73e3d5daf1c.png",
        "/products/brown-loafer-gallery-3-v2.webp",
      ],
      [
        "/products/upload-924c637a-8a91-4a00-86ca-e1344bf0be34.png",
        "/products/brown-loafer-gallery-4-v2.webp",
      ],
    ],
  ],
  [
    "product-fa88ca40",
    [
      [
        "/products/upload-deb6460d-4c0e-42d9-a7ed-2079742d47b1.png",
        "/products/glossy-loafer-studio-v1.webp",
      ],
      [
        "/products/upload-dea1b131-8510-4241-ae3d-22365942cce6.png",
        "/products/glossy-loafer-gallery-1-v2.webp",
      ],
      [
        "/products/upload-024838f6-aca8-482c-83ff-fb0a445dce6f.png",
        "/products/glossy-loafer-gallery-2-v2.webp",
      ],
      [
        "/products/upload-37d3c6f2-2c05-45c8-9567-d68d912fc23f.png",
        "/products/glossy-loafer-gallery-3-v2.webp",
      ],
    ],
  ],
];

export function refreshedGallery(product, replacements) {
  if (!product || !Array.isArray(product.images)) return product;
  const mapping = new Map(replacements);
  const images = [
    ...new Set(product.images.map((url) => mapping.get(url) || url)),
  ];
  if (JSON.stringify(images) === JSON.stringify(product.images)) return product;
  return { ...product, images };
}

// Call within the existing write transaction. Original uploads remain recoverable
// in media storage; prices, inventory, cover selection and all orders are untouched.
export async function refreshCatalogGalleries(store) {
  if (
    await store.db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(galleryRefreshRevision)
  )
    return;
  for (const [id, replacements] of galleryRefreshes) {
    const product = await store.product(id);
    const refreshed = refreshedGallery(product, replacements);
    if (refreshed !== product) await store.saveProduct(refreshed);
  }
  await store.db
    .prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(galleryRefreshRevision, new Date().toISOString());
}
