import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openStore } from "../server/store.mjs";
import { createNotifications } from "../server/notifications.mjs";
import { renderOwnerEmail } from "../server/emails.mjs";
import { createApplication, passwordHash } from "../server/index.mjs";

function fixture(t) {
  const store = openStore(":memory:");
  t.after(() => store.db.close());
  store.saveSettings({
    ...store.settings(),
    orderNotificationEmail: "owner@example.test",
  });
  return store;
}
function order(store) {
  const reference = `QF-O-${randomUUID()}`;
  store.db.prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)").run(
    reference,
    randomUUID(),
    "test",
    "order",
    "pending",
    JSON.stringify({
      customer: {
        name: "Test customer",
        city: "Peshawar",
        address: "DO NOT EMAIL THIS ADDRESS",
        phone: "PRIVATE PHONE",
      },
      items: [{ name: "Suede Penny", size: "7", quantity: 1, price: 350000 }],
      totals: { subtotal: 350000, shipping: 0, discount: 0, total: 350000 },
      payment: {
        method: "bank",
        status: "under_review",
        recipient: { iban: "PRIVATE BANK" },
        proofUrl: "/private/receipt",
      },
    }),
    new Date().toISOString(),
  );
  return reference;
}

test("owner alerts snapshot the private receiver, deduplicate events and omit sensitive details", async (t) => {
  const store = fixture(t),
    messages = [];
  const notifications = createNotifications(store, {
    apiKey: "",
    send: async (message, key) => {
      messages.push({ message, key });
      return { data: { id: "provider-one" } };
    },
  });
  const reference = order(store);
  const id = await notifications.enqueue("new_order", reference);
  assert.equal(await notifications.enqueue("new_order", reference), id);
  store.saveSettings({
    ...store.settings(),
    orderNotificationEmail: "client@example.test",
  });
  await notifications.flush();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].message.from, "Qadam Flex <orders@qadamflex.bond>");
  assert.deepEqual(messages[0].message.to, ["owner@example.test"]);
  assert.match(messages[0].message.text, /Free delivery/);
  assert.match(messages[0].message.html, /https:\/\/www.qadamflex.bond\/admin/);
  assert.doesNotMatch(
    JSON.stringify(messages),
    /DO NOT EMAIL|PRIVATE PHONE|PRIVATE BANK|\/private\/receipt/,
  );
  assert.equal(
    (await notifications.status()).recent[0].provider_id,
    "provider-one",
  );
  await notifications.enqueue("status_changed", reference, "status-event");
  await notifications.flush();
  assert.deepEqual(messages[1].message.to, ["client@example.test"]);
});

test("support template escapes untrusted text and has a readable plain-text alternative", async () => {
  const result = await renderOwnerEmail({
    event: "support_message",
    reference: "QF-M-test",
    status: "new",
    customer: { name: '<img src=x onerror="alert(1)">' },
    message: "<script>malicious()</script>\nPlease help.",
  });
  assert.doesNotMatch(result.html, /<script>|<img src=x/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.text, /Please help/);
  assert.match(result.html, /lang="en"/);
  assert.ok(Buffer.byteLength(result.html) < 102000);
});

test("transient failures retry with backoff and one stable provider idempotency key", async (t) => {
  const store = fixture(t),
    keys = [];
  let clock = 1792500000000,
    attempt = 0;
  const notifications = createNotifications(store, {
    apiKey: "",
    now: () => clock,
    send: async (_message, key) => {
      keys.push(key);
      attempt++;
      if (attempt === 1) throw new Error("network interrupted");
      return attempt === 2
        ? { error: { statusCode: 429 } }
        : { data: { id: "retried" } };
    },
  });
  await notifications.enqueue("test", "", "retry-test");
  await notifications.flush();
  await notifications.flush();
  assert.equal(keys.length, 1);
  clock += 31000;
  await notifications.flush();
  clock += 61000;
  await notifications.flush();
  assert.equal(keys.length, 3);
  assert.equal(new Set(keys).size, 1);
  assert.equal((await notifications.status()).counts.sent, 1);
});

test("permanent provider failures are sanitized and require an explicit retry", async (t) => {
  const store = fixture(t);
  let calls = 0;
  const notifications = createNotifications(store, {
    apiKey: "",
    send: async () =>
      ++calls === 1
        ? {
            error: {
              statusCode: 401,
              message: "DO NOT EXPOSE PROVIDER RESPONSE",
            },
          }
        : { data: { id: "fixed" } },
  });
  await notifications.test();
  await notifications.flush();
  await notifications.flush();
  assert.equal(calls, 1);
  const status = await notifications.status();
  assert.equal(status.counts.failed, 1);
  assert.match(status.recent[0].last_error, /private Vercel key/);
  assert.doesNotMatch(JSON.stringify(status), /DO NOT EXPOSE/);
  await notifications.retry();
  await notifications.flush();
  assert.equal(calls, 2);
  assert.equal((await notifications.status()).counts.sent, 1);
});

test("queue survives notifier restarts and independent workers never claim the same pending alert", async (t) => {
  const store = fixture(t),
    keys = [];
  const send = async (_message, key) => {
    keys.push(key);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { data: { id: key } };
  };
  const disabled = createNotifications(store, { apiKey: "" });
  await disabled.enqueue("new_order", order(store));
  await disabled.enqueue("support_message", order(store));
  await disabled.flush();
  assert.equal((await disabled.status()).counts.pending, 2);
  const a = createNotifications(store, { apiKey: "", send });
  const b = createNotifications(store, { apiKey: "", send });
  await Promise.all([a.flush(), b.flush(), a.flush()]);
  assert.equal(keys.length, 2);
  assert.equal(new Set(keys).size, 2);
  assert.equal((await b.status()).counts.sent, 2);
});

test("expired send leases recover safely and alerts past the provider deduplication window stop", async (t) => {
  const store = fixture(t),
    keys = [];
  const clock = 1792500000000;
  const notifications = createNotifications(store, {
    apiKey: "",
    now: () => clock,
    send: async (_message, key) => {
      keys.push(key);
      return { data: { id: key } };
    },
  });
  const first = await notifications.test("interrupted");
  store.db
    .prepare(
      "UPDATE email_outbox SET status='sending',next_attempt=?,first_attempt=? WHERE id=?",
    )
    .run(clock - 1000, clock - 120000, first);
  await notifications.flush();
  assert.deepEqual(keys, [`qadam-${first}`]);
  const old = await notifications.test("too-old");
  store.db
    .prepare(
      "UPDATE email_outbox SET status='sending',next_attempt=?,first_attempt=? WHERE id=?",
    )
    .run(clock - 1000, clock - 24 * 3600000, old);
  await notifications.flush();
  assert.equal(keys.length, 1);
  assert.equal((await notifications.status()).counts.unknown, 1);
});

test("outbox entries roll back with failed store mutations and blank recipients disable future alerts", async (t) => {
  const store = fixture(t);
  const notifications = createNotifications(store, { apiKey: "" });
  store.db.exec("BEGIN IMMEDIATE");
  await notifications.enqueue("new_order", order(store));
  store.db.exec("ROLLBACK");
  assert.equal((await notifications.status()).counts.pending, 0);
  store.saveSettings({ ...store.settings(), orderNotificationEmail: "" });
  assert.equal(await notifications.enqueue("new_order", order(store)), null);
  await assert.rejects(notifications.test(), { status: 503 });
});

test("notification APIs enforce admin authentication/CSRF and provider failure never fails a saved support message", async (t) => {
  const app = await createApplication({
    dbPath: ":memory:",
    useVite: false,
    production: true,
    adminHash: passwordHash("email-test-password"),
    emailApiKey: "",
    emailSend: async () => ({ error: { statusCode: 500 } }),
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = async (path, method = "GET", data, headers = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: data ? JSON.stringify(data) : undefined,
    });
    return {
      status: response.status,
      headers: response.headers,
      data: await response.json(),
    };
  };
  assert.equal((await request("/api/admin/notifications")).status, 401);
  const login = await request("/api/admin/login", "POST", {
    username: "admin",
    password: "email-test-password",
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await request("/api/admin/notifications/test", "POST", {}, { cookie }))
      .status,
    403,
  );
  const headers = { cookie, "x-csrf-token": login.data.csrf };
  assert.equal(
    (await request("/api/admin/notifications/test", "POST", {}, headers))
      .status,
    202,
  );
  const messageHeaders = { "idempotency-key": randomUUID() };
  const message = {
    name: "Test Support",
    phone: "03001234567",
    message: "Please help with size 7.",
  };
  const sent = await request("/api/messages", "POST", message, messageHeaders);
  assert.equal(sent.status, 201);
  assert.equal(
    (await request("/api/messages", "POST", message, messageHeaders)).data
      .reference,
    sent.data.reference,
  );
  await app.notifications.flush();
  assert.equal(
    app.store.db
      .prepare(
        "SELECT COUNT(*) AS n FROM email_outbox WHERE event='support_message'",
      )
      .get().n,
    1,
  );
  assert.equal(
    (await request("/api/admin/notifications", "GET", undefined, headers)).data
      .counts.pending,
    2,
  );
  const catalog = await request("/api/catalog");
  assert.doesNotMatch(
    JSON.stringify(catalog.data),
    /orderNotificationEmail|email_outbox|provider_id/,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await request("/api/admin/notifications/test", "POST", {}, headers))
        .status,
      202,
    );
  assert.equal(
    (await request("/api/admin/notifications/test", "POST", {}, headers))
      .status,
    429,
  );
});
