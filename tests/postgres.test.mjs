import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { openPostgresStore } from "../server/postgres.mjs";
import { createCloudHandler, bufferedResponse } from "../server/vercel.mjs";
import { passwordHash } from "../server/index.mjs";
import { ownerStockRevision } from "../server/inventory.mjs";
import { createNotifications } from "../server/notifications.mjs";
import {
  ownerFreeDeliveryRevision,
  ownerNotificationRevision,
} from "../server/catalog.mjs";

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
  assert.ok(
    result.data.products.every(
      (product) =>
        product.stock === 20 &&
        Object.values(product.stockBySize).every((count) => count === 4),
    ),
  );
  assert.equal("orderNotificationEmail" in result.data.settings, false);
  assert.equal(result.data.settings.shippingFee, 0);
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

test("cloud customer accounts and private receipts persist across handler and adapter restarts", async () => {
  const signup = await request("/api/account/register", "POST", {
    name: "Cloud Customer",
    email: "cloud@example.test",
    password: "cloud-customer-password-only",
  });
  assert.equal(signup.status, 200);
  assert.match(signup.headers["Set-Cookie"], /Secure/);
  const own = {
    cookie: signup.headers["Set-Cookie"].split(";")[0],
    "x-customer-csrf": signup.data.csrf,
  };
  const placed = await request(
    "/api/requests",
    "POST",
    {
      customer,
      items: [{ id: "suede-penny", size: "7", quantity: 1 }],
      paymentMethod: "bank",
    },
    { ...own, "idempotency-key": randomUUID() },
  );
  assert.equal(placed.status, 201);
  assert.equal(placed.data.kind, "order");
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2fQAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(
    (
      await request(
        `/api/account/orders/${placed.data.reference}/proof`,
        "POST",
        {
          type: "image/png",
          data: bytes.toString("base64"),
          reference: "CLOUD-TEST-TRANSFER",
        },
        own,
      )
    ).status,
    201,
  );
  store = await openPostgresStore({ poolFactory });
  handler = createCloudHandler({ store, adminHash: passwordHash(password) });
  const orders = await request("/api/account/orders", "GET", undefined, own);
  assert.equal(orders.status, 200);
  assert.equal(orders.data.orders.length, 1);
  const payment = orders.data.orders[0].data.payment;
  assert.equal(payment.status, "under_review");
  assert.equal(
    (await request(`/api/account/proofs/${payment.proofId}`)).status,
    401,
  );
  const image = await request(
    `/api/account/proofs/${payment.proofId}`,
    "GET",
    undefined,
    own,
  );
  assert.deepEqual(Buffer.from(image.raw), bytes);
  assert.equal(image.headers["Cache-Control"], "private, no-store");
  const login = await request("/api/admin/login", "POST", {
    username: "admin",
    password,
  });
  const owner = {
    cookie: login.headers["Set-Cookie"].split(";")[0],
    "x-csrf-token": login.data.csrf,
  };
  assert.equal(
    (
      await request(
        `/api/admin/payments/${payment.proofId}`,
        "PATCH",
        { status: "approved" },
        owner,
      )
    ).status,
    200,
  );
  const updated = await request("/api/account/orders", "GET", undefined, own);
  assert.equal(updated.data.orders[0].data.payment.status, "paid");
  const catalog = await request("/api/catalog");
  assert.equal(
    JSON.stringify(catalog.data).includes("cloud@example.test"),
    false,
  );
  assert.equal(JSON.stringify(catalog.data).includes(payment.proofId), false);
});

test("cloud customer rate limits survive rolled-back login failures and fresh handlers", async () => {
  const input = { email: "unknown-cloud@example.test", password: "incorrect" };
  const headers = { "x-forwarded-for": "customer-cloud-rate-address" };
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await request("/api/account/login", "POST", input, headers)).status,
      401,
    );
  handler = createCloudHandler({ store, adminHash: passwordHash(password) });
  assert.equal(
    (await request("/api/account/login", "POST", input, headers)).status,
    429,
  );
});

test("cloud test orders can be archived and restored across adapter restarts without changing stock twice", async () => {
  const login = await request("/api/account/login", "POST", {
    email: "cloud@example.test",
    password: "cloud-customer-password-only",
  });
  const own = {
    cookie: login.headers["Set-Cookie"].split(";")[0],
    "x-customer-csrf": login.data.csrf,
  };
  const adminLogin = await request("/api/admin/login", "POST", {
    username: "admin",
    password,
  });
  const owner = {
    cookie: adminLogin.headers["Set-Cookie"].split(";")[0],
    "x-csrf-token": adminLogin.data.csrf,
  };
  const order = (await request("/api/account/orders", "GET", undefined, own))
    .data.orders[0];
  assert.equal(
    (
      await request(
        `/api/admin/requests/${order.id}`,
        "PATCH",
        { status: "cancelled" },
        owner,
      )
    ).status,
    200,
  );
  const stock = (await store.product("suede-penny")).stockBySize["7"];
  assert.equal(
    (
      await request(
        `/api/admin/requests/${order.id}/archive`,
        "PATCH",
        { archived: true },
        owner,
      )
    ).status,
    200,
  );
  store = await openPostgresStore({ poolFactory });
  handler = createCloudHandler({ store, adminHash: passwordHash(password) });
  assert.equal(
    (await request("/api/account/orders", "GET", undefined, own)).data.orders
      .length,
    0,
  );
  assert.equal((await store.product("suede-penny")).stockBySize["7"], stock);
  assert.equal(
    (
      await request(
        `/api/admin/requests/${order.id}/archive`,
        "PATCH",
        { archived: false },
        owner,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/account/orders", "GET", undefined, own)).data.orders
      .length,
    1,
  );
  assert.equal((await store.product("suede-penny")).stockBySize["7"], stock);
});

test("cloud owner stock migration applies to an existing catalog exactly once and preserves other business data", async () => {
  const countBefore = (
    await store.db.prepare("SELECT COUNT(*) AS count FROM requests").get()
  ).count;
  const settings = await store.settings();
  await store.withRequest(true, async () => {
    const p = await store.product("suede-penny");
    await store.saveProduct({
      ...p,
      price: 399900,
      stock: 1,
      stockBySize: { 7: 1, 8: 0, 9: 0, 10: 0, 11: 0 },
    });
    await store.db
      .prepare("DELETE FROM migrations WHERE id=?")
      .run(ownerStockRevision);
  });
  store = await openPostgresStore({ poolFactory });
  assert.equal((await store.product("suede-penny")).stock, 20);
  assert.equal((await store.product("suede-penny")).price, 399900);
  assert.deepEqual(await store.settings(), settings);
  assert.equal(
    (await store.db.prepare("SELECT COUNT(*) AS count FROM requests").get())
      .count,
    countBefore,
  );
  await store.withRequest(true, async () => {
    const p = await store.product("suede-penny");
    await store.saveProduct({
      ...p,
      stock: 19,
      stockBySize: { ...p.stockBySize, 7: 3 },
    });
  });
  store = await openPostgresStore({ poolFactory });
  assert.equal((await store.product("suede-penny")).stock, 19);
  assert.equal((await store.product("suede-penny")).stockBySize["7"], 3);
});

test("cloud free delivery applies once while preserving inventory, order totals and later fee edits", async () => {
  const settings = { ...(await store.settings()), shippingFee: null };
  const products = await store.products();
  const orders = await store.db
    .prepare("SELECT id,data FROM requests ORDER BY id")
    .all();
  await store.withRequest(true, async () => {
    await store.saveSettings(settings);
    await store.db
      .prepare("DELETE FROM migrations WHERE id=?")
      .run(ownerFreeDeliveryRevision);
  });
  store = await openPostgresStore({ poolFactory });
  assert.deepEqual(await store.settings(), { ...settings, shippingFee: 0 });
  assert.deepEqual(await store.products(), products);
  assert.deepEqual(
    await store.db.prepare("SELECT id,data FROM requests ORDER BY id").all(),
    orders,
  );
  await store.withRequest(true, async () => {
    await store.saveSettings({
      ...(await store.settings()),
      shippingFee: 22500,
    });
  });
  store = await openPostgresStore({ poolFactory });
  assert.equal((await store.settings()).shippingFee, 22500);
  assert.equal(
    (
      await store.db
        .prepare("SELECT COUNT(*) AS count FROM migrations WHERE id=?")
        .get(ownerFreeDeliveryRevision)
    ).count,
    1,
  );
});

test("cloud notification recipient is corrected once, stays private and can be replaced for handover", async () => {
  const settings = {
    ...(await store.settings()),
    orderNotificationEmail: "asadalay416@gmail.com",
  };
  const products = await store.products();
  const orders = await store.db
    .prepare("SELECT id,data FROM requests ORDER BY id")
    .all();
  await store.withRequest(true, async () => {
    await store.saveSettings(settings);
    await store.db
      .prepare("DELETE FROM migrations WHERE id=?")
      .run(ownerNotificationRevision);
  });
  store = await openPostgresStore({ poolFactory });
  assert.deepEqual(await store.settings(), {
    ...settings,
    orderNotificationEmail: "asadaly416@gmail.com",
  });
  assert.deepEqual(await store.products(), products);
  assert.deepEqual(
    await store.db.prepare("SELECT id,data FROM requests ORDER BY id").all(),
    orders,
  );
  assert.equal(
    "orderNotificationEmail" in (await request("/api/catalog")).data.settings,
    false,
  );
  await store.withRequest(true, async () => {
    await store.saveSettings({
      ...(await store.settings()),
      orderNotificationEmail: "client@example.test",
    });
  });
  store = await openPostgresStore({ poolFactory });
  assert.equal(
    (await store.settings()).orderNotificationEmail,
    "client@example.test",
  );
});

test("cloud email setup sends once across cold starts and releases alerts only after commit", async () => {
  const messages = [];
  const emailSend = async (message, key) => {
    // Sending must use a committed, independently readable outbox row.
    const row = await store.db
      .prepare("SELECT status FROM email_outbox WHERE id=?")
      .get(key.slice("qadam-".length));
    assert.equal(row.status, "sending");
    messages.push({ message, key });
    return { data: { id: `provider-${key}` } };
  };
  const notifications = createNotifications(store, {
    apiKey: "",
    send: emailSend,
  });
  await notifications.flush(100);
  messages.length = 0;
  for (let i = 0; i < 2; i++) {
    handler = createCloudHandler({
      store,
      adminHash: passwordHash(password),
      emailApiKey: "",
      emailSend,
      setupEmailTest: true,
    });
    assert.equal((await request("/api/health")).status, 200);
  }
  assert.equal(messages.length, 1);
  assert.equal(messages[0].message.subject, "Qadam Flex email test");
  assert.deepEqual(messages[0].message.to, ["client@example.test"]);
  assert.equal(messages[0].message.from, "Qadam Flex <orders@qadamflex.bond>");
  const previous = messages.length;
  const reference = "ROLLBACK-CLOUD-EMAIL";
  await assert.rejects(
    store.withRequest(true, async () => {
      await notifications.enqueue("test", "", reference);
      throw new Error("Simulated failed transaction");
    }),
  );
  await notifications.flush();
  assert.equal(messages.length, previous);
  const originalWithRequest = store.withRequest.bind(store);
  const failingStore = {
    ...store,
    withRequest: (write, action) =>
      originalWithRequest(write, async () => {
        const result = await action();
        if (write) throw new Error("Abort before commit");
        return result;
      }),
  };
  handler = createCloudHandler({
    store: failingStore,
    adminHash: passwordHash(password),
    emailApiKey: "",
    emailSend,
    setupEmailTest: false,
  });
  const headers = {
    "idempotency-key": randomUUID(),
    "x-forwarded-for": "rollback-support-test",
  };
  const failed = await request(
    "/api/messages",
    "POST",
    {
      name: "Rollback Support",
      phone: "03001234567",
      message: "This support request must roll back.",
    },
    headers,
  );
  assert.equal(failed.status, 503);
  assert.equal(
    await store.db
      .prepare("SELECT id FROM requests WHERE idempotency=?")
      .get(headers["idempotency-key"]),
    undefined,
  );
  assert.equal(messages.length, previous);
  handler = createCloudHandler({
    store,
    adminHash: passwordHash(password),
    emailApiKey: "",
    emailSend,
    setupEmailTest: false,
  });
  const saved = await request(
    "/api/messages",
    "POST",
    {
      name: "Saved Support",
      phone: "03001234567",
      message: "Please confirm size availability.",
    },
    {
      "idempotency-key": randomUUID(),
      "x-forwarded-for": "committed-support-test",
    },
  );
  assert.equal(saved.status, 201);
  assert.equal(messages.length, previous + 1);
  assert.match(messages.at(-1).message.subject, /New support message/);
});

test("Postgres outbox workers claim alerts once across independent notifier instances", async () => {
  const keys = [];
  const send = async (_message, key) => {
    keys.push(key);
    return { data: { id: key } };
  };
  const a = createNotifications(store, { apiKey: "", send });
  const b = createNotifications(store, { apiKey: "", send });
  await a.test("parallel-cloud-a");
  await b.test("parallel-cloud-b");
  await Promise.all([a.flush(), b.flush()]);
  assert.equal(keys.length, 2);
  assert.equal(new Set(keys).size, 2);
});

test("cloud customer email links, reviews/photos, tracking and sales persist in Postgres", async () => {
  const messages = [];
  handler = createCloudHandler({
    store,
    adminHash: passwordHash(password),
    emailApiKey: "",
    emailSend: async (message) => {
      messages.push(message);
      return { data: { id: randomUUID() } };
    },
    setupEmailTest: false,
  });
  const email = "cloud-features@example.test";
  const registered = await request(
    "/api/account/register",
    "POST",
    { email, name: "Cloud Buyer", password },
    { "x-forwarded-for": "feature-register" },
  );
  assert.equal(registered.status, 200);
  const customerHeaders = {
    cookie: registered.headers["Set-Cookie"].split(";")[0],
    "x-customer-csrf": registered.data.csrf,
  };
  const verifyToken = messages
    .find((m) => m.to[0] === email)
    .html.match(/#verify=([a-f0-9]{64})/)[1];
  assert.equal(
    (
      await request(
        "/api/account/verify-email",
        "POST",
        { token: verifyToken },
        { "x-forwarded-for": "feature-verify" },
      )
    ).status,
    200,
  );
  const login = await request(
    "/api/admin/login",
    "POST",
    { username: "admin", password },
    { "x-forwarded-for": "feature-admin" },
  );
  const admin = {
    cookie: login.headers["Set-Cookie"].split(";")[0],
    "x-csrf-token": login.data.csrf,
  };
  const id = `QF-O-${randomUUID()}`;
  await store.withRequest(true, async () => {
    await store.db.prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)").run(
      id,
      randomUUID(),
      "fixture",
      "order",
      "delivered",
      JSON.stringify({
        customer,
        items: [
          {
            id: "suede-penny",
            name: "Suede Penny",
            size: "7",
            quantity: 1,
            price: 350000,
          },
        ],
        totals: { subtotal: 350000, shipping: 0, total: 350000, discount: 0 },
        payment: { method: "bank", status: "paid" },
      }),
      new Date().toISOString(),
    );
    await store.db
      .prepare("INSERT INTO customer_orders VALUES(?,?)")
      .run(id, registered.data.user.id);
  });
  const data = {
    type: "image/png",
    data: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    ).toString("base64"),
  };
  const review = await request(
    `/api/account/orders/${id}/reviews`,
    "POST",
    {
      productId: "suede-penny",
      rating: 5,
      body: "Purchased pair fits well.",
      displayName: "Cloud Buyer",
      consent: true,
      photos: [data],
    },
    customerHeaders,
  );
  assert.equal(review.status, 201);
  const reviews = await request("/api/admin/reviews", "GET", undefined, admin),
    r = reviews.data.reviews.find((r) => r.request_id === id);
  assert.ok(r);
  assert.equal(
    (
      await request(
        `/api/admin/reviews/${r.id}`,
        "PATCH",
        { status: "approved" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/products/suede-penny/reviews")).data.count,
    1,
  );
  const p = await request(`/api/review-photos/${r.photos[0]}`);
  assert.equal(p.status, 200);
  const tracking = await request(
    `/api/admin/requests/${id}/tracking`,
    "PUT",
    { courier: "TCS", number: "CLOUD-123", url: "https://www.tcsexpress.com/" },
    admin,
  );
  assert.equal(tracking.status, 200);
  assert.equal(
    (
      await request("/api/account/orders", "GET", undefined, customerHeaders)
    ).data.orders.find((o) => o.id === id).data.tracking.number,
    "CLOUD-123",
  );
  const sales = await request("/api/admin/sales", "GET", undefined, admin);
  assert.equal(sales.status, 200);
  assert.ok(sales.data.revenue >= 350000);
  const reset = await request(
    "/api/account/forgot-password",
    "POST",
    { email },
    { "x-forwarded-for": "feature-reset" },
  );
  assert.equal(reset.status, 200);
  const resetToken = messages
    .findLast((m) => m.to[0] === email && m.html.includes("#reset="))
    .html.match(/#reset=([a-f0-9]{64})/)[1];
  assert.equal(
    (
      await request(
        "/api/account/reset-password",
        "POST",
        { token: resetToken, password: "new-cloud-feature-password" },
        { "x-forwarded-for": "feature-consume" },
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/account/session", "GET", undefined, customerHeaders))
      .status,
    401,
  );
  const reopened = await openPostgresStore({ poolFactory });
  assert.equal(
    (
      await reopened.db
        .prepare("SELECT status FROM reviews WHERE id=?")
        .get(r.id)
    ).status,
    "approved",
  );
  assert.ok(
    await reopened.db
      .prepare(
        "SELECT user_id FROM customer_email_verifications WHERE user_id=?",
      )
      .get(registered.data.user.id),
  );
});

test("owner test cleanup commits once in Postgres and preserves later customer orders", async () => {
  const { testCleanupRevision } =
    await import("../server/test-order-cleanup.mjs");
  const baseline = await store.product("suede-penny"),
    settings = await store.settings(),
    id = `QF-TEST-CLEAN-${randomUUID()}`,
    future = `QF-FUTURE-${randomUUID()}`;
  const data = JSON.stringify({
    customer,
    items: [{ id: baseline.id, size: "7", quantity: 1 }],
    totals: { total: 350000 },
    payment: { method: "bank", status: "paid" },
  });
  await store.withRequest(true, async () => {
    await store.db
      .prepare("DELETE FROM migrations WHERE id=?")
      .run(testCleanupRevision);
    await store.db
      .prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)")
      .run(
        id,
        randomUUID(),
        "cleanup-fixture",
        "order",
        "processing",
        data,
        "2026-10-21T09:00:00.000Z",
      );
    await store.db
      .prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)")
      .run(
        future,
        randomUUID(),
        "future-fixture",
        "order",
        "pending",
        data,
        "2026-10-22T09:00:00.000Z",
      );
  });
  const reopened = await openPostgresStore({ poolFactory });
  const archived = await reopened.db
    .prepare("SELECT status,data FROM requests WHERE id=?")
    .get(id);
  assert.equal(archived.status, "cancelled");
  assert.ok(JSON.parse(archived.data).archivedAt);
  const fresh = await reopened.db
    .prepare("SELECT status,data FROM requests WHERE id=?")
    .get(future);
  assert.equal(fresh.status, "pending");
  assert.equal(JSON.parse(fresh.data).archivedAt, undefined);
  assert.equal((await reopened.product(baseline.id)).stock, baseline.stock + 1);
  assert.equal(
    (await reopened.product(baseline.id)).stockBySize["7"],
    baseline.stockBySize["7"] + 1,
  );
  assert.deepEqual(await reopened.settings(), settings);
  const again = await openPostgresStore({ poolFactory });
  assert.equal((await again.product(baseline.id)).stock, baseline.stock + 1);
});
