import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApplication, passwordHash } from "../server/index.mjs";
import { openStore } from "../server/store.mjs";

let app, base, dir, cookie, csrf, product, orderReference;
const customer = {
  name: "Store Test",
  phone: "03001234567",
  city: "Peshawar",
  address: "Test address only",
  notes: "Automated test fixture",
};
const selection = (quantity = 1, size = "7") => [
  { id: "suede-penny", size, quantity },
];
async function request(path, method = "GET", data, headers = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: r.status, data: await r.json(), headers: r.headers };
}
const adminHeaders = () => ({ Cookie: cookie, "X-CSRF-Token": csrf });
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "qadam-test-"));
  app = await createApplication({
    dbPath: join(dir, "store.db"),
    adminHash: passwordHash("test-password-only"),
    useVite: false,
    production: true,
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

test("catalog contains four published styles, confirmed PKR prices and size labels", async () => {
  const r = await request("/api/catalog");
  assert.equal(r.status, 200);
  assert.equal(r.data.products.length, 4);
  assert.deepEqual(
    Object.fromEntries(r.data.products.map((p) => [p.id, p.price])),
    {
      "suede-penny": 350000,
      "textured-bit": 220000,
      "evening-bit": 280000,
      "midnight-penny": null,
    },
  );
  assert.ok(r.data.products.every((p) => p.sizes.join(",") === "7,8,9,10,11"));
  assert.equal("discounts" in r.data.settings, false);
  assert.equal("orderNotificationEmail" in r.data.settings, false);
  product = r.data.products[0];
});
test("private management requires a session", async () => {
  assert.equal((await request("/api/admin/dashboard")).status, 401);
});
test("cross-origin mutations are rejected", async () => {
  const r = await request(
    "/api/messages",
    "POST",
    {},
    { Origin: "https://other.invalid" },
  );
  assert.equal(r.status, 403);
});
test("administrator login issues an HTTP-only cookie and CSRF token", async () => {
  assert.equal(
    (
      await request("/api/admin/login", "POST", {
        username: "admin",
        password: "incorrect",
      })
    ).status,
    401,
  );
  const r = await request("/api/admin/login", "POST", {
    username: "admin",
    password: "test-password-only",
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  cookie = r.headers.get("set-cookie").split(";")[0];
  csrf = r.data.csrf;
  assert.equal(
    (await request("/api/admin/dashboard", "GET", null, { Cookie: cookie }))
      .status,
    200,
  );
});
test("admin writes require a valid CSRF token", async () => {
  const r = await request(`/api/admin/products/${product.id}`, "PUT", product, {
    Cookie: cookie,
  });
  assert.equal(r.status, 403);
});
test("unpriced selections save an inquiry, with no invented total", async () => {
  const key = randomUUID(),
    payload = {
      customer,
      items: [{ id: "midnight-penny", size: "7", quantity: 1 }],
    };
  const r = await request("/api/requests", "POST", payload, {
    "Idempotency-Key": key,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.kind, "inquiry");
  assert.match(r.data.reference, /^QF-I-/);
  const row = app.store.db
    .prepare("SELECT data FROM requests WHERE id=?")
    .get(r.data.reference);
  assert.equal(JSON.parse(row.data).totals.total, null);
  const repeated = await request("/api/requests", "POST", payload, {
    "Idempotency-Key": key,
  });
  assert.equal(repeated.data.reference, r.data.reference);
  const conflicting = await request(
    "/api/requests",
    "POST",
    { ...payload, items: selection(2) },
    { "Idempotency-Key": key },
  );
  assert.equal(conflicting.status, 409);
});
test("inquiries survive reopening the database", () => {
  const db = openStore(join(dir, "store.db"));
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM requests").get().n, 1);
  db.db.close();
});
test("invalid size, invalid quantity, invalid contact and unpublished product are rejected", async () => {
  for (const items of [
    selection(1, "99"),
    selection(-1),
    [{ id: "brown-textured", size: "7", quantity: 1 }],
    [...selection(), ...selection()],
  ]) {
    assert.equal(
      (
        await request(
          "/api/requests",
          "POST",
          { customer, items },
          { "Idempotency-Key": randomUUID() },
        )
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request(
        "/api/requests",
        "POST",
        { customer: { ...customer, phone: "123" }, items: selection() },
        { "Idempotency-Key": randomUUID() },
      )
    ).status,
    400,
  );
});
test("messages persist as private customer enquiries", async () => {
  const r = await request(
    "/api/messages",
    "POST",
    {
      name: "Test note",
      phone: "03001234567",
      message: "Please confirm the sizing system.",
    },
    { "Idempotency-Key": randomUUID() },
  );
  assert.equal(r.status, 201);
  assert.match(r.data.reference, /QF-M-/);
  assert.equal((await request("/api/requests")).status, 404);
});
test("administrator can configure prices, size-specific inventory, delivery and discounts", async () => {
  product = {
    ...product,
    price: 300000,
    stock: null,
    stockBySize: { 7: 4, 8: 2, 9: 0, 10: null, 11: null },
  };
  const saved = await request(
    `/api/admin/products/${product.id}`,
    "PUT",
    product,
    adminHeaders(),
  );
  assert.equal(saved.status, 200);
  const s = app.store.settings();
  const r = await request(
    "/api/admin/settings",
    "PUT",
    {
      ...s,
      shippingFee: 25000,
      codEnabled: true,
      discounts: [
        {
          code: "TEST10",
          type: "percent",
          value: 10,
          minimum: 0,
          expires: null,
          active: true,
        },
      ],
    },
    adminHeaders(),
  );
  assert.equal(r.status, 200);
  assert.equal(app.store.product(product.id).stockBySize["7"], 4);
});
test("discounts use server prices and reject invalid codes", async () => {
  const r = await request("/api/discount", "POST", {
    items: selection(),
    code: "TEST10",
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.discount, 30000);
  assert.equal(r.data.total, 295000);
  assert.equal(
    (
      await request("/api/discount", "POST", {
        items: selection(),
        code: "MISSING",
      })
    ).status,
    400,
  );
});
test("out-of-stock size prevents an order, with no partial stock deduction", async () => {
  const r = await request(
    "/api/requests",
    "POST",
    { customer, items: [...selection(1, "7"), ...selection(1, "9")] },
    { "Idempotency-Key": randomUUID() },
  );
  assert.equal(r.status, 409);
  assert.equal(app.store.product(product.id).stockBySize["7"], 4);
});
test("priced COD order reserves the correct sizes and is idempotent", async () => {
  const key = randomUUID();
  const payload = {
    customer,
    items: [...selection(1, "7"), ...selection(2, "8")],
    discountCode: "TEST10",
    total: 1,
  };
  const r = await request("/api/requests", "POST", payload, {
    "Idempotency-Key": key,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.kind, "order");
  orderReference = r.data.reference;
  const data = JSON.parse(
    app.store.db
      .prepare("SELECT data FROM requests WHERE id=?")
      .get(orderReference).data,
  );
  assert.equal(data.totals.total, 835000);
  assert.equal(app.store.product(product.id).stockBySize["7"], 3);
  assert.equal(app.store.product(product.id).stockBySize["8"], 0);
  assert.equal(
    (
      await request("/api/requests", "POST", payload, {
        "Idempotency-Key": key,
      })
    ).data.reference,
    orderReference,
  );
  assert.equal(app.store.product(product.id).stockBySize["7"], 3);
});
test("unknown stock remains an inquiry even when price is known", async () => {
  const r = await request(
    "/api/requests",
    "POST",
    { customer, items: selection(1, "10") },
    { "Idempotency-Key": randomUUID() },
  );
  assert.equal(r.status, 201);
  assert.equal(r.data.kind, "inquiry");
});
test("cancelling an order restores size stock exactly once", async () => {
  const path = `/api/admin/requests/${orderReference}`;
  assert.equal(
    (await request(path, "PATCH", { status: "cancelled" }, adminHeaders()))
      .status,
    200,
  );
  assert.equal(app.store.product(product.id).stockBySize["7"], 4);
  assert.equal(app.store.product(product.id).stockBySize["8"], 2);
  assert.equal(
    (await request(path, "PATCH", { status: "cancelled" }, adminHeaders()))
      .status,
    200,
  );
  assert.equal(app.store.product(product.id).stockBySize["7"], 4);
  assert.equal(
    (await request(path, "PATCH", { status: "confirmed" }, adminHeaders()))
      .status,
    400,
  );
});
test("unsafe image types and duplicate slugs are rejected", async () => {
  assert.equal(
    (
      await request(
        "/api/admin/upload",
        "POST",
        { type: "image/svg+xml", data: "PHN2Zz4=" },
        adminHeaders(),
      )
    ).status,
    400,
  );
  const other = app.store.product("textured-bit");
  assert.equal(
    (
      await request(
        `/api/admin/products/${other.id}`,
        "PUT",
        { ...other, slug: product.slug },
        adminHeaders(),
      )
    ).status,
    400,
  );
});
test("image magic bytes are verified, even for an allowed MIME type", async () => {
  const r = await request(
    "/api/admin/upload",
    "POST",
    {
      type: "image/png",
      data: Buffer.from("not an image but longer than twelve bytes").toString(
        "base64",
      ),
    },
    adminHeaders(),
  );
  assert.equal(r.status, 400);
});
test("official contact and manual payment details are public and retain leading zeroes", async () => {
  const r = await request("/api/catalog");
  const s = r.data.settings;
  assert.equal(s.website, "https://qadamflex.bond");
  assert.equal(s.phone, "03237205097");
  assert.equal(s.whatsapp, "923237205097");
  assert.equal(s.instagram, "qadamflex");
  assert.equal(s.tiktok, "qadamflexoffical");
  assert.equal(s.bankAccountHolder, "Ammar Alamgir");
  assert.equal(s.bankIban, "PK84ABPA0011935002260015");
  assert.equal(s.bankAccountNumber, "0011935002260015");
  assert.equal(s.easypaisaHolder, "Ammar Alamgir");
  assert.equal(s.easypaisaNumber, "03149537795");
});
test("manual payment settings validate account identifiers before saving", async () => {
  const s = app.store.settings();
  for (const patch of [
    { bankIban: "PK85ABPA0011935002260015" },
    { bankAccountNumber: "ABC12345" },
    { easypaisaNumber: "3149537795" },
    { website: "javascript:alert(1)" },
  ])
    assert.equal(
      (
        await request(
          "/api/admin/settings",
          "PUT",
          { ...s, ...patch },
          adminHeaders(),
        )
      ).status,
      400,
    );
  const saved = await request(
    "/api/admin/settings",
    "PUT",
    { ...s, bankIban: "PK84 ABPA 0011 9350 0226 0015" },
    adminHeaders(),
  );
  assert.equal(saved.status, 200);
  assert.equal(app.store.settings().bankIban, "PK84ABPA0011935002260015");
  assert.equal(app.store.settings().bankAccountNumber, "0011935002260015");
});
test("order notification recipients are editable only through admin and absent from the public catalog", async () => {
  const settings = app.store.settings();
  const saved = await request(
    "/api/admin/settings",
    "PUT",
    { ...settings, orderNotificationEmail: "testing@example.test" },
    adminHeaders(),
  );
  assert.equal(saved.status, 200);
  const dashboard = await request("/api/admin/dashboard", "GET", null, {
    Cookie: cookie,
  });
  assert.equal(
    dashboard.data.settings.orderNotificationEmail,
    "testing@example.test",
  );
  assert.equal(
    "orderNotificationEmail" in (await request("/api/catalog")).data.settings,
    false,
  );
  const invalid = await request(
    "/api/admin/settings",
    "PUT",
    { ...settings, orderNotificationEmail: "not-an-email" },
    adminHeaders(),
  );
  assert.equal(invalid.status, 400);
  assert.equal(
    app.store.settings().orderNotificationEmail,
    "testing@example.test",
  );
  const reopened = openStore(join(dir, "store.db"));
  assert.equal(
    reopened.settings().orderNotificationEmail,
    "testing@example.test",
  );
  reopened.db.close();
});
test("administrator logout invalidates the session", async () => {
  assert.equal(
    (await request("/api/admin/logout", "POST", {}, adminHeaders())).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/dashboard", "GET", null, { Cookie: cookie }))
      .status,
    401,
  );
});
