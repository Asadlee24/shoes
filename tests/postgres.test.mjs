import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { openPostgresStore } from "../server/postgres.mjs";
import { createCloudHandler, bufferedResponse } from "../server/vercel.mjs";
import { passwordHash } from "../server/index.mjs";

let database, limits, store, handler, cookie, csrf, order;
let queue = Promise.resolve();
const password = "postgres-test-password-only";
const customer = {
  name: "Database Test",
  phone: "03001234567",
  city: "Peshawar",
  address: "Test address",
};
async function query(db, sql, values = []) {
  const results =
    !values.length && sql.trim().split(";").filter(Boolean).length > 1
      ? await db.exec(sql)
      : [await db.query(sql, values)];
  const result = results.at(-1);
  return {
    ...result,
    rowCount: result.affectedRows ?? result.rows?.length ?? 0,
  };
}
// Embedded Postgres validates real SQL, JSON, bytea and transaction rollback.
// Its one database connection is queued like a pool with max=1. Rate counters
// use a second engine to exercise independent autocommit during failed requests.
async function poolFactory() {
  return {
    query: (sql, values) =>
      query(sql.includes("qf_limits") ? limits : database, sql, values),
    async connect() {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      return { query: (sql, values) => query(database, sql, values), release };
    },
    async end() {},
  };
}
async function request(path, method = "GET", data, extra = {}) {
  const res = bufferedResponse();
  await handler(
    {
      url: path,
      method,
      body: data,
      headers: { host: "store.test", origin: "https://store.test", ...extra },
      socket: { remoteAddress: "test-address" },
    },
    res,
  );
  return {
    status: res.statusCode,
    headers: res.headers,
    raw: res.payload,
    data: String(res.headers["Content-Type"]).includes("json")
      ? JSON.parse(res.payload)
      : res.payload,
  };
}
const admin = () => ({ cookie, "x-csrf-token": csrf });
before(async () => {
  database = new PGlite();
  limits = new PGlite();
  await limits.exec(
    "CREATE TABLE qf_limits(id TEXT PRIMARY KEY,count INTEGER NOT NULL,until_ms BIGINT NOT NULL)",
  );
  store = await openPostgresStore({ poolFactory });
  handler = createCloudHandler({ store, adminHash: passwordHash(password) });
});
after(async () => {
  await database.close();
  await limits.close();
});

test("Postgres schema seeds owner catalog and returns no private settings", async () => {
  const result = await request("/api/catalog");
  assert.equal(result.status, 200);
  assert.equal(result.data.products.length, 4);
  assert.equal("orderNotificationEmail" in result.data.settings, false);
  const health = await request("/api/index?route=health");
  assert.deepEqual(health.data, {
    database: "connected",
    adminConfigured: true,
  });
});

test("cloud admin requires auth, issues Secure cookies and enforces CSRF", async () => {
  assert.equal((await request("/api/admin/dashboard")).status, 401);
  const login = await request("/api/index?route=admin/login", "POST", {
    username: "admin",
    password,
  });
  assert.equal(login.status, 200);
  assert.match(
    login.headers["Set-Cookie"],
    /HttpOnly; SameSite=Strict.*Secure/,
  );
  cookie = login.headers["Set-Cookie"].split(";")[0];
  csrf = login.data.csrf;
  assert.equal(
    (await request("/api/admin/settings", "PUT", {}, { cookie })).status,
    403,
  );
  assert.equal(
    (await request("/api/admin/dashboard", "GET", undefined, admin())).status,
    200,
  );
});

test("admin settings and stock survive reopening the Postgres adapter", async () => {
  const settings = await store.settings();
  const updated = await request(
    "/api/admin/settings",
    "PUT",
    {
      ...settings,
      shippingFee: 20000,
      codEnabled: true,
      orderNotificationEmail: "test@example.com",
    },
    admin(),
  );
  assert.equal(updated.status, 200);
  const product = await store.product("suede-penny");
  product.stockBySize = Object.fromEntries(
    product.sizes.map((size) => [size, 2]),
  );
  assert.equal(
    (
      await request(
        `/api/admin/products/${product.id}`,
        "PUT",
        product,
        admin(),
      )
    ).status,
    200,
  );
  const reopened = await openPostgresStore({ poolFactory });
  assert.equal(
    (await reopened.settings()).orderNotificationEmail,
    "test@example.com",
  );
  assert.equal((await reopened.product(product.id)).stockBySize["7"], 2);
  assert.equal(
    "orderNotificationEmail" in (await request("/api/catalog")).data.settings,
    false,
  );
});

test("cloud orders are idempotent, reserve stock once and reject insufficient stock", async () => {
  const headers = { "idempotency-key": randomUUID() };
  const data = {
    customer,
    items: [{ id: "suede-penny", size: "7", quantity: 1 }],
  };
  const result = await request("/api/requests", "POST", data, headers);
  assert.equal(result.status, 201);
  assert.equal(result.data.kind, "order");
  order = result.data.reference;
  const duplicate = await request("/api/requests", "POST", data, headers);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.reference, order);
  assert.equal((await store.product("suede-penny")).stockBySize["7"], 1);
  const tooMany = await request(
    "/api/requests",
    "POST",
    { ...data, items: [{ ...data.items[0], quantity: 2 }] },
    { "idempotency-key": randomUUID() },
  );
  assert.equal(tooMany.status, 409);
  assert.equal((await store.product("suede-penny")).stockBySize["7"], 1);
});

test("cancelling a Postgres order twice restores size stock only once", async () => {
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await request(
          `/api/admin/requests/${order}`,
          "PATCH",
          { status: "cancelled" },
          admin(),
        )
      ).status,
      200,
    );
  assert.equal((await store.product("suede-penny")).stockBySize["7"], 2);
});

test("cloud product uploads persist verified image bytes and reject disguised files", async () => {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2fQAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await request(
    "/api/admin/upload",
    "POST",
    { type: "image/png", data: bytes.toString("base64") },
    admin(),
  );
  assert.equal(upload.status, 201);
  const name = upload.data.url.split("/").at(-1);
  const image = await request(`/api/index?route=media/${name}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers["Content-Type"], "image/png");
  assert.deepEqual(Buffer.from(image.raw), bytes);
  const forged = await request(
    "/api/admin/upload",
    "POST",
    {
      type: "image/png",
      data: Buffer.from("not actually a PNG image").toString("base64"),
    },
    admin(),
  );
  assert.equal(forged.status, 400);
});

test("failed mutations roll back without recording success or changing products", async () => {
  const before = await store.product("suede-penny");
  await assert.rejects(
    store.withRequest(true, async () => {
      await store.saveProduct({ ...before, price: 100 });
      throw new Error("simulated commit abort");
    }),
  );
  assert.equal((await store.product(before.id)).price, before.price);
});

test("failed cloud logins retain a persistent rate limit across handlers", async () => {
  const headers = { "x-forwarded-for": "limit-test-address" };
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await request(
          "/api/admin/login",
          "POST",
          { username: "admin", password: "wrong" },
          headers,
        )
      ).status,
      401,
    );
  handler = createCloudHandler({ store, adminHash: passwordHash(password) });
  assert.equal(
    (
      await request(
        "/api/admin/login",
        "POST",
        { username: "admin", password: "wrong" },
        headers,
      )
    ).status,
    429,
  );
});

test("cloud logout invalidates the Postgres session", async () => {
  assert.equal(
    (await request("/api/admin/logout", "POST", {}, admin())).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/dashboard", "GET", undefined, admin())).status,
    401,
  );
});
