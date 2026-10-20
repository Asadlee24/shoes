import { HttpError, validateItems, totalsFor } from "./store.mjs";
import { paymentDetails } from "./customer.mjs";
export function paymentAdminApi({ store, body, json }) {
  return async function (req, res, path) {
    const image = path.match(/^\/api\/admin\/proofs\/([\da-f-]+)$/);
    if (image && ["GET", "HEAD"].includes(req.method)) {
      const proof = await store.db
        .prepare("SELECT type,data FROM payment_proofs WHERE id=?")
        .get(image[1]);
      if (!proof) throw new HttpError(404, "Receipt not found.");
      res.writeHead(200, {
        "Content-Type": proof.type,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : Buffer.from(proof.data));
      return true;
    }
    const review = path.match(/^\/api\/admin\/payments\/([\da-f-]+)$/);
    if (review && req.method === "PATCH") {
      const input = await body(req);
      if (!["approved", "rejected"].includes(input.status))
        throw new HttpError(400, "Approve or reject this payment proof.");
      const proof = await store.db
        .prepare("SELECT request_id,status FROM payment_proofs WHERE id=?")
        .get(review[1]);
      if (!proof) throw new HttpError(404, "Receipt not found.");
      const order = await store.db
        .prepare("SELECT * FROM requests WHERE id=?")
        .get(proof.request_id);
      const data = JSON.parse(order.data);
      if (order.status === "cancelled")
        throw new HttpError(
          409,
          "This order is cancelled. Contact the customer to resolve any transfer.",
        );
      if (data.payment?.proofId !== review[1] || proof.status !== "pending")
        throw new HttpError(
          409,
          "This receipt has already been reviewed or replaced. Refresh the order.",
        );
      const note = String(input.note || "")
        .trim()
        .slice(0, 500);
      if (input.status === "rejected" && !note)
        throw new HttpError(
          400,
          "Add a reason so the customer can correct the payment proof.",
        );
      await store.db.exec("BEGIN IMMEDIATE");
      try {
        await store.db
          .prepare(
            "UPDATE payment_proofs SET status=?,note=?,reviewed=? WHERE id=?",
          )
          .run(input.status, note, new Date().toISOString(), review[1]);
        data.payment = {
          ...data.payment,
          status: input.status === "approved" ? "paid" : "rejected",
          note,
        };
        await store.db
          .prepare("UPDATE requests SET data=? WHERE id=?")
          .run(JSON.stringify(data), order.id);
        await store.db.exec("COMMIT");
      } catch (error) {
        await store.db.exec("ROLLBACK");
        throw error;
      }
      json(res, 200, { request: { ...order, data } });
      return true;
    }
    const confirm = path.match(/^\/api\/admin\/requests\/([^/]+)\/confirm$/);
    if (confirm && req.method === "POST") {
      const input = await body(req);
      const order = await store.db
        .prepare("SELECT * FROM requests WHERE id=?")
        .get(confirm[1]);
      if (!order) throw new HttpError(404, "Request not found.");
      if (order.kind !== "inquiry" || order.status === "resolved")
        throw new HttpError(409, "Only an open enquiry can be confirmed.");
      const owner = await store.db
        .prepare("SELECT user_id FROM customer_orders WHERE request_id=?")
        .get(order.id);
      if (!owner)
        throw new HttpError(
          409,
          "Ask this guest to place a new request from their account.",
        );
      const data = JSON.parse(order.data),
        settings = await store.settings();
      const method = input.method || data.payment?.method;
      if (!["bank", "easypaisa", "cod"].includes(method))
        throw new HttpError(400, "Choose a payment method.");
      if (
        (method === "cod" && !settings.codEnabled) ||
        (method === "bank" &&
          (!settings.bankIban || !settings.bankAccountHolder)) ||
        (method === "easypaisa" &&
          (!settings.easypaisaNumber || !settings.easypaisaHolder))
      )
        throw new HttpError(
          409,
          "Configure this payment method in Store settings first.",
        );
      const items = await validateItems(store, data.items);
      const totals = totalsFor(items, settings, data.discountCode || "");
      if (totals.total === null || items.some((i) => i.stock === null))
        throw new HttpError(
          409,
          "Set product prices, size stock and delivery fee in Store settings first.",
        );
      await store.db.exec("BEGIN IMMEDIATE");
      try {
        for (const item of items) {
          const product = await store.product(item.id);
          if (product.stockBySize[item.size] < item.quantity)
            throw new HttpError(
              409,
              `${product.name}, size ${item.size}, does not have enough stock.`,
            );
          product.stockBySize[item.size] -= item.quantity;
          if (product.stock !== null) product.stock -= item.quantity;
          await store.saveProduct(product);
        }
        data.items = items.map(({ stock, ...item }) => item);
        data.totals = totals;
        data.payment = {
          method,
          status: method === "cod" ? "cod" : "awaiting_payment",
          recipient: paymentDetails(settings, method),
        };
        await store.db
          .prepare("UPDATE requests SET kind=?,status=?,data=? WHERE id=?")
          .run("order", "pending", JSON.stringify(data), order.id);
        await store.db.exec("COMMIT");
      } catch (error) {
        await store.db.exec("ROLLBACK");
        throw error;
      }
      json(res, 200, {
        request: { ...order, kind: "order", status: "pending", data },
      });
      return true;
    }
    return false;
  };
}
