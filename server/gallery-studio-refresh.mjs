import { refreshedGallery } from "./catalog-gallery-refresh.mjs";

// Owner-requested cleanup of every remaining rough interior product photograph.
// Exact URL replacements preserve approved covers, other angles and later uploads.
export const studioGalleryRevision = "owner-all-interior-photos-2026-10-23-v3";
export const studioGalleryRefreshes = [
  [
    "suede-penny",
    [
      [
        "/products/brown-suede.jpg",
        "/products/suede-penny-gallery-1-studio-v3.webp",
      ],
    ],
  ],
  [
    "textured-bit",
    [
      [
        "/products/black-textured.jpg",
        "/products/textured-bit-gallery-1-studio-v3.webp",
      ],
      [
        "/products/upload-152e21b0-db0f-4351-84af-eec14f258a0c.jpg",
        "/products/textured-bit-gallery-2-studio-v3.webp",
      ],
      [
        "/products/upload-56df63fb-8024-4f60-8fe9-e967b76e2c25.jpg",
        "/products/textured-bit-gallery-3-studio-v3.webp",
      ],
      [
        "/products/upload-125ad1ed-d75a-4706-8a65-e0f31ab0a930.jpg",
        "/products/textured-bit-gallery-4-studio-v3.webp",
      ],
      [
        "/products/upload-df3340b2-4f60-4365-ad70-82e72ba050ac.jpg",
        "/products/textured-bit-gallery-5-studio-v3.webp",
      ],
    ],
  ],
  [
    "evening-bit",
    [
      [
        "/products/black-formal.jpg",
        "/products/evening-bit-gallery-1-studio-v3.webp",
      ],
    ],
  ],
  [
    "midnight-penny",
    [
      [
        "/products/dark-suede.jpg",
        "/products/midnight-penny-gallery-1-studio-v3.webp",
      ],
    ],
  ],
  [
    "brown-textured",
    [
      [
        "/products/upload-80beb481-b430-4103-aaa8-8a6fa79d040f.jpg",
        "/products/brown-textured-gallery-1-studio-v3.webp",
      ],
      [
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/f535888a-86a4-47f6-989f-eb95d33073a0.jpg",
        "/products/brown-textured-gallery-1-studio-v3.webp",
      ],
      [
        "/products/upload-8b71ff9d-e719-4fea-857f-77fb13fc094a.jpg",
        "/products/brown-textured-gallery-2-studio-v3.webp",
      ],
      [
        "/products/upload-96b03a6b-92c7-4c79-b28f-11c0a680c42a.jpg",
        "/products/brown-textured-gallery-3-studio-v3.webp",
      ],
      [
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/e554b54e-ccf0-4bfd-badd-d295de6499b1.jpg",
        "/products/brown-textured-gallery-3-studio-v3.webp",
      ],
      [
        "/products/upload-cdec06fb-ac6d-4bc4-921c-bb9f64735a1b.jpg",
        "/products/brown-textured-gallery-4-studio-v3.webp",
      ],
      [
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/563da6f1-866b-4719-9f27-f02fb9c21340.jpg",
        "/products/brown-textured-gallery-4-studio-v3.webp",
      ],
    ],
  ],
  [
    "metro-court-mocha",
    [
      [
        "/products/qf-mocha-1.webp",
        "/products/metro-court-mocha-gallery-1-studio-v3.webp",
      ],
      [
        "/products/qf-mocha-2.webp",
        "/products/metro-court-mocha-gallery-2-studio-v3.webp",
      ],
      [
        "/products/qf-mocha-3.webp",
        "/products/metro-court-mocha-gallery-3-studio-v3.webp",
      ],
      [
        "/products/qf-mocha-4.webp",
        "/products/metro-court-mocha-gallery-4-studio-v3.webp",
      ],
    ],
  ],
  [
    "metro-court-onyx",
    [
      [
        "/products/qf-onyx-1.webp",
        "/products/metro-court-onyx-gallery-1-studio-v3.webp",
      ],
      [
        "/products/qf-onyx-2.webp",
        "/products/metro-court-onyx-gallery-2-studio-v3.webp",
      ],
      [
        "/products/qf-onyx-3.webp",
        "/products/metro-court-onyx-gallery-3-studio-v3.webp",
      ],
      [
        "/products/qf-onyx-4.webp",
        "/products/metro-court-onyx-gallery-4-studio-v3.webp",
      ],
    ],
  ],
  [
    "regent-bit-black-2026",
    [
      [
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/c9fe1009-d647-489a-ad35-9ade717fc6e7.jpg",
        "/products/regent-bit-black-2026-gallery-1-studio-v3.webp",
      ],
      [
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/beecd970-13e8-4124-9710-5f01b4416875.jpg",
        "/products/regent-bit-black-2026-gallery-2-studio-v3.webp",
      ],
      [
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/15ccfd25-2090-416a-a18b-08b173100fac.jpg",
        "/products/regent-bit-black-2026-gallery-3-studio-v3.webp",
      ],
      [
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/ca35a0ca-810d-42a5-b779-95c3e4d65b6a.jpg",
        "/products/regent-bit-black-2026-gallery-4-studio-v3.webp",
      ],
    ],
  ],
];

export function refreshedStudioGallery(product) {
  const match = studioGalleryRefreshes.find(([id]) => id === product?.id);
  return match ? refreshedGallery(product, match[1]) : product;
}

// Both adapters call these inside the existing startup transaction.
export function refreshStudioGalleriesSqlite(db) {
  if (
    db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(studioGalleryRevision)
  )
    return;
  for (const [id] of studioGalleryRefreshes) {
    const row = db.prepare("SELECT data FROM products WHERE id=?").get(id);
    if (!row) continue;
    const before = JSON.parse(row.data);
    const after = refreshedStudioGallery(before);
    if (after !== before)
      db.prepare("UPDATE products SET data=? WHERE id=?").run(
        JSON.stringify(after),
        id,
      );
  }
  db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)").run(
    studioGalleryRevision,
    new Date().toISOString(),
  );
}

export async function refreshStudioGalleriesPostgres(store) {
  if (
    await store.db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(studioGalleryRevision)
  )
    return;
  for (const [id] of studioGalleryRefreshes) {
    const before = await store.product(id);
    const after = refreshedStudioGallery(before);
    if (after !== before) await store.saveProduct(after);
  }
  await store.db
    .prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(studioGalleryRevision, new Date().toISOString());
}
