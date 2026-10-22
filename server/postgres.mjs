import { archiveOwnerTestRequests } from "./test-order-cleanup.mjs";
import { refreshCatalogCovers } from "./catalog-photo-refresh.mjs";
import { refreshCatalogGalleries } from "./catalog-gallery-refresh.mjs";
import { rollbackMistakenPhotosStore } from "./owner-gallery-rollback.mjs";
import { seedSneakersPostgres } from "./sneaker-listings.mjs";
import { seedRegentPostgres } from "./regent-loafer-listing.mjs";
import { commerceSchema } from "./commerce-schema.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
import { ownerStock, ownerStockRevision } from "./inventory.mjs";
import { createHash } from "node:crypto";
import {
  initialProducts,
  initialSettings,
  ownerFreeDeliveryRevision,
  ownerNotificationRevision,
} from "./catalog.mjs";
import { HttpError } from "./store.mjs";

const context = new AsyncLocalStorage();
const writeLock = 814202610;
const tables =
  /\b(products|settings|requests|sessions|migrations|customers|customer_sessions|customer_orders|payment_proofs|email_outbox|customer_email_verifications|customer_email_tokens|reviews|review_photos|stock_alert_state)\b/g;

// Only internally defined SQL passes through this adapter; values stay bound.
export function postgresSql(sql) {
  let parameter = 0;
  return sql.replace(tables, "qf_$1").replace(/\?/g, () => `$${++parameter}`);
}

async function neonPool(connectionString) {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { default: WebSocket } = await import("ws");
  neonConfig.webSocketConstructor = WebSocket;
  return new Pool({ connectionString, max: 3, connectionTimeoutMillis: 15000 });
}

export async function openPostgresStore(options = {}) {
  const connectionString = options.connectionString || process.env.DATABASE_URL;
  if (!connectionString && !options.poolFactory)
    throw new HttpError(
      503,
      "Connect the store database in Vercel Storage first.",
    );
  const poolFactory = options.poolFactory || (() => neonPool(connectionString));

  // Neon WebSocket pools are scoped to each invocation, never shared between
  // serverless invocations. AsyncLocalStorage keeps concurrent requests separate.
  async function standalone(sql, values = []) {
    const pool = await poolFactory();
    try {
      return await pool.query(sql, values);
    } finally {
      await pool.end();
    }
  }
  async function query(sql, values = []) {
    const current = context.getStore();
    return current?.owner === store
      ? current.client.query(sql, values)
      : standalone(sql, values);
  }
  const store = {
    db: {
      prepare(sql) {
        const text = postgresSql(sql);
        return {
          get: async (...args) => (await query(text, args)).rows[0],
          all: async (...args) => (await query(text, args)).rows,
          run: async (...args) => query(text, args),
        };
      },
      async exec(sql) {
        const current = context.getStore();
        if (current?.owner !== store || !current.writing)
          throw new Error("A write transaction is required.");
        if (sql === "BEGIN IMMEDIATE") {
          await current.client.query("SAVEPOINT qf_api_write");
        } else if (sql === "COMMIT") {
          await current.client.query("RELEASE SAVEPOINT qf_api_write");
        } else if (sql === "ROLLBACK") {
          await current.client.query("ROLLBACK TO SAVEPOINT qf_api_write");
          await current.client.query("RELEASE SAVEPOINT qf_api_write");
        } else throw new Error("Unsupported transaction command.");
      },
      close() {},
    },
    async products() {
      return (
        await query("SELECT data FROM qf_products ORDER BY sort_order")
      ).rows.map((row) => JSON.parse(row.data));
    },
    async product(id) {
      const row = (
        await query("SELECT data FROM qf_products WHERE id=$1", [id])
      ).rows[0];
      return row ? JSON.parse(row.data) : null;
    },
    async settings() {
      return JSON.parse(
        (await query("SELECT data FROM qf_settings WHERE id=1")).rows[0].data,
      );
    },
    async saveProduct(product) {
      await query(
        "INSERT INTO qf_products(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        [product.id, JSON.stringify(product)],
      );
    },
    async saveSettings(settings) {
      await query("UPDATE qf_settings SET data=$1 WHERE id=1", [
        JSON.stringify(settings),
      ]);
    },
    async saveMedia(name, type, data) {
      await query("INSERT INTO qf_media(name,type,data) VALUES($1,$2,$3)", [
        name,
        type,
        data,
      ]);
    },
    async media(name) {
      return (
        await query("SELECT type,data FROM qf_media WHERE name=$1", [name])
      ).rows[0];
    },
    async limit(group, key, maximum, minutes) {
      const id = createHash("sha256").update(`${group}:${key}`).digest("hex");
      const now = Date.now();
      // Separate autocommit connection: failed login transactions must not undo
      // rate-limit increments. The UPSERT is atomic across all function instances.
      const result = await standalone(
        `INSERT INTO qf_limits(id,count,until_ms) VALUES($1,1,$2)
        ON CONFLICT(id) DO UPDATE SET
          count=CASE WHEN qf_limits.until_ms <= $3 THEN 1 ELSE qf_limits.count+1 END,
          until_ms=CASE WHEN qf_limits.until_ms <= $3 THEN excluded.until_ms ELSE qf_limits.until_ms END
        RETURNING count`,
        [id, now + minutes * 60000, now],
      );
      if (result.rows[0].count > maximum)
        throw new HttpError(429, "Please wait a little before trying again.");
    },
    async resetLimit(group, key) {
      const id = createHash("sha256").update(`${group}:${key}`).digest("hex");
      await standalone("DELETE FROM qf_limits WHERE id=$1", [id]);
    },
    async withRequest(writing, callback) {
      const pool = await poolFactory();
      let client;
      try {
        client = await pool.connect();
        if (writing) {
          await client.query("BEGIN");
          await client.query("SET LOCAL lock_timeout = '15s'");
          await client.query("SET LOCAL statement_timeout = '20s'");
          // Lock before reading product stock, status or idempotency keys. This
          // serializes stock edits/orders/cancellations, preventing overselling
          // and restoring cancelled stock only once across serverless instances.
          await client.query("SELECT pg_advisory_xact_lock($1)", [writeLock]);
        }
        const result = await context.run(
          { owner: store, client, writing },
          callback,
        );
        if (writing) await client.query("COMMIT");
        return result;
      } catch (error) {
        if (client && writing) await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client?.release();
        await pool.end();
      }
    },
  };

  await store.withRequest(true, async () => {
    await query(commerceSchema("qf_", "BYTEA"));
    await query(`CREATE TABLE IF NOT EXISTS qf_products(id TEXT PRIMARY KEY,data TEXT NOT NULL,sort_order BIGSERIAL);
      CREATE TABLE IF NOT EXISTS qf_settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS qf_requests(id TEXT PRIMARY KEY,idempotency TEXT UNIQUE NOT NULL,fingerprint TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS qf_sessions(token TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS qf_media(name TEXT PRIMARY KEY,type TEXT NOT NULL,data BYTEA NOT NULL);
      CREATE TABLE IF NOT EXISTS qf_migrations(id TEXT PRIMARY KEY,applied TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS qf_limits(id TEXT PRIMARY KEY,count INTEGER NOT NULL,until_ms BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS qf_email_outbox(id TEXT PRIMARY KEY,event TEXT NOT NULL,request_id TEXT NOT NULL,recipient TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL,next_attempt BIGINT NOT NULL,first_attempt BIGINT NOT NULL,created TEXT NOT NULL,provider_id TEXT NOT NULL,last_error TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS qf_email_outbox_ready ON qf_email_outbox(status,next_attempt);

 CREATE TABLE IF NOT EXISTS qf_customers(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,password_hash TEXT NOT NULL,recovery_hash TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS qf_customer_sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES qf_customers(id),csrf TEXT NOT NULL,expires BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS qf_customer_orders(request_id TEXT PRIMARY KEY REFERENCES qf_requests(id),user_id TEXT NOT NULL REFERENCES qf_customers(id));
 CREATE TABLE IF NOT EXISTS qf_payment_proofs(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES qf_requests(id),user_id TEXT NOT NULL REFERENCES qf_customers(id),type TEXT NOT NULL,data BYTEA NOT NULL,reference TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL,reviewed TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS qf_customer_orders_user ON qf_customer_orders(user_id);
 CREATE INDEX IF NOT EXISTS qf_customer_sessions_expires ON qf_customer_sessions(expires);
 CREATE INDEX IF NOT EXISTS qf_payment_proofs_request ON qf_payment_proofs(request_id);
      CREATE INDEX IF NOT EXISTS qf_requests_created ON qf_requests(created DESC);
      CREATE INDEX IF NOT EXISTS qf_sessions_expires ON qf_sessions(expires);`);
    const seeded = await query(
      "INSERT INTO qf_settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING RETURNING id",
      [
        JSON.stringify({
          ...initialSettings,
          orderNotificationEmail: process.env.ORDER_NOTIFICATION_EMAIL || "",
        }),
      ],
    );
    if (seeded.rows.length) {
      for (const product of initialProducts)
        await store.saveProduct({
          ...product,
          stockBySize: Object.fromEntries(
            product.sizes.map((size) => [size, null]),
          ),
        });
    }
    const stockUpdate = await query(
      "INSERT INTO qf_migrations(id,applied) VALUES($1,$2) ON CONFLICT(id) DO NOTHING RETURNING id",
      [ownerStockRevision, new Date().toISOString()],
    );
    if (stockUpdate.rows.length) {
      for (const product of await store.products())
        await store.saveProduct(ownerStock(product));
    }
    const deliveryUpdate = await query(
      "INSERT INTO qf_migrations(id,applied) VALUES($1,$2) ON CONFLICT(id) DO NOTHING RETURNING id",
      [ownerFreeDeliveryRevision, new Date().toISOString()],
    );
    if (deliveryUpdate.rows.length)
      await store.saveSettings({ ...(await store.settings()), shippingFee: 0 });
    const notificationUpdate = await query(
      "INSERT INTO qf_migrations(id,applied) VALUES($1,$2) ON CONFLICT(id) DO NOTHING RETURNING id",
      [ownerNotificationRevision, new Date().toISOString()],
    );
    if (notificationUpdate.rows.length)
      await store.saveSettings({
        ...(await store.settings()),
        orderNotificationEmail: initialSettings.orderNotificationEmail,
      });
    await archiveOwnerTestRequests(store);
    await refreshCatalogCovers(store);
    await refreshCatalogGalleries(store);
    await rollbackMistakenPhotosStore(store);
    await seedSneakersPostgres(store);
    await seedRegentPostgres(store);
    await query("DELETE FROM qf_sessions WHERE expires < $1", [Date.now()]);
    await query("DELETE FROM qf_limits WHERE until_ms < $1", [Date.now()]);
  });
  return store;
}
