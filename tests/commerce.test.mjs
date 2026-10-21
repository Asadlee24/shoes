import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createApplication, passwordHash } from "../server/index.mjs";
import { salesSummary } from "../server/commerce.mjs";
import { renderOwnerEmail } from "../server/emails.mjs";
const password = "customer-testing-password-123";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const photo = {
  type: "image/png",
  data: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
    "base64",
  ).toString("base64"),
};
async function fixture(t) {
  const messages = [];
  const app = await createApplication({
    dbPath: ":memory:",
    production: true,
    useVite: false,
    adminHash: passwordHash(password),
    emailApiKey: "",
    emailSend: async (message) => {
      messages.push(message);
      return { data: { id: randomUUID() } };
    },
  });
  t.after(async () => {
    await app.close();
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function req(path, method = "GET", data, headers = {}) {
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
  const a = await req("/api/admin/login", "POST", {
    username: "admin",
    password,
  });
  const admin = {
    cookie: a.headers.get("set-cookie").split(";")[0],
    "x-csrf-token": a.data.csrf,
  };
  async function register(email = "customer@example.test") {
    const r = await req("/api/account/register", "POST", {
      email,
      name: "Real Customer",
      password,
    });
    assert.equal(r.status, 200);
    await app.notifications.flush(30);
    return {
      id: r.data.user.id,
      email,
      recoveryCode: r.data.recoveryCode,
      headers: {
        cookie: r.headers.get("set-cookie").split(";")[0],
        "x-customer-csrf": r.data.csrf,
      },
    };
  }
  function token(kind, email) {
    const msg = messages.findLast(
      (m) => m.to[0] === email && m.html.includes(`/account#${kind}=`),
    );
    assert.ok(msg, `${kind} email must be sent`);
    return msg.html.match(new RegExp(`/account#${kind}=([a-f0-9]{64})`))[1];
  }
  async function verified(user) {
    const r = await req("/api/account/verify-email", "POST", {
      token: token("verify", user.email),
    });
    assert.equal(r.status, 200);
  }
  function order(
    user,
    {
      status = "delivered",
      payment = "paid",
      kind = "order",
      productId = "suede-penny",
      archived = false,
    } = {},
  ) {
    const id = `QF-O-${randomUUID()}`;
    const data = {
      customer: {
        name: "Real Customer",
        phone: "03001234567",
        city: "Peshawar",
        address: "Private street",
        notes: "",
      },
      items: [
        {
          id: productId,
          name: "The Suede Penny",
          size: "7",
          quantity: 1,
          price: 350000,
        },
      ],
      totals: { subtotal: 350000, shipping: 0, discount: 0, total: 350000 },
      payment: { method: "bank", status: payment },
      ...(archived ? { archivedAt: new Date().toISOString() } : {}),
    };
    app.store.db
      .prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)")
      .run(
        id,
        randomUUID(),
        "test",
        kind,
        status,
        JSON.stringify(data),
        new Date().toISOString(),
      );
    app.store.db
      .prepare("INSERT INTO customer_orders VALUES(?,?)")
      .run(id, user.id);
    return id;
  }
  return { app, messages, req, admin, register, token, verified, order };
}
test("only delivered purchasers can review; approval protects public photos and hiding revokes them", async (t) => {
  const f = await fixture(t),
    user = await f.register(),
    other = await f.register("other@example.test"),
    id = f.order(user);
  const input = {
    productId: "suede-penny",
    rating: 4,
    body: "Comfortable shoes. <script>never execute</script>",
    displayName: "Buyer",
    consent: true,
    photos: [photo],
  };
  assert.equal(
    (
      await f.req(
        `/api/account/orders/${id}/reviews`,
        "POST",
        input,
        other.headers,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.req(`/api/account/orders/${id}/reviews`, "POST", input, {
        cookie: user.headers.cookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.req(
        `/api/account/orders/${id}/reviews`,
        "POST",
        { ...input, consent: false },
        user.headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.req(
        `/api/account/orders/${id}/reviews`,
        "POST",
        input,
        user.headers,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await f.req(
        `/api/account/orders/${id}/reviews`,
        "POST",
        input,
        user.headers,
      )
    ).status,
    409,
  );
  let publicReviews = await f.req("/api/products/suede-penny/reviews");
  assert.equal(publicReviews.data.count, 0);
  const list = await f.req("/api/admin/reviews", "GET", undefined, f.admin),
    review = list.data.reviews[0],
    pid = review.photos[0];
  assert.equal((await f.req(`/api/review-photos/${pid}`)).status, 404);
  assert.equal((await f.req(`/api/admin/review-photos/${pid}`)).status, 401);
  assert.equal(
    (
      await f.req(
        `/api/admin/reviews/${review.id}`,
        "PATCH",
        { status: "approved" },
        { cookie: f.admin.cookie },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.req(
        `/api/admin/reviews/${review.id}`,
        "PATCH",
        { status: "approved" },
        f.admin,
      )
    ).status,
    200,
  );
  publicReviews = await f.req("/api/products/suede-penny/reviews");
  assert.equal(publicReviews.data.count, 1);
  assert.equal(publicReviews.data.average, 4);
  assert.equal(publicReviews.data.reviews[0].body, input.body);
  assert.equal(publicReviews.data.reviews[0].user_id, undefined);
  assert.equal((await f.req(`/api/review-photos/${pid}`)).status, 200);
  await f.req(
    `/api/admin/reviews/${review.id}`,
    "PATCH",
    { status: "rejected" },
    f.admin,
  );
  assert.equal((await f.req(`/api/review-photos/${pid}`)).status, 404);
});
test("reviews reject unpaid, undelivered, wrong-product and disguised or oversize photos", async (t) => {
  const f = await fixture(t),
    u = await f.register();
  const input = {
    productId: "suede-penny",
    rating: 5,
    body: "A real review",
    displayName: "Buyer",
    consent: true,
    photos: [],
  };
  for (const options of [
    { status: "pending" },
    { payment: "awaiting_payment" },
    { archived: true },
  ]) {
    const id = f.order(u, options);
    assert.equal(
      (
        await f.req(
          `/api/account/orders/${id}/reviews`,
          "POST",
          input,
          u.headers,
        )
      ).status,
      409,
    );
  }
  const id = f.order(u);
  assert.equal(
    (
      await f.req(
        `/api/account/orders/${id}/reviews`,
        "POST",
        { ...input, productId: "wrong" },
        u.headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.req(
        `/api/account/orders/${id}/reviews`,
        "POST",
        {
          ...input,
          photos: [
            {
              type: "image/png",
              data: Buffer.from('<svg onload="alert(1)"></svg>').toString(
                "base64",
              ),
            },
          ],
        },
        u.headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.req(
        `/api/account/orders/${id}/reviews`,
        "POST",
        {
          ...input,
          photos: [
            {
              type: "image/png",
              data: Buffer.concat([
                Buffer.from(photo.data, "base64"),
                Buffer.alloc(1000000),
              ]).toString("base64"),
            },
          ],
        },
        u.headers,
      )
    ).status,
    400,
  );
});
test("courier tracking is private, validates HTTPS, requires paid orders and preserves stock and status", async (t) => {
  const f = await fixture(t),
    u = await f.register(),
    other = await f.register("stranger@example.test");
  await f.verified(u);
  const id = f.order(u, { status: "processing" }),
    stock = await f.app.store.products();
  const path = `/api/admin/requests/${id}/tracking`;
  assert.equal(
    (
      await f.req(
        path,
        "PUT",
        { courier: "TCS", number: "123", url: "javascript:alert(1)" },
        f.admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.req(
        path,
        "PUT",
        {
          courier: "TCS",
          number: "123",
          url: "https://user:password@example.test/",
        },
        f.admin,
      )
    ).status,
    400,
  );
  const saved = await f.req(
    path,
    "PUT",
    {
      courier: "TCS",
      number: "123",
      url: "https://www.tcsexpress.com/track/123",
    },
    f.admin,
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data.request.status, "processing");
  assert.deepEqual(await f.app.store.products(), stock);
  assert.equal(
    (await f.req("/api/account/orders", "GET", undefined, u.headers)).data
      .orders[0].data.tracking.number,
    "123",
  );
  assert.equal(
    (await f.req("/api/account/orders", "GET", undefined, other.headers)).data
      .orders.length,
    0,
  );
  await f.app.notifications.flush(30);
  assert.ok(
    f.messages.some(
      (m) => m.to[0] === u.email && m.subject.includes("tracking"),
    ),
  );
  const unpaid = f.order(u, { payment: "awaiting_payment" });
  assert.equal(
    (
      await f.req(
        `/api/admin/requests/${unpaid}/tracking`,
        "PUT",
        { courier: "TCS", number: "123" },
        f.admin,
      )
    ).status,
    409,
  );
});
test("customer order emails require mailbox verification, deduplicate and use the customer account CTA", async (t) => {
  const f = await fixture(t),
    u = await f.register(),
    id = f.order(u, { status: "pending" });
  await f.app.notifications.enqueue("new_order", id);
  await f.app.notifications.flush(30);
  assert.equal(
    f.messages.filter(
      (m) => m.to[0] === u.email && m.subject.includes("received your order"),
    ).length,
    0,
  );
  await f.verified(u);
  await f.app.notifications.flush(30);
  await f.app.notifications.enqueue("new_order", id);
  await f.app.notifications.flush(30);
  const mails = f.messages.filter(
    (m) => m.to[0] === u.email && m.subject.includes("received your order"),
  );
  assert.equal(mails.length, 1);
  assert.match(mails[0].html, /logo-transparent.png/);
  assert.match(mails[0].html, /https:\/\/www.qadamflex.bond\/account/);
  assert.doesNotMatch(mails[0].html, /Private street/);
});
test("email reset has a uniform response, hashed expiring single-use tokens and revokes sessions/recovery codes", async (t) => {
  const f = await fixture(t),
    u = await f.register();
  const known = await f.req(
    "/api/account/forgot-password",
    "POST",
    { email: u.email },
    { host: "attacker.test" },
  );
  const unknown = await f.req("/api/account/forgot-password", "POST", {
    email: "unknown@example.test",
  });
  assert.equal(known.status, 200);
  assert.deepEqual(known.data, unknown.data);
  await f.app.notifications.flush(30);
  const token = f.token("reset", u.email),
    stored = f.app.store.db
      .prepare(
        "SELECT * FROM customer_email_tokens WHERE kind='password_reset'",
      )
      .get();
  assert.equal(stored.token, sha(token));
  assert.ok(Number(stored.expires) > Date.now());
  assert.equal(
    (await f.req(`/api/account/reset-password?token=${token}`)).status,
    401,
  );
  const newPassword = "brand-new-testing-password-123";
  const r = await f.req("/api/account/reset-password", "POST", {
    token,
    password: newPassword,
  });
  assert.equal(r.status, 200);
  assert.match(r.data.recoveryCode, /^[a-f0-9]{40}$/);
  assert.equal(
    (await f.req("/api/account/session", "GET", undefined, u.headers)).status,
    401,
  );
  assert.equal(
    (
      await f.req("/api/account/reset-password", "POST", {
        token,
        password: newPassword,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.req("/api/account/recover", "POST", {
        email: u.email,
        recoveryCode: u.recoveryCode,
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.req("/api/account/login", "POST", {
        email: u.email,
        password: newPassword,
      })
    ).status,
    200,
  );
  assert.equal(
    f.app.store.db
      .prepare(
        "SELECT COUNT(*) AS n FROM customer_email_tokens WHERE user_id=?",
      )
      .get(u.id).n,
    0,
  );
  assert.equal(
    f.app.store.db
      .prepare("SELECT payload FROM email_outbox WHERE event='password_reset'")
      .get().payload,
    "{}",
  );
});
test("expired reset tokens cannot change passwords and reset requests are rate limited", async (t) => {
  const f = await fixture(t),
    u = await f.register();
  await f.req("/api/account/forgot-password", "POST", { email: u.email });
  await f.app.notifications.flush(30);
  const token = f.token("reset", u.email);
  f.app.store.db
    .prepare(
      "UPDATE customer_email_tokens SET expires=0 WHERE kind='password_reset'",
    )
    .run();
  assert.equal(
    (
      await f.req("/api/account/reset-password", "POST", {
        token,
        password: "new-password-for-expiry-test",
      })
    ).status,
    400,
  );
  await f.req("/api/account/forgot-password", "POST", { email: u.email });
  await f.req("/api/account/forgot-password", "POST", { email: u.email });
  assert.equal(
    (await f.req("/api/account/forgot-password", "POST", { email: u.email }))
      .status,
    429,
  );
});
test("low stock alerts fire on threshold crossing once and rearm after restock", async (t) => {
  const f = await fixture(t),
    product = await f.app.store.product("suede-penny");
  product.stockBySize = { ...product.stockBySize, 7: 2 };
  await f.app.notifications.checkStock(product);
  await f.app.notifications.checkStock(product);
  product.stockBySize["7"] = 1;
  await f.app.notifications.checkStock(product);
  assert.equal(
    f.app.store.db
      .prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE event='low_stock'")
      .get().n,
    1,
  );
  product.stockBySize["7"] = 5;
  await f.app.notifications.checkStock(product);
  product.stockBySize["7"] = 2;
  await f.app.notifications.checkStock(product);
  assert.equal(
    f.app.store.db
      .prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE event='low_stock'")
      .get().n,
    2,
  );
  assert.equal((await f.req("/api/admin/sales")).status, 401);
});
test("sales summary counts paid orders accurately, excludes enquiries/cancelled/archived and reports size inventory", () => {
  const base = {
    kind: "order",
    status: "processing",
    created: "2026-10-21T00:00:00Z",
    data: {
      payment: { method: "bank", status: "paid" },
      totals: { total: 350000 },
    },
  };
  const rows = [
    base,
    { ...base, kind: "inquiry" },
    { ...base, status: "cancelled" },
    { ...base, data: { ...base.data, archivedAt: "today" } },
    {
      ...base,
      data: {
        ...base.data,
        payment: { method: "bank", status: "awaiting_payment" },
      },
    },
    {
      ...base,
      status: "delivered",
      data: { ...base.data, payment: { method: "cod", status: "pending" } },
    },
  ];
  const summary = salesSummary(
    rows,
    [
      {
        id: "shoe",
        name: "Shoe",
        published: true,
        sizes: ["7", "8"],
        stockBySize: { 7: 2, 8: null },
      },
    ],
    Date.parse("2026-10-22"),
  );
  assert.equal(summary.revenue, 700000);
  assert.equal(summary.paidOrders, 2);
  assert.equal(summary.monthRevenue, 700000);
  assert.equal(summary.lowStock.length, 1);
});
test("account email templates escape customer content and never include admin actions", async () => {
  const mail = await renderOwnerEmail({
    event: "password_reset",
    audience: "customer",
    customer: { name: "<script>bad</script>" },
    actionUrl: "https://www.qadamflex.bond/account#reset=abc",
  });
  assert.match(mail.html, /Reset password/);
  assert.match(mail.text, /15 minutes/);
  assert.doesNotMatch(mail.html, /<script>|\/admin/);
});
