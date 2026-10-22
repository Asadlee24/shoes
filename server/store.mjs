import { commerceSchema } from "./commerce-schema.mjs";
import { DatabaseSync } from "node:sqlite";
import { ownerStock, ownerStockRevision } from "./inventory.mjs";
import { rollbackMistakenPhotosSqlite } from "./owner-gallery-rollback.mjs";
import { seedSneakersSqlite } from "./sneaker-listings.mjs";
import { seedRegentSqlite } from "./regent-loafer-listing.mjs";
import { sqliteCoffee } from "./coffee-variant.mjs";
import { refreshStudioCoversSqlite } from "./studio-cover-refresh.mjs";
import { completeProductPhotosSqlite } from "./catalog-photo-completion.mjs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  initialProducts,
  initialSettings,
  confirmedPrices,
  officialDetails,
  ownerFreeDeliveryRevision,
  ownerNotificationRevision,
} from "./catalog.mjs";

export function openStore(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(`CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, idempotency TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS email_outbox(id TEXT PRIMARY KEY,event TEXT NOT NULL,request_id TEXT NOT NULL,recipient TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL,next_attempt BIGINT NOT NULL,first_attempt BIGINT NOT NULL,created TEXT NOT NULL,provider_id TEXT NOT NULL,last_error TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS email_outbox_ready ON email_outbox(status,next_attempt);

 CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,password_hash TEXT NOT NULL,recovery_hash TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS customer_sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES customers(id),csrf TEXT NOT NULL,expires BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS customer_orders(request_id TEXT PRIMARY KEY REFERENCES requests(id),user_id TEXT NOT NULL REFERENCES customers(id));
 CREATE TABLE IF NOT EXISTS payment_proofs(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES requests(id),user_id TEXT NOT NULL REFERENCES customers(id),type TEXT NOT NULL,data BLOB NOT NULL,reference TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL,reviewed TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS customer_orders_user ON customer_orders(user_id);
 CREATE INDEX IF NOT EXISTS customer_sessions_expires ON customer_sessions(expires);
 CREATE INDEX IF NOT EXISTS payment_proofs_request ON payment_proofs(request_id);
 CREATE TABLE IF NOT EXISTS migrations(id TEXT PRIMARY KEY,applied TEXT NOT NULL);`);
  db.exec(commerceSchema());
  if (!db.prepare("SELECT id FROM settings WHERE id=1").get()) {
    db.prepare("INSERT INTO settings VALUES(1,?)").run(
      JSON.stringify(initialSettings),
    );
    for (const p of initialProducts)
      db.prepare("INSERT INTO products VALUES(?,?)").run(
        p.id,
        JSON.stringify({
          ...p,
          stockBySize: Object.fromEntries(p.sizes.map((s) => [s, null])),
        }),
      );
  }
  // Apply the owner's confirmed prices to already-installed, unpriced stores.
  // This runs once and preserves administrator prices, inventory and customer data.
  db.exec("BEGIN IMMEDIATE");
  try {
    const revision = "owner-prices-2026-10-20";
    if (!db.prepare("SELECT id FROM migrations WHERE id=?").get(revision)) {
      const find = db.prepare("SELECT data FROM products WHERE id=?");
      const update = db.prepare("UPDATE products SET data=? WHERE id=?");
      for (const [id, price] of Object.entries(confirmedPrices)) {
        const row = find.get(id);
        if (!row) continue;
        const product = JSON.parse(row.data);
        if (product.price == null) {
          update.run(JSON.stringify({ ...product, price }), id);
        }
      }
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        revision,
        new Date().toISOString(),
      );
    }
    const detailsRevision = "owner-official-details-2026-10-20";
    if (
      !db.prepare("SELECT id FROM migrations WHERE id=?").get(detailsRevision)
    ) {
      const settings = JSON.parse(
        db.prepare("SELECT data FROM settings WHERE id=1").get().data,
      );
      for (const [key, value] of Object.entries(officialDetails))
        if (!settings[key]) settings[key] = value;
      db.prepare("UPDATE settings SET data=? WHERE id=1").run(
        JSON.stringify(settings),
      );
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        detailsRevision,
        new Date().toISOString(),
      );
    }
    const currentSettings = JSON.parse(
      db.prepare("SELECT data FROM settings WHERE id=1").get().data,
    );
    if (typeof currentSettings.orderNotificationEmail !== "string") {
      currentSettings.orderNotificationEmail = "";
      db.prepare("UPDATE settings SET data=? WHERE id=1").run(
        JSON.stringify(currentSettings),
      );
    }
    if (
      !db
        .prepare("SELECT id FROM migrations WHERE id=?")
        .get(ownerFreeDeliveryRevision)
    ) {
      // Owner confirmed free delivery. Apply once; keep later admin fee edits.
      currentSettings.shippingFee = 0;
      db.prepare("UPDATE settings SET data=? WHERE id=1").run(
        JSON.stringify(currentSettings),
      );
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        ownerFreeDeliveryRevision,
        new Date().toISOString(),
      );
    }
    if (
      !db
        .prepare("SELECT id FROM migrations WHERE id=?")
        .get(ownerNotificationRevision)
    ) {
      currentSettings.orderNotificationEmail =
        initialSettings.orderNotificationEmail;
      db.prepare("UPDATE settings SET data=? WHERE id=1").run(
        JSON.stringify(currentSettings),
      );
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        ownerNotificationRevision,
        new Date().toISOString(),
      );
    }
    if (
      !db
        .prepare("SELECT id FROM migrations WHERE id=?")
        .get(ownerStockRevision)
    ) {
      for (const row of db.prepare("SELECT data FROM products").all()) {
        const product = ownerStock(JSON.parse(row.data));
        db.prepare("UPDATE products SET data=? WHERE id=?").run(
          JSON.stringify(product),
          product.id,
        );
      }
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        ownerStockRevision,
        new Date().toISOString(),
      );
    }
    rollbackMistakenPhotosSqlite(db);
    seedSneakersSqlite(db);
    seedRegentSqlite(db);
    sqliteCoffee(db);
    refreshStudioCoversSqlite(db);
    completeProductPhotosSqlite(db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return {
    db,
    products: () =>
      db
        .prepare("SELECT data FROM products ORDER BY rowid")
        .all()
        .map((r) => JSON.parse(r.data)),
    product: (id) => {
      const r = db.prepare("SELECT data FROM products WHERE id=?").get(id);
      return r ? JSON.parse(r.data) : null;
    },
    settings: () =>
      JSON.parse(db.prepare("SELECT data FROM settings WHERE id=1").get().data),
    saveProduct: (p) =>
      db
        .prepare(
          "INSERT INTO products VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        )
        .run(p.id, JSON.stringify(p)),
    saveSettings: (s) =>
      db
        .prepare("UPDATE settings SET data=? WHERE id=1")
        .run(JSON.stringify(s)),
  };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requiredText(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new HttpError(
      400,
      `${label} is required (maximum ${max} characters).`,
    );
  return value.trim();
}
export function validateCustomer(input) {
  const name = requiredText(input.name, "Your name", 80);
  const phone = requiredText(input.phone, "Phone number", 30).replace(
    /[\s()-]/g,
    "",
  );
  if (!/^(?:\+92|0092|92|0)3\d{9}$/.test(phone))
    throw new HttpError(
      400,
      "Please enter a valid Pakistani mobile number, such as 03XX XXXXXXX.",
    );
  const city = requiredText(input.city, "City", 80),
    address = requiredText(input.address, "Delivery address", 500);
  const notes =
    typeof input.notes === "string" ? input.notes.trim().slice(0, 1000) : "";
  return { name, phone, city, address, notes };
}
export async function validateItems(store, input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20)
    throw new HttpError(400, "Choose between 1 and 20 product selections.");
  const items = [];
  const keys = new Set();
  for (const row of input) {
    const p = await store.product(row.id);
    if (!p || !p.published)
      throw new HttpError(400, "One of the selected products is unavailable.");
    if (!p.sizes.includes(String(row.size)))
      throw new HttpError(400, `Choose an available size for ${p.name}.`);
    if (
      !Number.isInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > 10
    )
      throw new HttpError(400, "Quantity must be between 1 and 10.");
    const key = `${p.id}:${row.size}`;
    if (keys.has(key))
      throw new HttpError(400, "Duplicate product selections are not allowed.");
    keys.add(key);
    items.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.image,
      size: String(row.size),
      quantity: row.quantity,
      price: p.price,
      stock: p.stockBySize?.[String(row.size)] ?? null,
    });
  }
  return items;
}
export function totalsFor(items, settings, code = "") {
  const priced = items.every(
    (p) => Number.isSafeInteger(p.price) && p.price > 0,
  );
  if (!priced)
    return {
      subtotal: null,
      shipping: null,
      discount: 0,
      total: null,
      currency: "PKR",
    };
  const subtotal = items.reduce((n, p) => n + p.price * p.quantity, 0);
  if (!Number.isSafeInteger(subtotal))
    throw new HttpError(400, "Order total is too large.");
  let discount = 0;
  if (code) {
    const d = settings.discounts.find(
      (d) => d.active && d.code === code.toUpperCase(),
    );
    if (
      !d ||
      (d.expires && Date.parse(d.expires) < Date.now()) ||
      subtotal < (d?.minimum || 0)
    )
      throw new HttpError(
        400,
        "This discount code is unavailable for your selection.",
      );
    discount =
      d.type === "percent"
        ? Math.round((subtotal * d.value) / 100)
        : Math.min(d.value, subtotal);
  }
  const shipping = settings.shippingFee;
  return {
    subtotal,
    shipping,
    discount,
    total: shipping === null ? null : subtotal - discount + shipping,
    currency: "PKR",
  };
}
export function validateProduct(input, id) {
  const existing = { ...input, id };
  existing.name = requiredText(input.name, "Product name", 100);
  existing.slug = requiredText(input.slug, "Product link", 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(existing.slug))
    throw new HttpError(400, "Use a lowercase, hyphenated product link.");
  if (!["Loafers", "Formal shoes", "Sneakers"].includes(input.category))
    throw new HttpError(400, "Choose a valid collection.");
  existing.color = requiredText(input.color, "Color", 60);
  existing.sizes = Array.isArray(input.sizes)
    ? [...new Set(input.sizes.map(String))].filter((s) =>
        ["7", "8", "9", "10", "11"].includes(s),
      )
    : [];
  if (!existing.sizes.length)
    throw new HttpError(400, "Choose at least one size.");
  if (
    input.price !== null &&
    (!Number.isSafeInteger(input.price) ||
      input.price <= 0 ||
      input.price > 100000000)
  )
    throw new HttpError(400, "Enter a valid positive price or leave it unset.");
  if (
    input.stock !== null &&
    (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 100000)
  )
    throw new HttpError(400, "Enter valid stock or leave it unset.");
  existing.stockBySize = Object.fromEntries(
    existing.sizes.map((s) => {
      const count = input.stockBySize?.[s] ?? null;
      if (
        count !== null &&
        (!Number.isInteger(count) || count < 0 || count > 100000)
      )
        throw new HttpError(
          400,
          "Enter valid stock for each size, or leave it unconfirmed.",
        );
      return [s, count];
    }),
  );
  existing.stock = Object.values(existing.stockBySize).every((n) => n !== null)
    ? Object.values(existing.stockBySize).reduce((a, b) => a + b, 0)
    : null;
  existing.images = (Array.isArray(input.images) ? input.images : [])
    .filter(
      (x) =>
        typeof x === "string" &&
        /^\/products\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(x),
    )
    .slice(0, 12);
  existing.image = existing.images[0] || "";
  existing.published = Boolean(input.published);
  existing.featured = Boolean(input.featured);
  if (existing.published && !existing.image)
    throw new HttpError(400, "Add a product image before publishing.");
  existing.description =
    typeof input.description === "string"
      ? input.description.slice(0, 2000)
      : "";
  existing.details = Array.isArray(input.details)
    ? input.details
        .filter((x) => typeof x === "string")
        .map((x) => x.slice(0, 200))
        .slice(0, 8)
    : [];
  existing.subtitle =
    typeof input.subtitle === "string" ? input.subtitle.slice(0, 120) : "";
  existing.swatch = /^#[\da-f]{6}$/i.test(input.swatch)
    ? input.swatch
    : "#333333";
  existing.imagePosition = /^\d{1,3}% \d{1,3}%$/.test(input.imagePosition)
    ? input.imagePosition
    : "50% 70%";
  return existing;
}
