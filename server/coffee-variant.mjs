// Ensure Coffee Brown is a color SKU of The Textured Bit.
// The original brown placeholder may be absent from an existing production DB.
// Preserve any owner-edited price, stock, size quantities and product ID.
import { initialProducts } from "./catalog.mjs";
export const revision = "owner-textured-bit-coffee-reconcile-2026-10-22-v2";
const id = "brown-textured";
export function updateCoffee(existing) {
  const template = initialProducts.find(p => p.id === id);
  if (!template) throw new Error("Coffee variant definition missing");
  if (!existing) {
    return {...template, stockBySize: Object.fromEntries(template.sizes.map(s => [s, null]))};
  }
  return {...existing,
    name: template.name, subtitle: template.subtitle,
    slug: template.slug, color: template.color, swatch: template.swatch,
    variantOf: "textured-bit", category: template.category,
    published: true, featured: false,
    image: template.image, images: [...template.images],
    imagePosition: template.imagePosition,
    description: template.description, details: [...template.details]
  };
}
export function sqliteCoffee(db) {
  if (db.prepare("SELECT id FROM migrations WHERE id=?").get(revision)) return;
  const row = db.prepare("SELECT data FROM products WHERE id=?").get(id);
  const result = updateCoffee(row ? JSON.parse(row.data) : null);
  db.prepare("INSERT INTO products(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
    .run(id, JSON.stringify(result));
  db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(revision,new Date().toISOString());
}
export async function postgresCoffee(store) {
  if (await store.db.prepare("SELECT id FROM migrations WHERE id=?").get(revision)) return;
  const previous = await store.product(id);
  await store.saveProduct(updateCoffee(previous));
  await store.db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(revision,new Date().toISOString());
}
