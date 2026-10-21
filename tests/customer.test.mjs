import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApplication, passwordHash } from "../server/index.mjs";
let app, base, alice, bob, admin, order, recovery;
const password = "Customer-test-password-2026";
const customer = {
  name: "Account Test",
  phone: "03001234567",
  city: "Peshawar",
  address: "Private test address",
  notes: "",
};
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2fQAAAAASUVORK5CYII=",
  "base64",
);
const receipt = {
  type: "image/png",
  data: bytes.toString("base64"),
  reference: "TEST-TRANSFER-001",
};
async function request(path, method = "GET", data, headers = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return {
    status: r.status,
    headers: r.headers,
    data: r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : Buffer.from(await r.arrayBuffer()),
  };
}
const auth = (r) => ({
  cookie: r.headers.get("set-cookie").split(";")[0],
  "x-customer-csrf": r.data.csrf,
});
before(async () => {
  app = await createApplication({
    dbPath: ":memory:",
    useVite: false,
    production: true,
    trustProxy: true,
    adminHash: passwordHash(password),
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
  const login = await request("/api/admin/login", "POST", {
    username: "admin",
    password,
  });
  admin = {
    cookie: login.headers.get("set-cookie").split(";")[0],
    "x-csrf-token": login.data.csrf,
  };
});
after(async () => app.close());
test("registration, normalized email and private sessions never expose password hashes", async () => {
  const a = await request("/api/account/register", "POST", {
    name: "Alice",
    email: "Alice@example.test",
    password,
  });
  assert.equal(a.status, 200);
  assert.equal(a.data.user.email, "alice@example.test");
  assert.equal(a.data.recoveryCode.length, 40);
  recovery = a.data.recoveryCode;
  alice = auth(a);
  assert.match(alice.cookie, /qf_customer=/);
  assert.match(a.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.equal("password_hash" in a.data.user, false);
  assert.equal(
    (
      await request("/api/account/register", "POST", {
        name: "Other",
        email: "alice@example.test",
        password,
      })
    ).status,
    409,
  );
  const b = await request("/api/account/register", "POST", {
    name: "Bob",
    email: "bob@example.test",
    password,
  });
  bob = auth(b);
  assert.equal(
    (await request("/api/admin/dashboard", "GET", null, alice)).status,
    401,
  );
  assert.equal((await request("/api/account/orders")).status, 401);
  assert.equal(
    (await request("/api/account/profile", "PUT", {}, { cookie: alice.cookie }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/account/profile",
        "PUT",
        {},
        { ...alice, Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  const saved = await request("/api/account/profile", "PUT", customer, alice);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.user.city, "Peshawar");
  const login = await request("/api/account/login", "POST", {
    email: "ALICE@EXAMPLE.TEST",
    password,
  });
  assert.equal(login.status, 200);
  alice = auth(login);
});
test("manual payment requires customer login; totals and recipient are authoritative", async () => {
  const settings = app.store.settings();
  app.store.saveSettings({
    ...settings,
    shippingFee: 15000,
    codEnabled: false,
  });
  const p = app.store.product("suede-penny");
  app.store.saveProduct({
    ...p,
    stock: 10,
    stockBySize: { ...p.stockBySize, 7: 10 },
  });
  const input = {
    customer,
    items: [{ id: p.id, size: "7", quantity: 1 }],
    paymentMethod: "bank",
    payment: { status: "paid" },
    total: 1,
  };
  assert.equal(
    (
      await request("/api/requests", "POST", input, {
        "idempotency-key": randomUUID(),
      })
    ).status,
    401,
  );
  const key = randomUUID();
  const r = await request("/api/requests", "POST", input, {
    ...alice,
    "idempotency-key": key,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.kind, "order");
  order = r.data.reference;
  assert.equal(
    (
      await request("/api/requests", "POST", input, {
        ...alice,
        "idempotency-key": key,
      })
    ).data.reference,
    order,
  );
  assert.equal(app.store.product(p.id).stockBySize["7"], 9);
  assert.equal(
    (
      await request("/api/requests", "POST", input, {
        ...bob,
        "idempotency-key": key,
      })
    ).status,
    409,
  );
  const own = (await request("/api/account/orders", "GET", null, alice)).data
    .orders;
  assert.equal(own.length, 1);
  assert.equal(own[0].data.totals.total, 365000);
  assert.equal(own[0].data.payment.status, "awaiting_payment");
  assert.equal(own[0].data.payment.recipient.holder, "Ammar Alamgir");
  assert.deepEqual(
    (await request("/api/account/orders", "GET", null, bob)).data.orders,
    [],
  );
});
test("receipts are private, validated and require owner review before fulfilment", async () => {
  assert.equal(
    (await request(`/api/account/orders/${order}/proof`, "POST", receipt, bob))
      .status,
    404,
  );
  assert.equal(
    (
      await request(
        `/api/account/orders/${order}/proof`,
        "POST",
        {
          ...receipt,
          data: Buffer.from("<script>not a receipt</script>").toString(
            "base64",
          ),
        },
        alice,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/api/account/orders/${order}/proof`,
        "POST",
        receipt,
        alice,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await request(
        `/api/account/orders/${order}/proof`,
        "POST",
        receipt,
        alice,
      )
    ).status,
    409,
  );
  let row = (await request("/api/account/orders", "GET", null, alice)).data
    .orders[0];
  let proof = row.data.payment.proofId;
  assert.equal(row.data.payment.status, "under_review");
  assert.equal((await request(`/api/account/proofs/${proof}`)).status, 401);
  assert.equal(
    (await request(`/api/account/proofs/${proof}`, "GET", null, bob)).status,
    404,
  );
  const image = await request(
    `/api/account/proofs/${proof}`,
    "GET",
    null,
    alice,
  );
  assert.deepEqual(image.data, bytes);
  assert.match(image.headers.get("cache-control"), /private, no-store/);
  assert.equal(
    (await request(`/api/admin/proofs/${proof}`, "GET", null, admin)).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/admin/requests/${order}`,
        "PATCH",
        { status: "shipped" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/api/admin/payments/${proof}`,
        "PATCH",
        { status: "approved" },
        alice,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        `/api/admin/payments/${proof}`,
        "PATCH",
        { status: "rejected" },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/api/admin/payments/${proof}`,
        "PATCH",
        { status: "rejected", note: "Please upload a readable receipt." },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/account/orders/${order}/proof`,
        "POST",
        { ...receipt, reference: "TEST-TRANSFER-002" },
        alice,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await request(
        `/api/admin/payments/${proof}`,
        "PATCH",
        { status: "approved" },
        admin,
      )
    ).status,
    409,
  );
  row = (await request("/api/account/orders", "GET", null, alice)).data
    .orders[0];
  proof = row.data.payment.proofId;
  assert.equal(
    (
      await request(
        `/api/admin/payments/${proof}`,
        "PATCH",
        { status: "approved" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/admin/payments/${proof}`,
        "PATCH",
        { status: "rejected", note: "stale" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/api/admin/requests/${order}`,
        "PATCH",
        { status: "shipped" },
        admin,
      )
    ).status,
    200,
  );
  row = (await request("/api/account/orders", "GET", null, alice)).data
    .orders[0];
  assert.equal(row.data.payment.status, "paid");
  assert.equal(row.status, "shipped");
});
test("unconfirmed stock prevents payment; owner confirmation reserves stock exactly once", async () => {
  const unknown = app.store.product("textured-bit");
  app.store.saveProduct({
    ...unknown,
    stock: null,
    stockBySize: { ...unknown.stockBySize, 8: null },
  });
  const input = {
    customer,
    items: [{ id: "textured-bit", size: "8", quantity: 1 }],
    paymentMethod: "easypaisa",
  };
  const r = await request("/api/requests", "POST", input, {
    ...alice,
    "idempotency-key": randomUUID(),
  });
  assert.equal(r.data.kind, "inquiry");
  const id = r.data.reference;
  assert.equal(
    (await request(`/api/account/orders/${id}/proof`, "POST", receipt, alice))
      .status,
    409,
  );
  assert.equal(
    (
      await request(
        `/api/admin/requests/${id}/confirm`,
        "POST",
        { method: "easypaisa" },
        admin,
      )
    ).status,
    409,
  );
  const p = app.store.product("textured-bit");
  app.store.saveProduct({
    ...p,
    stock: 3,
    stockBySize: { ...p.stockBySize, 8: 3 },
  });
  assert.equal(
    (
      await request(
        `/api/admin/requests/${id}/confirm`,
        "POST",
        { method: "easypaisa" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/admin/requests/${id}/confirm`,
        "POST",
        { method: "easypaisa" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(app.store.product(p.id).stockBySize["8"], 2);
  const row = (
    await request("/api/account/orders", "GET", null, alice)
  ).data.orders.find((o) => o.id === id);
  assert.equal(row.kind, "order");
  assert.equal(row.data.payment.recipient.number, "03149537795");
  assert.equal(
    (
      await request(
        `/api/admin/requests/${id}`,
        "PATCH",
        { status: "cancelled" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(app.store.product(p.id).stockBySize["8"], 3);
  assert.equal(
    (await request(`/api/account/orders/${id}/proof`, "POST", receipt, alice))
      .status,
    409,
  );
});
test("recovery rotates its single-use code and invalidates existing sessions; password change signs other sessions out", async () => {
  const old = alice;
  assert.equal(
    (
      await request("/api/account/recover", "POST", {
        email: "alice@example.test",
        password,
        recoveryCode: "0".repeat(40),
      })
    ).status,
    401,
  );
  const result = await request("/api/account/recover", "POST", {
    email: "alice@example.test",
    password: password + "-new",
    recoveryCode: recovery,
  });
  assert.equal(result.status, 200);
  assert.notEqual(result.data.recoveryCode, recovery);
  alice = auth(result);
  assert.equal(
    (await request("/api/account/session", "GET", null, old)).status,
    401,
  );
  assert.equal(
    (
      await request("/api/account/recover", "POST", {
        email: "alice@example.test",
        password,
        recoveryCode: recovery,
      })
    ).status,
    401,
  );
  const changed = await request(
    "/api/account/password",
    "POST",
    { currentPassword: password + "-new", password: password + "-changed" },
    alice,
  );
  assert.equal(changed.status, 200);
  assert.equal(
    (await request("/api/account/session", "GET", null, alice)).status,
    401,
  );
  alice = auth(changed);
  assert.equal(
    (await request("/api/account/logout", "POST", {}, alice)).status,
    200,
  );
  assert.equal(
    (await request("/api/account/session", "GET", null, alice)).status,
    401,
  );
});
test("a recovery code cannot be used twice by concurrent reset requests", async () => {
  const signup = await request("/api/account/register", "POST", {
    name: "Concurrent Test",
    email: "concurrent@example.test",
    password,
  });
  const input = {
    email: "concurrent@example.test",
    password: password + "-reset",
    recoveryCode: signup.data.recoveryCode,
  };
  const results = await Promise.all([
    request("/api/account/recover", "POST", input),
    request("/api/account/recover", "POST", input),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
});

test("customer authentication is rate limited even for unknown accounts", async () => {
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await request(
          "/api/account/login",
          "POST",
          { email: "missing@example.test", password: "wrong" },
          { "x-forwarded-for": "separate-customer-rate-test" },
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await request(
        "/api/account/login",
        "POST",
        { email: "missing@example.test", password: "wrong" },
        { "x-forwarded-for": "separate-customer-rate-test" },
      )
    ).status,
    429,
  );
});

test("admin archive hides test enquiries from the customer and restores them without deleting records", async () => {
  const r = await request(
    "/api/requests",
    "POST",
    {
      customer,
      items: [{ id: "midnight-penny", size: "7", quantity: 1 }],
      paymentMethod: "bank",
    },
    { ...bob, "idempotency-key": randomUUID() },
  );
  assert.equal(r.status, 201);
  assert.equal(r.data.kind, "inquiry");
  const id = r.data.reference;
  const path = `/api/admin/requests/${id}/archive`;
  assert.equal((await request(path, "PATCH", { archived: true })).status, 401);
  assert.equal(
    (await request(path, "PATCH", { archived: true }, bob)).status,
    401,
  );
  assert.equal(
    (await request(path, "PATCH", { archived: true }, { cookie: admin.cookie }))
      .status,
    403,
  );
  assert.equal(
    (await request(path, "PATCH", { archived: "yes" }, admin)).status,
    400,
  );
  assert.equal(
    (await request(path, "PATCH", { archived: true }, admin)).status,
    200,
  );
  assert.equal(
    (await request("/api/account/orders", "GET", null, bob)).data.orders.some(
      (row) => row.id === id,
    ),
    false,
  );
  assert.ok(app.store.db.prepare("SELECT id FROM requests WHERE id=?").get(id));
  assert.ok(
    (
      await request("/api/admin/dashboard", "GET", null, admin)
    ).data.requests.find((row) => row.id === id).data.archivedAt,
  );
  assert.equal(
    (
      await request(
        `/api/admin/requests/${id}`,
        "PATCH",
        { status: "contacted" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/api/admin/requests/${id}/confirm`,
        "POST",
        { method: "bank" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (await request(path, "PATCH", { archived: false }, admin)).status,
    200,
  );
  assert.equal(
    (await request("/api/account/orders", "GET", null, bob)).data.orders.some(
      (row) => row.id === id,
    ),
    true,
  );
});

test("a live order must be cancelled before archiving; archive and restore never replenish stock", async () => {
  const before = app.store.product("suede-penny").stockBySize["7"];
  const placed = await request(
    "/api/requests",
    "POST",
    {
      customer,
      items: [{ id: "suede-penny", size: "7", quantity: 1 }],
      paymentMethod: "bank",
    },
    { ...bob, "idempotency-key": randomUUID() },
  );
  assert.equal(placed.data.kind, "order");
  const id = placed.data.reference,
    path = `/api/admin/requests/${id}/archive`;
  assert.equal(app.store.product("suede-penny").stockBySize["7"], before - 1);
  assert.equal(
    (await request(path, "PATCH", { archived: true }, admin)).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/api/admin/requests/${id}`,
        "PATCH",
        { status: "cancelled" },
        admin,
      )
    ).status,
    200,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await request(path, "PATCH", { archived: true }, admin)).status,
      200,
    );
  assert.equal(app.store.product("suede-penny").stockBySize["7"], before);
  assert.equal(
    (await request(path, "PATCH", { archived: false }, admin)).status,
    200,
  );
  assert.equal(app.store.product("suede-penny").stockBySize["7"], before);
  const restored = (
    await request("/api/account/orders", "GET", null, bob)
  ).data.orders.find((row) => row.id === id);
  assert.equal(restored.status, "cancelled");
});
