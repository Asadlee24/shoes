import { randomUUID } from "node:crypto";
import { HttpError, requiredText } from "./store.mjs";
import { validateReceipt } from "./customer.mjs";
const fail = (code, text) => {
  throw new HttpError(code, text);
};
export function trackingInput(input) {
  const courier = requiredText(input.courier, "Courier", 80);
  const number = requiredText(input.number, "Tracking number", 120);
  const url = String(input.url || "").trim();
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      fail(400, "Enter a valid HTTPS tracking link.");
    }
    if (
      url.length > 1000 ||
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      /[\x00-\x20]/.test(url)
    )
      fail(400, "Enter a valid HTTPS tracking link.");
  }
  return { courier, number, url, updated: new Date().toISOString() };
}
export function salesSummary(rows, products, time = Date.now()) {
  const orders = rows
    .map((r) => ({
      ...r,
      data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
    }))
    .filter(
      (r) =>
        r.kind === "order" && r.status !== "cancelled" && !r.data.archivedAt,
    );
  const paid = orders.filter(
    (r) =>
      r.data.payment?.status === "paid" ||
      (r.data.payment?.method === "cod" && r.status === "delivered"),
  );
  const month = new Date(time).toISOString().slice(0, 7);
  const value = (r) =>
    Number.isSafeInteger(r.data.totals?.total) ? r.data.totals.total : 0;
  const revenue = paid.reduce((sum, r) => sum + value(r), 0);
  return {
    revenue,
    monthRevenue: paid
      .filter((r) => r.created.startsWith(month))
      .reduce((sum, r) => sum + value(r), 0),
    paidOrders: paid.length,
    activeOrders: orders.filter((r) => r.status !== "delivered").length,
    deliveredOrders: orders.filter((r) => r.status === "delivered").length,
    average: paid.length ? Math.round(revenue / paid.length) : 0,
    threshold: 2,
    lowStock: products
      .filter((p) => p.published)
      .flatMap((p) =>
        (p.sizes || [])
          .filter(
            (size) =>
              Number.isInteger(p.stockBySize?.[size]) &&
              p.stockBySize[size] <= 2,
          )
          .map((size) => ({
            id: p.id,
            name: p.name,
            size,
            quantity: p.stockBySize[size],
          })),
      ),
  };
}
export function commerceApi({
  store,
  body,
  json,
  customers,
  notifications,
  limited,
}) {
  const db = store.db;
  async function photos(review) {
    return (
      await db
        .prepare("SELECT id FROM review_photos WHERE review_id=?")
        .all(review.id)
    ).map((p) => p.id);
  }
  async function list(rows) {
    return Promise.all(
      rows.map(async (r) => ({ ...r, photos: await photos(r) })),
    );
  }
  async function image(res, row) {
    if (!row) fail(404, "Photo not found.");
    res.writeHead(200, {
      "Content-Type": row.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(Buffer.from(row.data));
  }
  async function publicRoute(req, res, path) {
    const m = path.match(/^\/api\/products\/([^/]+)\/reviews$/);
    if (req.method === "GET" && m) {
      const p = await store.product(m[1]);
      if (!p?.published) fail(404, "Product not found.");
      const rows = await db
        .prepare(
          "SELECT id,product_id,rating,body,display_name,created FROM reviews WHERE product_id=? AND status='approved' ORDER BY created DESC LIMIT 100",
        )
        .all(p.id);
      const stats = await db
        .prepare(
          "SELECT COUNT(*) AS count,AVG(rating) AS average FROM reviews WHERE product_id=? AND status='approved'",
        )
        .get(p.id);
      json(res, 200, {
        reviews: await list(rows),
        count: Number(stats.count),
        average: Number(stats.average || 0),
      });
      return true;
    }
    const photo = path.match(/^\/api\/review-photos\/([\da-f-]+)$/);
    if (req.method === "GET" && photo) {
      const row = await db
        .prepare(
          "SELECT p.type,p.data,r.product_id FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE p.id=? AND r.status='approved'",
        )
        .get(photo[1]);
      if (!row || !(await store.product(row.product_id))?.published)
        fail(404, "Photo not found.");
      await image(res, row);
      return true;
    }
    return false;
  }
  async function account(req, res, path) {
    const match = path.match(/^\/api\/account\/orders\/([^/]+)\/reviews$/);
    if (!match) return false;
    const session = await customers.requireSession(req, req.method !== "GET");
    const order = await db
      .prepare(
        "SELECT r.* FROM requests r JOIN customer_orders o ON o.request_id=r.id WHERE r.id=? AND o.user_id=?",
      )
      .get(match[1], session.user.id);
    if (!order) fail(404, "Order not found.");
    if (req.method === "GET") {
      json(res, 200, {
        reviews: await list(
          await db
            .prepare(
              "SELECT id,product_id,rating,body,display_name,status,created FROM reviews WHERE request_id=? AND user_id=?",
            )
            .all(order.id, session.user.id),
        ),
      });
      return true;
    }
    if (req.method !== "POST") fail(405, "Method not allowed.");
    await limited(`review:${session.user.id}`, 6, 15);
    const data = JSON.parse(order.data);
    if (
      order.kind !== "order" ||
      order.status !== "delivered" ||
      data.archivedAt ||
      !(data.payment?.status === "paid" || data.payment?.method === "cod")
    )
      fail(409, "Reviews are available after your paid order is delivered.");
    const input = await body(req, 3000000);
    if (!data.items.some((i) => i.id === input.productId))
      fail(400, "Choose a product from this order.");
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      fail(400, "Choose a rating from 1 to 5.");
    if (input.consent !== true)
      fail(400, "Please agree to publish your review and selected photos.");
    const text = requiredText(input.body, "Review", 2000),
      name = requiredText(input.displayName, "Public name", 60);
    if (!Array.isArray(input.photos) || input.photos.length > 2)
      fail(400, "Choose up to two photos.");
    const media = input.photos.map((p) => {
      let bytes;
      try {
        bytes = validateReceipt(p);
      } catch {
        fail(400, "Choose a valid JPG, PNG or WebP photo.");
      }
      if (bytes.length > 1000000)
        fail(400, "Each photo must be smaller than 1 MB.");
      return { type: p.type, bytes };
    });
    await db.exec("BEGIN IMMEDIATE");
    try {
      if (
        await db
          .prepare(
            "SELECT id FROM reviews WHERE request_id=? AND product_id=? AND user_id=?",
          )
          .get(order.id, input.productId, session.user.id)
      )
        fail(409, "You have already reviewed this pair from this order.");
      const id = randomUUID(),
        created = new Date().toISOString();
      await db
        .prepare(
          "INSERT INTO reviews(id,request_id,product_id,user_id,rating,body,display_name,status,created) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          order.id,
          input.productId,
          session.user.id,
          input.rating,
          text,
          name,
          "pending",
          created,
        );
      for (const p of media)
        await db
          .prepare(
            "INSERT INTO review_photos(id,review_id,type,data,created) VALUES(?,?,?,?,?)",
          )
          .run(randomUUID(), id, p.type, p.bytes, created);
      await db.exec("COMMIT");
      json(res, 201, { ok: true });
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
    return true;
  }
  async function admin(req, res, path) {
    if (req.method === "GET" && path === "/api/admin/sales") {
      json(
        res,
        200,
        salesSummary(
          await db
            .prepare("SELECT kind,status,data,created FROM requests")
            .all(),
          await store.products(),
        ),
      );
      return true;
    }
    if (req.method === "GET" && path === "/api/admin/reviews") {
      json(res, 200, {
        reviews: await list(
          await db
            .prepare("SELECT * FROM reviews ORDER BY created DESC LIMIT 200")
            .all(),
        ),
      });
      return true;
    }
    const photo = path.match(/^\/api\/admin\/review-photos\/([\da-f-]+)$/);
    if (req.method === "GET" && photo) {
      await image(
        res,
        await db
          .prepare("SELECT type,data FROM review_photos WHERE id=?")
          .get(photo[1]),
      );
      return true;
    }
    const review = path.match(/^\/api\/admin\/reviews\/([\da-f-]+)$/);
    if (req.method === "PATCH" && review) {
      const input = await body(req);
      if (!["approved", "rejected"].includes(input.status))
        fail(400, "Choose approve or hide.");
      const r = await db
        .prepare("UPDATE reviews SET status=? WHERE id=? RETURNING id")
        .get(input.status, review[1]);
      if (!r) fail(404, "Review not found.");
      json(res, 200, { ok: true });
      return true;
    }
    const tracking = path.match(/^\/api\/admin\/requests\/([^/]+)\/tracking$/);
    if (req.method === "PUT" && tracking) {
      const row = await db
        .prepare("SELECT * FROM requests WHERE id=?")
        .get(tracking[1]);
      if (!row) fail(404, "Order not found.");
      const data = JSON.parse(row.data);
      if (
        row.kind !== "order" ||
        row.status === "cancelled" ||
        data.archivedAt ||
        !(data.payment?.status === "paid" || data.payment?.method === "cod")
      )
        fail(409, "Add tracking to an active, paid order.");
      const value = trackingInput(await body(req));
      if (
        JSON.stringify([
          data.tracking?.courier,
          data.tracking?.number,
          data.tracking?.url,
        ]) !== JSON.stringify([value.courier, value.number, value.url])
      ) {
        data.tracking = value;
        await db.exec("BEGIN IMMEDIATE");
        try {
          await db
            .prepare("UPDATE requests SET data=? WHERE id=?")
            .run(JSON.stringify(data), row.id);
          await notifications.customerOrder(
            "tracking_updated",
            row.id,
            randomUUID(),
          );
          await db.exec("COMMIT");
        } catch (e) {
          await db.exec("ROLLBACK");
          throw e;
        }
      }
      json(res, 200, { request: { ...row, data } });
      return true;
    }
    return false;
  }
  return { publicRoute, account, admin };
}
