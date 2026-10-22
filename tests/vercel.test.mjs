import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../api/catalog.js";
import unavailable from "../api/unavailable.js";

function response() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.data = value;
      return this;
    },
  };
}

test("Vercel catalog exposes approved published products without private settings or COD", () => {
  const res = response();
  catalog({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.products.length, 8);
  assert.equal(
    res.data.products.find((p) => p.id === "textured-bit").price,
    220000,
  );
  assert.equal(
    res.data.products.some((p) => p.id === "brown-textured"),
    true,
  );
  assert.equal("discounts" in res.data.settings, false);
  assert.equal("orderNotificationEmail" in res.data.settings, false);
  assert.equal(res.data.settings.codEnabled, false);
});

test("Vercel catalog rejects mutations and unavailable APIs never confirm an order", () => {
  const res = response();
  catalog({ method: "POST" }, res);
  assert.equal(res.statusCode, 405);
  const offline = response();
  unavailable({ method: "POST" }, offline);
  assert.equal(offline.statusCode, 503);
  assert.equal("reference" in offline.data, false);
  assert.match(offline.data.error, /WhatsApp/);
});
