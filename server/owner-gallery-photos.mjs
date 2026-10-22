// Qadam Flex: new photography supplied by store owner; existing product SKUs and prices unchanged.

export const ownerNewGalleryRevision = "owner-new-shoe-angles-2026-10-22-v1";
export const ownerNewGalleryPhotos = {
  "textured-bit": [
    "/products/texture-pair-qf-2026.jpg",
    "/products/texture-alt-qf-2026.jpg",
    "/products/texture-angle-qf-2026.jpg",
  ],
  "evening-bit": [
    "/products/formal-pair-qf-2026.jpg",
    "/products/formal-angle-qf-2026.jpg",
    "/products/formal-side-qf-2026.jpg",
  ],
};

// Enrich existing products, never create a second listing or replace an owner-selected cover.
// A one-time migration preserves owner-admin adjustments to prices and inventory.
export async function addOwnerGalleryPhotos(store) {
  if (await store.db.prepare("SELECT id FROM migrations WHERE id=?").get(ownerNewGalleryRevision)) return;
  for (const [id, additions] of Object.entries(ownerNewGalleryPhotos)) {
    const current = await store.product(id);
    if (!current) continue;
    const images = [...new Set([...(current.images || []), ...additions])];
    if (images.length !== (current.images || []).length)
      await store.saveProduct({ ...current, images });
  }
  await store.db.prepare("INSERT INTO migrations VALUES(?,?)").run(ownerNewGalleryRevision, new Date().toISOString());
}
