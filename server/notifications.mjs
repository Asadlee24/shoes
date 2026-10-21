import { createHash, randomUUID } from "node:crypto";
import { Resend } from "resend";
import { HttpError } from "./store.mjs";
import { emailEvents, renderOwnerEmail } from "./emails.mjs";

const validEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const retryWindow = 23 * 3600000;
export function createNotifications(store, options = {}) {
  const key = options.apiKey ?? process.env.RESEND_API_KEY ?? "";
  const from =
    options.from ??
    process.env.RESEND_FROM ??
    "Qadam Flex <orders@qadamflex.bond>";
  const senderAddress = from.match(/<([^<>]+)>$/)?.[1] || from;
  const configured = Boolean(
    (key || options.send) && validEmail(senderAddress) && !/[\r\n]/.test(from),
  );
  const client = key ? new Resend(key) : null;
  const send =
    options.send ||
    ((message, id) =>
      client.emails.send(message, {
        idempotencyKey: id,
        signal: AbortSignal.timeout(8000),
      }));
  const now = options.now || Date.now;
  let flushing;

  async function enqueue(event, reference = "", eventKey = reference) {
    if (!emailEvents[event]) throw new Error("Unknown email event.");
    const settings = await store.settings();
    const recipient = settings.orderNotificationEmail?.trim();
    await customerOrder(event, reference, eventKey);
    if (!validEmail(recipient)) return null;
    const row = reference
      ? await store.db
          .prepare("SELECT kind,status,data FROM requests WHERE id=?")
          .get(reference)
      : null;
    const data = row ? JSON.parse(row.data) : {};
    // Send only the information needed for the alert. Addresses, bank details,
    // account credentials, receipt bytes and private proof URLs stay in admin.
    const payload = {
      event,
      reference,
      status: row?.status || "",
      customer: {
        name: data.customer?.name || "",
        city: data.customer?.city || "",
      },
      items: (data.items || []).map(({ name, size, quantity, price }) => ({
        name,
        size,
        quantity,
        price,
      })),
      totals: data.totals,
      payment: data.payment
        ? { method: data.payment.method, status: data.payment.status }
        : null,
      message:
        event === "support_message"
          ? String(data.customer?.notes || "").slice(0, 1500)
          : "",
    };
    const id = createHash("sha256")
      .update(`${event}:${eventKey || randomUUID()}`)
      .digest("hex");
    await store.db
      .prepare(
        "INSERT INTO email_outbox(id,event,request_id,recipient,payload,status,attempts,next_attempt,first_attempt,created,provider_id,last_error) VALUES(?,?,?,?,?,'pending',0,?,0,?,'','') ON CONFLICT(id) DO NOTHING",
      )
      .run(
        id,
        event,
        reference,
        recipient,
        JSON.stringify(payload),
        now(),
        new Date(now()).toISOString(),
      );
    return id;
  }
  async function queueMail(recipient, payload, key) {
    if (!validEmail(recipient)) return null;
    const id = createHash("sha256").update(key).digest("hex");
    await store.db
      .prepare(
        "INSERT INTO email_outbox(id,event,request_id,recipient,payload,status,attempts,next_attempt,first_attempt,created,provider_id,last_error) VALUES(?,?,?,?,?,'pending',0,?,0,?,'','') ON CONFLICT(id) DO NOTHING",
      )
      .run(
        id,
        payload.event,
        payload.reference || "",
        recipient,
        JSON.stringify(payload),
        now(),
        new Date(now()).toISOString(),
      );
    return id;
  }
  async function accountMail(user, kind, token, expires) {
    return queueMail(
      user.email,
      {
        event: kind,
        audience: "customer",
        customer: { name: user.name },
        actionUrl: `https://www.qadamflex.bond/account#${kind === "password_reset" ? "reset" : "verify"}=${token}`,
        expires,
      },
      `${kind}:${token}`,
    );
  }
  async function customerOrder(event, reference, eventKey = reference) {
    if (
      ![
        "new_order",
        "new_enquiry",
        "order_confirmed",
        "status_changed",
        "payment_approved",
        "payment_rejected",
        "tracking_updated",
      ].includes(event) ||
      !reference
    )
      return;
    const row = await store.db
      .prepare(
        "SELECT c.email,c.name,r.data,r.status FROM customer_orders o JOIN customers c ON c.id=o.user_id JOIN customer_email_verifications v ON v.user_id=c.id JOIN requests r ON r.id=o.request_id WHERE o.request_id=?",
      )
      .get(reference);
    if (!row) return;
    const data = JSON.parse(row.data);
    if (data.archivedAt) return;
    return queueMail(
      row.email,
      {
        event,
        audience: "customer",
        reference,
        status: row.status,
        customer: { name: row.name },
        items: data.items?.map(({ name, size, quantity, price }) => ({
          name,
          size,
          quantity,
          price,
        })),
        totals: data.totals,
        payment: data.payment
          ? { method: data.payment.method, status: data.payment.status }
          : null,
        message:
          event === "tracking_updated"
            ? `${data.tracking.courier} · ${data.tracking.number}. Open your account to track delivery.`
            : "",
      },
      `customer:${event}:${eventKey}`,
    );
  }
  async function checkStock(product) {
    if (!product.published) return;
    for (const size of product.sizes || []) {
      const count = product.stockBySize?.[size];
      if (!Number.isInteger(count)) continue;
      const id = `${product.id}:${size}`,
        low = count <= 2 ? 1 : 0;
      const previous = await store.db
        .prepare("SELECT low,revision FROM stock_alert_state WHERE id=?")
        .get(id);
      const revision =
        Number(previous?.revision || 0) + (low && !previous?.low ? 1 : 0);
      await store.db
        .prepare(
          "INSERT INTO stock_alert_state(id,low,revision) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET low=excluded.low,revision=excluded.revision",
        )
        .run(id, low, revision);
      if (low && !previous?.low) {
        const settings = await store.settings();
        await queueMail(
          settings.orderNotificationEmail,
          {
            event: "low_stock",
            message: `${product.name} · Size ${size} · ${count} remaining. Restock this size in Collection.`,
            customer: {},
          },
          `stock:${id}:${revision}`,
        );
      }
    }
  }
  async function status() {
    const settings = await store.settings();
    const counts = { pending: 0, sending: 0, sent: 0, failed: 0, unknown: 0 };
    for (const row of await store.db
      .prepare(
        "SELECT status,COUNT(*) AS count FROM email_outbox GROUP BY status",
      )
      .all())
      counts[row.status] = Number(row.count);
    const recent = await store.db
      .prepare(
        "SELECT id,event,request_id,recipient,status,attempts,created,provider_id,last_error FROM email_outbox ORDER BY created DESC,id DESC LIMIT 8",
      )
      .all();
    return {
      configured,
      from,
      recipient: settings.orderNotificationEmail || "",
      counts,
      recent,
    };
  }
  async function drain(limit = 3) {
    if (!configured) return;
    for (let i = 0; i < limit; i++) {
      const time = now();
      // One atomic claim works across independent serverless instances. A lease
      // recovers interrupted sends; Resend receives the same idempotency key.
      const row = await store.db
        .prepare(
          "UPDATE email_outbox SET status='sending',attempts=attempts+1,next_attempt=?,first_attempt=CASE WHEN first_attempt=0 THEN ? ELSE first_attempt END WHERE id=(SELECT id FROM email_outbox WHERE status IN ('pending','sending') AND next_attempt<=? ORDER BY created,id LIMIT 1) AND next_attempt<=? RETURNING *",
        )
        .get(time + 90000, time, time, time);
      if (!row) break;
      const attempt = Number(row.attempts);
      if (time - Number(row.first_attempt) >= retryWindow) {
        await store.db
          .prepare(
            "UPDATE email_outbox SET status='unknown',last_error=? WHERE id=?",
          )
          .run(
            "Delivery is unconfirmed. Check Resend before sending this alert again.",
            row.id,
          );
        continue;
      }
      let result;
      try {
        const payload = JSON.parse(row.payload);
        if (payload.expires && payload.expires <= time) {
          await store.db
            .prepare(
              "UPDATE email_outbox SET status='failed',payload='{}',last_error='This account link expired. Request a new link.' WHERE id=?",
            )
            .run(row.id);
          continue;
        }
        const rendered = await renderOwnerEmail(payload);
        result = await send(
          { from, to: [row.recipient], ...rendered },
          `qadam-${row.id}`,
        );
      } catch {
        result = { error: { statusCode: null } };
      }
      if (result?.data?.id && !result.error) {
        await store.db
          .prepare(
            "UPDATE email_outbox SET status='sent',provider_id=?,last_error='',payload=? WHERE id=?",
          )
          .run(
            result.data.id,
            JSON.parse(row.payload).actionUrl ? "{}" : row.payload,
            row.id,
          );
      } else {
        const code = Number(result?.error?.statusCode || 0);
        const retryable = !code || code === 429 || code >= 500;
        const message =
          code === 401
            ? "Resend rejected the API key. Update the private Vercel key and redeploy."
            : code === 403
              ? "Check Resend sending permissions and sender-domain verification."
              : code === 429
                ? "Email rate limit reached. This alert is waiting to retry."
                : retryable
                  ? "The email service could not confirm sending. This alert is waiting to retry."
                  : "The email service rejected this alert. Check the sender configuration.";
        await store.db
          .prepare(
            "UPDATE email_outbox SET status=?,next_attempt=?,last_error=? WHERE id=?",
          )
          .run(
            retryable && attempt < 5 ? "pending" : "failed",
            now() + Math.min(30000 * 2 ** (attempt - 1), 3600000),
            message,
            row.id,
          );
      }
    }
  }
  async function flush(limit = 3) {
    if (!flushing)
      flushing = drain(limit).finally(() => {
        flushing = undefined;
      });
    return flushing;
  }
  async function retry() {
    // Keep original attempt time and idempotency key, including manual retries.
    await store.db
      .prepare(
        "UPDATE email_outbox SET status='pending',attempts=0,next_attempt=? WHERE status='failed' AND first_attempt>?",
      )
      .run(now(), now() - retryWindow);
  }
  async function test(eventKey = randomUUID()) {
    if (!configured)
      throw new HttpError(
        503,
        "Add a private RESEND_API_KEY to Vercel Production and redeploy first.",
      );
    const id = await enqueue("test", "", eventKey);
    if (!id)
      throw new HttpError(
        400,
        "Save a valid private notification email first.",
      );
    return id;
  }
  return {
    enqueue,
    status,
    flush,
    retry,
    test,
    configured,
    accountMail,
    customerOrder,
    checkStock,
  };
}
