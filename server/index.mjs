import http from "node:http";
import { publicSettings } from "./catalog.mjs";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import {
  openStore,
  HttpError,
  requiredText,
  validateCustomer,
  validateItems,
  totalsFor,
  validateProduct,
} from "./store.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const hash = (v) => createHash("sha256").update(v).digest("hex");
export function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password, stored) {
  try {
    const [salt, digest] = stored.split(":");
    const a = Buffer.from(digest, "hex"),
      b = scryptSync(password, salt, 64);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function body(req, limit = 200000) {
  // Vercel may parse JSON before handing the request to the function.
  if (req.body !== undefined) {
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > limit)
      throw new HttpError(413, "This request is too large.");
    try {
      return JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid JSON request.");
    }
  }
  let size = 0;
  const parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > limit) throw new HttpError(413, "This request is too large.");
    parts.push(part);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString() || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
}
export async function createApplication(options = {}) {
  const store =
    options.store ||
    openStore(
      options.dbPath ||
        process.env.DATABASE_PATH ||
        join(root, "data", "store.db"),
    );
  const adminUser = options.adminUser || process.env.ADMIN_USER || "admin";
  const adminHash = options.adminHash || process.env.ADMIN_PASSWORD_HASH || "";
  const attempts = new Map();
  const inquiries = new Map();
  const cleanup = options.apiOnly
    ? null
    : setInterval(() => {
        Promise.resolve(
          store.db
            .prepare("DELETE FROM sessions WHERE expires<?")
            .run(Date.now()),
        ).catch(() => {});
        for (const m of [attempts, inquiries])
          for (const [k, v] of m) if (v.until < Date.now()) m.delete(k);
      }, 60000);
  cleanup?.unref();
  const production =
    options.production ?? process.argv.includes("--production");
  const vite =
    options.useVite === false || production
      ? null
      : await (
          await import("vite")
        ).createServer({
          root,
          server: { middlewareMode: true },
          appType: "spa",
        });
  const sessionFor = async (req) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("qf_session="))
      ?.slice(11);
    return token
      ? await store.db
          .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
          .get(hash(token), Date.now())
      : null;
  };
  const limited = async (map, key, max, minutes) => {
    if (store.limit)
      return store.limit(
        map === attempts ? "login" : "requests",
        key,
        max,
        minutes,
      );
    const item = map.get(key) || {
      count: 0,
      until: Date.now() + minutes * 60000,
    };
    if (item.until < Date.now()) {
      item.count = 0;
      item.until = Date.now() + minutes * 60000;
    }
    item.count++;
    map.set(key, item);
    if (item.count > max)
      throw new HttpError(429, "Please wait a little before trying again.");
  };
  async function api(req, res, path) {
    const method = req.method;
    const ip = options.trustProxy
      ? String(
          req.headers["x-forwarded-for"] ||
            req.socket?.remoteAddress ||
            "local",
        )
          .split(",")[0]
          .trim()
      : req.socket.remoteAddress || "local";
    if (!["GET", "HEAD"].includes(method) && req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          throw Error();
      } catch {
        throw new HttpError(403, "This request must come from the store.");
      }
    }
    if (method === "GET" && path === "/api/catalog") {
      const settings = publicSettings(await store.settings());
      return json(res, 200, {
        products: (await store.products()).filter((p) => p.published),
        settings,
      });
    }
    if (method === "POST" && path === "/api/admin/login") {
      await limited(attempts, ip, 8, 15);
      const input = await body(req);
      if (!adminHash)
        throw new HttpError(
          503,
          options.adminMissingMessage ||
            "Run npm run admin:setup to configure the store administrator.",
        );
      if (
        typeof input.password !== "string" ||
        input.password.length > 200 ||
        input.username !== adminUser ||
        !verifyPassword(input.password, adminHash)
      )
        throw new HttpError(401, "The username or password is incorrect.");
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      await store.db
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run(hash(token), csrf, Date.now() + 8 * 3600000);
      attempts.delete(ip);
      if (store.resetLimit) await store.resetLimit("login", ip);
      res.setHeader(
        "Set-Cookie",
        `qf_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${options.secureCookies || process.env.SECURE_COOKIES === "true" ? "; Secure" : ""}`,
      );
      return json(res, 200, { csrf, username: adminUser });
    }
    if (path.startsWith("/api/admin/")) {
      const session = await sessionFor(req);
      if (!session)
        throw new HttpError(401, "Please sign in to manage the store.");
      if (method !== "GET" && req.headers["x-csrf-token"] !== session.csrf)
        throw new HttpError(
          403,
          "Your session has changed. Please sign in again.",
        );
      if (method === "GET" && path === "/api/admin/session")
        return json(res, 200, { csrf: session.csrf, username: adminUser });
      if (method === "POST" && path === "/api/admin/logout") {
        await store.db
          .prepare("DELETE FROM sessions WHERE token=?")
          .run(session.token);
        res.setHeader(
          "Set-Cookie",
          "qf_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return json(res, 200, { ok: true });
      }
      if (method === "GET" && path === "/api/admin/dashboard")
        return json(res, 200, {
          products: await store.products(),
          settings: await store.settings(),
          requests: (
            await store.db
              .prepare(
                "SELECT id,kind,status,data,created FROM requests ORDER BY created DESC LIMIT 500",
              )
              .all()
          ).map((r) => ({ ...r, data: JSON.parse(r.data) })),
        });
      if (
        (method === "PUT" || method === "POST") &&
        /^\/api\/admin\/products(?:\/[^/]+)?$/.test(path)
      ) {
        const input = await body(req);
        const id =
          method === "POST"
            ? `product-${randomUUID().slice(0, 8)}`
            : path.split("/").at(-1);
        if (method === "PUT" && !(await store.product(id)))
          throw new HttpError(404, "Product not found.");
        const product = validateProduct(input, id);
        if (
          (await store.products()).some(
            (p) => p.id !== id && p.slug === product.slug,
          )
        )
          throw new HttpError(400, "This product link is already used.");
        await store.saveProduct(product);
        return json(res, 200, { product });
      }
      if (method === "PUT" && path === "/api/admin/settings") {
        const b = await body(req),
          s = await store.settings();
        for (const key of [
          "website",
          "phone",
          "tiktok",
          "bankAccountHolder",
          "bankIban",
          "bankAccountNumber",
          "easypaisaHolder",
          "easypaisaNumber",
          "email",
          "orderNotificationEmail",
          "whatsapp",
          "instagram",
          "address",
          "announcement",
          "deliveryText",
          "returnsText",
        ])
          if (typeof b[key] === "string") s[key] = b[key].trim().slice(0, 1500);
        if (s.website && !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(s.website))
          throw new HttpError(400, "Use a valid HTTPS website address.");
        if (s.phone && !/^(?:\+92|92|0)3\d{9}$/.test(s.phone))
          throw new HttpError(400, "Enter a valid Pakistani contact number.");
        if (s.tiktok && !/^[a-zA-Z0-9_.]{1,60}$/.test(s.tiktok))
          throw new HttpError(
            400,
            "Use the TikTok username without @ or a URL.",
          );
        if (s.bankIban) {
          s.bankIban = s.bankIban.replace(/\s/g, "").toUpperCase();
          if (!/^PK\d{2}[A-Z]{4}\d{16}$/.test(s.bankIban))
            throw new HttpError(400, "Enter a valid Pakistani IBAN.");
          const digits = (s.bankIban.slice(4) + s.bankIban.slice(0, 4)).replace(
            /[A-Z]/g,
            (c) => String(c.charCodeAt(0) - 55),
          );
          if (BigInt(digits) % 97n !== 1n)
            throw new HttpError(400, "The IBAN checksum is invalid.");
        }
        if (s.bankAccountNumber && !/^\d{8,24}$/.test(s.bankAccountNumber))
          throw new HttpError(400, "Enter a valid bank account number.");
        if (s.easypaisaNumber && !/^03\d{9}$/.test(s.easypaisaNumber))
          throw new HttpError(400, "Enter a valid Easypaisa mobile number.");
        if (
          s.orderNotificationEmail &&
          (s.orderNotificationEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.orderNotificationEmail))
        )
          throw new HttpError(400, "Enter a valid order notification email.");
        if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
          throw new HttpError(400, "Enter a valid contact email.");
        if (s.whatsapp && !/^\d{10,15}$/.test(s.whatsapp))
          throw new HttpError(
            400,
            "WhatsApp needs the country code and digits only.",
          );
        if (
          b.shippingFee !== null &&
          (!Number.isInteger(b.shippingFee) ||
            b.shippingFee < 0 ||
            b.shippingFee > 10000000)
        )
          throw new HttpError(
            400,
            "Enter a valid shipping amount or leave it unset.",
          );
        s.shippingFee = b.shippingFee;
        s.codEnabled = Boolean(b.codEnabled);
        if (Array.isArray(b.discounts)) {
          s.discounts = b.discounts.slice(0, 30).map((d) => {
            if (
              !/^[A-Z0-9_-]{2,30}$/.test(d.code) ||
              !["percent", "fixed"].includes(d.type) ||
              !Number.isInteger(d.value) ||
              d.value < 1 ||
              (d.type === "percent" && d.value > 100) ||
              !Number.isInteger(d.minimum) ||
              d.minimum < 0
            )
              throw new HttpError(400, "Check the discount code and amount.");
            if (d.expires && !Number.isFinite(Date.parse(d.expires)))
              throw new HttpError(400, "Check the discount expiry date.");
            return {
              code: d.code,
              type: d.type,
              value: d.value,
              minimum: d.minimum,
              expires: d.expires || null,
              active: Boolean(d.active),
            };
          });
        }
        await store.saveSettings(s);
        return json(res, 200, { settings: s });
      }
      if (method === "PATCH" && path.startsWith("/api/admin/requests/")) {
        const b = await body(req),
          id = path.split("/").at(-1);
        const r = await store.db
          .prepare("SELECT kind,status,data FROM requests WHERE id=?")
          .get(id);
        if (!r) throw new HttpError(404, "Request not found.");
        const statuses =
          r.kind === "inquiry"
            ? ["new", "contacted", "resolved"]
            : [
                "pending",
                "confirmed",
                "processing",
                "shipped",
                "delivered",
                "cancelled",
              ];
        if (!statuses.includes(b.status))
          throw new HttpError(400, "Invalid status.");
        if (
          r.kind === "order" &&
          r.status === "cancelled" &&
          b.status !== "cancelled"
        )
          throw new HttpError(
            400,
            "A cancelled order cannot be reopened. Create a new order.",
          );
        await store.db.exec("BEGIN IMMEDIATE");
        try {
          if (
            r.kind === "order" &&
            b.status === "cancelled" &&
            r.status !== "cancelled"
          ) {
            for (const item of JSON.parse(r.data).items) {
              const p = await store.product(item.id);
              if (p && p.stockBySize?.[item.size] != null) {
                p.stockBySize[item.size] += item.quantity;
                if (p.stock !== null) p.stock += item.quantity;
                await store.saveProduct(p);
              }
            }
          }
          await store.db
            .prepare("UPDATE requests SET status=? WHERE id=?")
            .run(b.status, id);
          await store.db.exec("COMMIT");
        } catch (e) {
          await store.db.exec("ROLLBACK");
          throw e;
        }
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && path === "/api/admin/upload") {
        const b = await body(req, 4500000);
        if (
          typeof b.data !== "string" ||
          !["image/jpeg", "image/png", "image/webp"].includes(b.type)
        )
          throw new HttpError(400, "Choose a JPG, PNG or WebP image.");
        const data = Buffer.from(b.data, "base64");
        if (data.length > 3000000 || data.length < 12)
          throw new HttpError(400, "Images must be smaller than 3 MB.");
        const valid =
          b.type === "image/jpeg"
            ? data[0] === 255 && data[1] === 216
            : b.type === "image/png"
              ? data
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : data.toString("ascii", 0, 4) === "RIFF" &&
                data.toString("ascii", 8, 12) === "WEBP";
        if (!valid)
          throw new HttpError(400, "The image format could not be verified.");
        const name = `upload-${randomUUID()}.${b.type === "image/jpeg" ? "jpg" : b.type === "image/png" ? "png" : "webp"}`;
        if (store.saveMedia) await store.saveMedia(name, b.type, data);
        else {
          await mkdir(join(root, "public/products"), { recursive: true });
          await writeFile(join(root, "public/products", name), data);
        }
        return json(res, 201, { url: `/products/${name}` });
      }
      throw new HttpError(404, "Management action not found.");
    }
    if (method === "POST" && path === "/api/discount") {
      await limited(inquiries, `discount:${ip}`, 40, 15);
      const b = await body(req);
      const items = await validateItems(store, b.items);
      if (items.some((i) => i.price === null))
        throw new HttpError(
          400,
          "Discounts can be checked after prices are confirmed.",
        );
      return json(
        res,
        200,
        totalsFor(
          items,
          await store.settings(),
          String(b.code || "").slice(0, 30),
        ),
      );
    }
    if (method === "POST" && path === "/api/messages") {
      const b = await body(req);
      const key = req.headers["idempotency-key"];
      if (typeof key !== "string" || !/^[\da-f-]{36}$/i.test(key))
        throw new HttpError(400, "Please refresh and try again.");
      const name = requiredText(b.name, "Your name", 80),
        phone = requiredText(b.phone, "Phone number", 30).replace(
          /[\s()-]/g,
          "",
        );
      if (!/^(?:\+92|0092|92|0)3\d{9}$/.test(phone))
        throw new HttpError(
          400,
          "Please enter a valid Pakistani mobile number.",
        );
      const message = requiredText(b.message, "Your message", 1500);
      const fingerprint = hash(JSON.stringify({ name, phone, message }));
      const existing = await store.db
        .prepare("SELECT id,fingerprint FROM requests WHERE idempotency=?")
        .get(key);
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new HttpError(
            409,
            "This submission already contains another message. Refresh to send a new note.",
          );
        return json(res, 200, { reference: existing.id });
      }
      await limited(inquiries, ip, 12, 15);
      const reference = `QF-M-${randomBytes(5).toString("hex").toUpperCase()}`;
      await store.db.prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)").run(
        reference,
        key,
        fingerprint,
        "inquiry",
        "new",
        JSON.stringify({
          customer: { name, phone, city: "", address: "", notes: message },
          items: [],
          totals: {
            subtotal: null,
            total: null,
            shipping: null,
            discount: 0,
          },
        }),
        new Date().toISOString(),
      );
      return json(res, 201, { reference });
    }
    if (method === "POST" && path === "/api/requests") {
      const b = await body(req);
      const key = req.headers["idempotency-key"];
      if (typeof key !== "string" || !/^[\da-f-]{36}$/i.test(key))
        throw new HttpError(
          400,
          "Please refresh and submit your request again.",
        );
      const customer = validateCustomer(b.customer || {});
      const items = await validateItems(store, b.items);
      const fingerprint = hash(
        JSON.stringify({
          customer,
          items: items.map(({ id, size, quantity }) => ({
            id,
            size,
            quantity,
          })),
        }),
      );
      const existing = await store.db
        .prepare("SELECT id,kind,fingerprint FROM requests WHERE idempotency=?")
        .get(key);
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new HttpError(
            409,
            "This submission was already used for a different request.",
          );
        return json(res, 200, { reference: existing.id, kind: existing.kind });
      }
      await limited(inquiries, ip, 12, 15);
      const s = await store.settings();
      const totals = totalsFor(
        items,
        s,
        String(b.discountCode || "").slice(0, 30),
      );
      const kind =
        totals.total !== null &&
        s.codEnabled &&
        items.every((i) => i.stock !== null)
          ? "order"
          : "inquiry";
      const reference = `QF-${kind === "order" ? "O" : "I"}-${randomBytes(5).toString("hex").toUpperCase()}`;
      await store.db.exec("BEGIN IMMEDIATE");
      try {
        if (kind === "order") {
          for (const item of items) {
            const p = await store.product(item.id);
            if (p.stockBySize[item.size] < item.quantity)
              throw new HttpError(
                409,
                `${p.name}, size ${item.size}, does not have enough stock. Please update your bag.`,
              );
            p.stockBySize[item.size] -= item.quantity;
            if (p.stock !== null) p.stock -= item.quantity;
            await store.saveProduct(p);
          }
        }
        await store.db
          .prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)")
          .run(
            reference,
            key,
            fingerprint,
            kind,
            kind === "order" ? "pending" : "new",
            JSON.stringify({
              customer,
              items: items.map(({ stock, ...item }) => item),
              totals,
              discountCode: b.discountCode || "",
            }),
            new Date().toISOString(),
          );
        await store.db.exec("COMMIT");
      } catch (e) {
        await store.db.exec("ROLLBACK");
        throw e;
      }
      return json(res, 201, { reference, kind });
    }
    throw new HttpError(404, "This action was not found.");
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return json(res, 400, { error: "Invalid URL." });
    }
    if (path.startsWith("/api/")) {
      try {
        await api(req, res, path);
      } catch (e) {
        if (!(e instanceof HttpError)) console.error("API error:", e.message);
        json(res, e.status || 500, {
          error: e.status
            ? e.message
            : "Something went wrong. Please try again.",
        });
      }
      return;
    }
    // Runtime uploads are served here in both development and production.
    if (path.startsWith("/products/upload-")) {
      try {
        const filename = path.slice(10);
        if (!/^upload-[\da-f-]+\.(jpg|png|webp)$/.test(filename)) throw Error();
        const data = await readFile(join(root, "public/products", filename));
        res.writeHead(200, {
          "Content-Type": filename.endsWith("jpg")
            ? "image/jpeg"
            : filename.endsWith("png")
              ? "image/png"
              : "image/webp",
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("Image not found");
      }
      return;
    }
    if (vite) {
      vite.middlewares(req, res, () => {
        res.writeHead(404);
        res.end("Not found");
      });
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    const dist = join(root, "dist");
    let filename = resolve(dist, `.${path}`);
    if (!filename.startsWith(`${dist}/`) && filename !== dist) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(filename)).isFile()) throw Error();
    } catch {
      if (extname(path)) {
        res.writeHead(404);
        res.end("File not found");
        return;
      }
      filename = join(dist, "index.html");
    }
    try {
      const data = await readFile(filename);
      const type =
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
        }[extname(filename)] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": filename.includes("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(503);
      res.end("Run npm run build first.");
    }
  });
  return {
    server,
    store,
    handleApi: api,
    close: async () => {
      if (cleanup) clearInterval(cleanup);
      await vite?.close();
      await new Promise((r) => server.close(r));
      store.db.close();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  const port = Number(
    portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 3000,
  );
  const hostIndex = args.indexOf("--hostname");
  const host =
    hostIndex >= 0 ? args[hostIndex + 1] : process.env.HOST || "127.0.0.1";
  const app = await createApplication();
  app.server.listen(port, host, () =>
    console.log(`QADAM FLEX is running at http://${host}:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
