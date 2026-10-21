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
        const rendered = await renderOwnerEmail(JSON.parse(row.payload));
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
            "UPDATE email_outbox SET status='sent',provider_id=?,last_error='' WHERE id=?",
          )
          .run(result.data.id, row.id);
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
  return { enqueue, status, flush, retry, test, configured };
}
