import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApplication, passwordHash } from "../server/index.mjs";

test("guest availability enquiries require no payment and never reserve unknown stock", async () => {
  const app = await createApplication({
    dbPath: ":memory:",
    adminHash: passwordHash("test-only-password"),
    production: true,
    useVite: false,
    emailApiKey: "test-only",
    emailSend: async () => ({ id: "fake-mail-only" }),
  });
  try {
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const before = app.store.product("metro-court-mocha");
    const response = await fetch(
      `http://127.0.0.1:${app.server.address().port}/api/requests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          paymentMethod: "inquiry",
          customer: {
            name: "Readiness test",
            phone: "03001234567",
            city: "Fixture city",
            address: "Fixture address",
          },
          items: [{ id: before.id, size: "7", quantity: 1 }],
        }),
      },
    );
    const result = await response.json();
    assert.equal(response.status, 201);
    assert.equal(result.kind, "inquiry");
    const row = JSON.parse(
      app.store.db
        .prepare("SELECT data FROM requests WHERE id=?")
        .get(result.reference).data,
    );
    assert.equal(row.payment.status, "not_required");
    assert.equal(row.payment.recipient, null);
    assert.deepEqual(
      app.store.product(before.id).stockBySize,
      before.stockBySize,
    );
  } finally {
    await app.close();
  }
});

test("owner-confirmed size measurements and policy fields persist and invalid values cannot overwrite them", async () => {
  const app = await createApplication({
    dbPath: ":memory:",
    adminHash: passwordHash("test-only-password"),
    production: true,
    useVite: false,
    emailApiKey: "test-only",
    emailSend: async () => ({ id: "fake-mail-only" }),
  });
  try {
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const login = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "test-only-password",
      }),
    });
    const session = await login.json();
    const headers = {
      "Content-Type": "application/json",
      Cookie: login.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": session.csrf,
    };
    const before = app.store.product("metro-court-mocha");
    const fixture = {
      ...before,
      sizeSystem: "Supplier test sizing",
      footLengthsCm: { 7: 25.5 },
      fitNotes: "Fixture-only measurement guidance",
    };
    const save = await fetch(base + `/api/admin/products/${before.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(fixture),
    });
    assert.equal(save.status, 200);
    assert.equal(app.store.product(before.id).footLengthsCm["7"], 25.5);
    assert.deepEqual(
      app.store.product(before.id).stockBySize,
      before.stockBySize,
    );
    const invalid = await fetch(base + `/api/admin/products/${before.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ ...fixture, footLengthsCm: { 7: 99 } }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(app.store.product(before.id).footLengthsCm["7"], 25.5);
    const settings = {
      ...app.store.settings(),
      deliveryEstimate: "Fixture estimate only",
      exchangeWindowDays: 7,
    };
    assert.equal(
      (
        await fetch(base + "/api/admin/settings", {
          method: "PUT",
          headers,
          body: JSON.stringify(settings),
        })
      ).status,
      200,
    );
    const publicCatalog = await (await fetch(base + "/api/catalog")).json();
    assert.equal(publicCatalog.settings.exchangeWindowDays, 7);
    assert.equal(
      publicCatalog.settings.deliveryEstimate,
      "Fixture estimate only",
    );
    assert.equal("orderNotificationEmail" in publicCatalog.settings, false);
    assert.equal(
      (
        await fetch(base + "/api/admin/settings", {
          method: "PUT",
          headers,
          body: JSON.stringify({ ...settings, exchangeWindowDays: 0 }),
        })
      ).status,
      400,
    );
    assert.equal(app.store.settings().exchangeWindowDays, 7);
  } finally {
    await app.close();
  }
});
