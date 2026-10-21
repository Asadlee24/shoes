import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { HttpError, requiredText } from "./store.mjs";
const derive = promisify(scrypt);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const passwordDigest = async (value) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(value, salt, 64)).toString("hex")}`;
};
const verify = async (value, stored) => {
  if (typeof value !== "string" || value.length > 200) return false;
  const [salt, digest] = stored.split(":");
  const expected = Buffer.from(digest, "hex");
  const actual = await derive(value, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
const passwordInput = (value) => {
  if (typeof value !== "string" || value.length < 12 || value.length > 200)
    throw new HttpError(400, "Use a password between 12 and 200 characters.");
  return value;
};
const emailInput = (value) => {
  const email = requiredText(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "Enter a valid email address.");
  return email;
};
const profile = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  city: row.city,
  address: row.address,
});
export function paymentDetails(settings, method) {
  return method === "bank"
    ? {
        holder: settings.bankAccountHolder,
        iban: settings.bankIban,
        account: settings.bankAccountNumber,
      }
    : method === "easypaisa"
      ? { holder: settings.easypaisaHolder, number: settings.easypaisaNumber }
      : null;
}
export function validateReceipt(input) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(input.type) ||
    typeof input.data !== "string" ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)
  )
    throw new HttpError(400, "Choose a JPG, PNG or WebP receipt.");
  const data = Buffer.from(input.data, "base64");
  if (data.length < 12 || data.length > 2000000)
    throw new HttpError(400, "Receipt images must be smaller than 2 MB.");
  const valid =
    input.type === "image/jpeg"
      ? data[0] === 255 && data[1] === 216 && data[2] === 255
      : input.type === "image/png"
        ? data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.toString("ascii", 0, 4) === "RIFF" &&
          data.toString("ascii", 8, 12) === "WEBP";
  if (!valid)
    throw new HttpError(400, "The receipt image format could not be verified.");
  return data;
}
export function customerApi({
  store,
  body,
  json,
  limited,
  secureCookies,
  notifications,
}) {
  const db = store.db;
  const cookie = (res, token, age = 604800) =>
    res.setHeader(
      "Set-Cookie",
      `qf_customer=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureCookies ? "; Secure" : ""}`,
    );
  async function sessionFor(req) {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("qf_customer="))
      ?.slice(12);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await db
      .prepare("SELECT * FROM customer_sessions WHERE token=? AND expires>?")
      .get(hash(token), Date.now());
    if (!session) return null;
    const user = await db
      .prepare("SELECT * FROM customers WHERE id=?")
      .get(session.user_id);
    return user ? { ...session, user } : null;
  }
  async function requireSession(req, mutation = false) {
    const session = await sessionFor(req);
    if (!session) throw new HttpError(401, "Please sign in to your account.");
    if (mutation && req.headers["x-customer-csrf"] !== session.csrf)
      throw new HttpError(
        403,
        "Your session has changed. Please refresh and try again.",
      );
    return session;
  }
  async function issue(res, user, extra = {}) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    await db
      .prepare("DELETE FROM customer_sessions WHERE expires<?")
      .run(Date.now());
    await db
      .prepare(
        "INSERT INTO customer_sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)",
      )
      .run(hash(token), user.id, csrf, Date.now() + 604800000);
    cookie(res, token);
    return json(res, 200, { user: profile(user), csrf, ...extra });
  }
  async function handle(req, res, path, ip) {
    const method = req.method;
    if (!path.startsWith("/api/account/")) return false;
    if (
      method === "POST" &&
      [
        "/api/account/register",
        "/api/account/login",
        "/api/account/recover",
      ].includes(path)
    ) {
      await limited(`customer-auth:${ip}`, 12, 15);
      const input = await body(req);
      const email = emailInput(input.email);
      await limited(`customer-email:${email}`, 10, 15);
      if (path.endsWith("/register")) {
        const name = requiredText(input.name, "Your name", 80);
        const digest = await passwordDigest(passwordInput(input.password));
        if (
          await db.prepare("SELECT id FROM customers WHERE email=?").get(email)
        )
          throw new HttpError(
            409,
            "An account with this email already exists. Sign in or use your recovery code.",
          );
        const recoveryCode = randomBytes(20).toString("hex");
        const user = {
          id: randomUUID(),
          email,
          name,
          phone: "",
          city: "",
          address: "",
        };
        await db
          .prepare(
            "INSERT INTO customers(id,email,name,phone,city,address,password_hash,recovery_hash,created) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .run(
            user.id,
            email,
            name,
            "",
            "",
            "",
            digest,
            hash(recoveryCode),
            new Date().toISOString(),
          );
        return issue(res, user, { recoveryCode });
      }
      const user = await db
        .prepare("SELECT * FROM customers WHERE email=?")
        .get(email);
      if (path.endsWith("/recover")) {
        const code =
          typeof input.recoveryCode === "string"
            ? input.recoveryCode.trim().toLowerCase()
            : "";
        if (
          !user ||
          !/^[a-f0-9]{40}$/.test(code) ||
          !timingSafeEqual(
            Buffer.from(hash(code), "hex"),
            Buffer.from(user.recovery_hash, "hex"),
          )
        )
          throw new HttpError(401, "The email or recovery code is incorrect.");
        const digest = await passwordDigest(passwordInput(input.password));
        const recoveryCode = randomBytes(20).toString("hex");
        await db.exec("BEGIN IMMEDIATE");
        try {
          const latest = await db
            .prepare("SELECT recovery_hash FROM customers WHERE id=?")
            .get(user.id);
          if (latest.recovery_hash !== user.recovery_hash)
            throw new HttpError(
              401,
              "This recovery code has already been used.",
            );
          await db
            .prepare(
              "UPDATE customers SET password_hash=?,recovery_hash=? WHERE id=?",
            )
            .run(digest, hash(recoveryCode), user.id);
          await db
            .prepare("DELETE FROM customer_sessions WHERE user_id=?")
            .run(user.id);
          await db.exec("COMMIT");
        } catch (error) {
          await db.exec("ROLLBACK");
          throw error;
        }
        return issue(res, user, { recoveryCode });
      }
      // Derive a dummy digest for unknown accounts, keeping failure work comparable.
      const stored =
        user?.password_hash ||
        `00000000000000000000000000000000:${"0".repeat(128)}`;
      if (!(await verify(input.password, stored)) || !user)
        throw new HttpError(401, "The email or password is incorrect.");
      const latest = await db
        .prepare("SELECT * FROM customers WHERE id=?")
        .get(user.id);
      if (latest.password_hash !== stored)
        throw new HttpError(
          401,
          "Your password has changed. Please sign in again.",
        );
      return issue(res, latest);
    }
    const session = await requireSession(
      req,
      !["GET", "HEAD"].includes(method),
    );
    if (method === "GET" && path === "/api/account/session")
      return json(res, 200, {
        user: profile(session.user),
        csrf: session.csrf,
      });
    if (method === "POST" && path === "/api/account/logout") {
      await db
        .prepare("DELETE FROM customer_sessions WHERE token=?")
        .run(session.token);
      cookie(res, "", 0);
      return json(res, 200, { ok: true });
    }
    if (method === "PUT" && path === "/api/account/profile") {
      const input = await body(req);
      const name = requiredText(input.name, "Name", 80);
      const phone =
        typeof input.phone === "string"
          ? input.phone.replace(/[\s()-]/g, "")
          : "";
      if (phone && !/^(?:\+92|0092|92|0)3\d{9}$/.test(phone))
        throw new HttpError(400, "Enter a valid Pakistani mobile number.");
      const city = String(input.city || "")
          .trim()
          .slice(0, 80),
        address = String(input.address || "")
          .trim()
          .slice(0, 500);
      await db
        .prepare(
          "UPDATE customers SET name=?,phone=?,city=?,address=? WHERE id=?",
        )
        .run(name, phone, city, address, session.user.id);
      return json(res, 200, {
        user: profile({ ...session.user, name, phone, city, address }),
      });
    }
    if (method === "POST" && path === "/api/account/password") {
      await limited(`customer-password:${session.user.id}`, 6, 15);
      const input = await body(req);
      if (!(await verify(input.currentPassword, session.user.password_hash)))
        throw new HttpError(401, "Your current password is incorrect.");
      const digest = await passwordDigest(passwordInput(input.password));
      await db.exec("BEGIN IMMEDIATE");
      try {
        const latest = await db
          .prepare("SELECT password_hash FROM customers WHERE id=?")
          .get(session.user.id);
        if (latest.password_hash !== session.user.password_hash)
          throw new HttpError(
            401,
            "Your password has changed. Please sign in again.",
          );
        await db
          .prepare("UPDATE customers SET password_hash=? WHERE id=?")
          .run(digest, session.user.id);
        await db
          .prepare("DELETE FROM customer_sessions WHERE user_id=?")
          .run(session.user.id);
        await db.exec("COMMIT");
      } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
      }
      return issue(res, session.user);
    }
    if (method === "GET" && path === "/api/account/orders") {
      const orders = await db
        .prepare(
          "SELECT r.id,r.kind,r.status,r.data,r.created FROM requests r JOIN customer_orders o ON o.request_id=r.id WHERE o.user_id=? ORDER BY r.created DESC LIMIT 100",
        )
        .all(session.user.id);
      return json(res, 200, {
        orders: orders
          .map((row) => ({ ...row, data: JSON.parse(row.data) }))
          .filter((order) => !order.data.archivedAt),
      });
    }
    const receiptMatch = path.match(/^\/api\/account\/orders\/([^/]+)\/proof$/);
    if (method === "POST" && receiptMatch) {
      await limited(`customer-proof:${session.user.id}`, 8, 15);
      const input = await body(req, 2900000);
      const order = await db
        .prepare(
          "SELECT r.* FROM requests r JOIN customer_orders o ON o.request_id=r.id WHERE r.id=? AND o.user_id=?",
        )
        .get(receiptMatch[1], session.user.id);
      if (!order) throw new HttpError(404, "Order not found.");
      const data = JSON.parse(order.data);
      if (
        data.archivedAt ||
        order.kind !== "order" ||
        order.status === "cancelled" ||
        !["bank", "easypaisa"].includes(data.payment?.method)
      )
        throw new HttpError(
          409,
          "Wait for the store to confirm this order before paying.",
        );
      if (["paid", "under_review"].includes(data.payment.status))
        throw new HttpError(
          409,
          "Your receipt is already submitted. Wait for the store to review it.",
        );
      const receipt = validateReceipt(input);
      const reference = requiredText(
        input.reference,
        "Transaction reference",
        100,
      );
      const count = await db
        .prepare(
          "SELECT COUNT(*) AS count FROM payment_proofs WHERE request_id=?",
        )
        .get(order.id);
      if (Number(count.count) >= 5)
        throw new HttpError(
          409,
          "Please contact the store for help with this payment.",
        );
      const id = randomUUID();
      await db.exec("BEGIN IMMEDIATE");
      try {
        await db
          .prepare(
            "INSERT INTO payment_proofs(id,request_id,user_id,type,data,reference,status,note,created,reviewed) VALUES(?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            order.id,
            session.user.id,
            input.type,
            receipt,
            reference,
            "pending",
            "",
            new Date().toISOString(),
            "",
          );
        data.payment = {
          ...data.payment,
          status: "under_review",
          proofId: id,
          reference,
          note: "",
        };
        await db
          .prepare("UPDATE requests SET data=? WHERE id=?")
          .run(JSON.stringify(data), order.id);
        await notifications.enqueue("payment_submitted", order.id, id);
        await db.exec("COMMIT");
      } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
      }
      return json(res, 201, { ok: true });
    }
    const imageMatch = path.match(/^\/api\/account\/proofs\/([\da-f-]+)$/);
    if (["GET", "HEAD"].includes(method) && imageMatch) {
      const proof = await db
        .prepare(
          "SELECT type,data FROM payment_proofs WHERE id=? AND user_id=?",
        )
        .get(imageMatch[1], session.user.id);
      if (!proof) throw new HttpError(404, "Receipt not found.");
      res.writeHead(200, {
        "Content-Type": proof.type,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(method === "HEAD" ? undefined : Buffer.from(proof.data));
      return;
    }
    throw new HttpError(404, "Account action not found.");
  }
  return { handle, sessionFor, requireSession };
}
