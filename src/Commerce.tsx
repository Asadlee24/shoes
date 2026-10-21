import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, money } from "./api";
import { useAccount } from "./customer-account";
import type { StoreRequest } from "./types";
import "./commerce.css";
type Review = {
  id: string;
  product_id: string;
  request_id?: string;
  rating: number;
  body: string;
  display_name: string;
  status?: string;
  created: string;
  photos: string[];
};
function useLoad<T>(url: string, revision = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    void api<T>(url, { signal: c.signal })
      .then((v) => {
        if (!c.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [url, revision]);
  return { data, error };
}
function ReviewCard({
  review,
  admin = false,
}: {
  review: Review;
  admin?: boolean;
}) {
  return (
    <article className="commerce-review">
      <div className="commerce-review-top">
        <strong>{review.display_name}</strong>
        <span aria-label={`${review.rating} out of 5 stars`}>
          {"★".repeat(review.rating)}
          {"☆".repeat(5 - review.rating)}
        </span>
      </div>
      <small className="muted">
        Verified purchase ·{" "}
        {new Date(review.created).toLocaleDateString("en-PK")}
      </small>
      {admin && (
        <p className="muted">
          {review.product_id} · {review.request_id}
        </p>
      )}
      <p className="commerce-copy">{review.body}</p>
      <div className="commerce-photos">
        {review.photos.map((id) => (
          <a
            key={id}
            href={`/api/${admin ? "admin/" : ""}review-photos/${id}`}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={`/api/${admin ? "admin/" : ""}review-photos/${id}`}
              alt={`Customer photo of their purchased shoes`}
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </article>
  );
}
export function ProductReviews({ productId }: { productId: string }) {
  const { data, error } = useLoad<{
    reviews: Review[];
    count: number;
    average: number;
  }>(`/api/products/${encodeURIComponent(productId)}/reviews`);
  return (
    <section className="commerce-section">
      <p className="eyebrow">FROM OUR CUSTOMERS</p>
      <h2>Customer reviews.</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading reviews…</p>
      ) : data.count ? (
        <>
          <p>
            {data.average.toFixed(1)} / 5 · {data.count} verified{" "}
            {data.count === 1 ? "review" : "reviews"}
          </p>
          <div className="commerce-review-grid">
            {data.reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </>
      ) : (
        <p className="muted">
          No reviews yet. Purchased this pair? You can leave a review in{" "}
          <Link to="/account">your account</Link> after delivery.
        </p>
      )}
    </section>
  );
}
async function readPhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 1000000
  )
    throw new Error("Choose JPG, PNG or WebP photos under 1 MB each.");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("This photo could not be opened."));
    r.readAsDataURL(file);
  });
  return { type: file.type, data };
}
export function OrderReviews({ order }: { order: StoreRequest }) {
  const account = useAccount(),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const { data, error: loadError } = useLoad<{ reviews: Review[] }>(
    `/api/account/orders/${encodeURIComponent(order.id)}/reviews`,
    revision,
  );
  const items = order.data.items.filter(
    (item, index, all) => all.findIndex((i) => i.id === item.id) === index,
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const f = new FormData(form),
        files = f
          .getAll("photos")
          .filter((x): x is File => x instanceof File && x.size > 0);
      if (files.length > 2) throw new Error("Choose up to two photos.");
      await api(`/api/account/orders/${order.id}/reviews`, {
        method: "POST",
        headers: account.headers,
        body: JSON.stringify({
          productId: f.get("productId"),
          rating: Number(f.get("rating")),
          displayName: f.get("displayName"),
          body: f.get("body"),
          consent: f.get("consent") === "on",
          photos: await Promise.all(files.map(readPhoto)),
        }),
      });
      setNotice("Thank you. Your review is awaiting store approval.");
      setRevision((v) => v + 1);
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const available = items.filter(
    (i) => !data?.reviews.some((r) => r.product_id === i.id),
  );
  return (
    <section className="commerce-panel">
      <h3>Your review</h3>
      {loadError ? (
        <p role="alert">{loadError}</p>
      ) : !data ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          {data.reviews.map((r) => (
            <p key={r.id}>
              {items.find((i) => i.id === r.product_id)?.name} · {r.rating}/5 ·{" "}
              {r.status === "pending"
                ? "Awaiting approval"
                : r.status === "approved"
                  ? "Published"
                  : "Hidden"}
            </p>
          ))}
          {available.length > 0 && (
            <form className="customer-form" onSubmit={(e) => void submit(e)}>
              <fieldset disabled={busy}>
                <label>
                  Purchased pair
                  <select name="productId">
                    {available.map((i) => (
                      <option value={i.id} key={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rating
                  <select name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "star" : "stars"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Public name
                  <input
                    name="displayName"
                    defaultValue={account.user?.name.split(" ")[0]}
                    maxLength={60}
                    required
                  />
                </label>
                <label>
                  Your experience
                  <textarea name="body" maxLength={2000} rows={3} required />
                </label>
                <label>
                  Customer photos (optional)
                  <input
                    type="file"
                    name="photos"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                  />
                  <small>
                    Up to 2 photos, under 1 MB each. Please avoid showing
                    personal details.
                  </small>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="consent" required />I agree to
                  publish this review, public name and selected photos on the
                  store.
                </label>
                <button className="button" disabled={busy}>
                  {busy ? "Submitting…" : "Submit review"}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
export function Tracking({ order }: { order: StoreRequest }) {
  const t = order.data.tracking;
  if (!t) return null;
  return (
    <section className="commerce-panel">
      <p className="eyebrow">DELIVERY TRACKING</p>
      <h3>{t.courier}</h3>
      <p className="commerce-copy">
        Tracking number: <strong>{t.number}</strong>
      </p>
      {t.url && (
        <a
          className="text-link"
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Track your parcel ↗
        </a>
      )}
    </section>
  );
}
export function TrackingEditor({
  order,
  headers,
  onUpdated,
  preview,
}: {
  order: StoreRequest;
  headers: Record<string, string>;
  onUpdated: (r: StoreRequest) => void;
  preview: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  if (
    order.kind !== "order" ||
    order.status === "cancelled" ||
    order.data.archivedAt
  )
    return null;
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ request: StoreRequest }>(
        `/api/admin/requests/${order.id}/tracking`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(
            Object.fromEntries(new FormData(e.currentTarget)),
          ),
        },
      );
      onUpdated(result.request);
      setNotice("Tracking saved. The customer can see it in their account.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="commerce-panel">
      <h3>Courier tracking</h3>
      <p className="muted">
        Add the courier details after booking. This keeps the current order
        status.
      </p>
      <form className="customer-form" onSubmit={(e) => void save(e)}>
        <fieldset disabled={busy || preview}>
          <label>
            Courier
            <input
              name="courier"
              defaultValue={order.data.tracking?.courier}
              maxLength={80}
              placeholder="e.g. TCS"
              required
            />
          </label>
          <label>
            Tracking number
            <input
              name="number"
              defaultValue={order.data.tracking?.number}
              maxLength={120}
              required
            />
          </label>
          <label>
            Tracking link (optional)
            <input
              name="url"
              type="url"
              pattern="https://.*"
              defaultValue={order.data.tracking?.url}
              maxLength={1000}
              placeholder="https://…"
            />
          </label>
          <button className="button" disabled={busy || preview}>
            {busy ? "Saving…" : "Save tracking"}
          </button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
type Sales = {
  revenue: number;
  monthRevenue: number;
  paidOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  average: number;
  threshold: number;
  lowStock: { id: string; name: string; size: string; quantity: number }[];
};
export function SalesSummary() {
  const [revision, setRevision] = useState(0),
    { data, error } = useLoad<Sales>("/api/admin/sales", revision);
  return (
    <section className="commerce-section">
      <div className="commerce-review-top">
        <h2>Sales & stock</h2>
        <button className="text-link" onClick={() => setRevision((v) => v + 1)}>
          Refresh summary
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading summary…</p>
      ) : (
        <>
          <div className="admin-stat-grid">
            {[
              ["Paid order value", money(data.revenue)],
              ["This month¹", money(data.monthRevenue)],
              ["Paid orders", data.paidOrders],
              ["Average paid order", money(data.average)],
              ["Active orders", data.activeOrders],
              ["Delivered orders", data.deliveredOrders],
            ].map(([name, value]) => (
              <div key={name} className="admin-stat">
                <span>{name}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="legal-note">
            Paid value excludes enquiries, unpaid, cancelled and archived
            orders. COD counts when delivered. ¹ Orders placed this calendar
            month (UTC), not a cash receipt report.
          </p>
          <h3>Low-stock alerts</h3>
          <p className="muted">
            Sizes with {data.threshold} pairs or fewer. An email alert is sent
            when a size first becomes low; restocking above this level resets
            the alert.
          </p>
          {data.lowStock.length ? (
            <div className="commerce-stock">
              {data.lowStock.map((s) => (
                <div key={`${s.id}:${s.size}`}>
                  <span>
                    {s.name} · Size {s.size}
                  </span>
                  <strong>
                    {s.quantity === 0 ? "Out of stock" : `${s.quantity} left`}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p>No low-stock sizes.</p>
          )}
        </>
      )}
    </section>
  );
}
export function AdminReviews({
  headers,
  preview,
}: {
  headers: Record<string, string>;
  preview: boolean;
}) {
  if (preview)
    return <p className="muted">Sign in to moderate real customer reviews.</p>;
  return <ReviewModeration headers={headers} />;
}
function ReviewModeration({ headers }: { headers: Record<string, string> }) {
  const [revision, setRevision] = useState(0),
    [filter, setFilter] = useState("pending"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const { data, error: loadError } = useLoad<{ reviews: Review[] }>(
    "/api/admin/reviews",
    revision,
  );
  async function moderate(id: string, status: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="commerce-section">
      <h1>Customer reviews.</h1>
      <p className="muted">
        Only customers with a delivered purchase can submit. Approve genuine
        reviews for publication; ratings and customer words stay unchanged.
      </p>
      <label>
        Show{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">Awaiting approval</option>
          <option value="approved">Published</option>
          <option value="rejected">Hidden</option>
        </select>
      </label>
      {(error || loadError) && (
        <p className="field-error" role="alert">
          {error || loadError}
        </p>
      )}
      {!data && !loadError ? (
        <p role="status">Loading reviews…</p>
      ) : (
        <div className="commerce-review-grid">
          {data?.reviews
            .filter((r) => r.status === filter)
            .map((r) => (
              <div key={r.id}>
                <ReviewCard review={r} admin />
                <div className="commerce-actions">
                  <button
                    className="button"
                    disabled={!!busy || r.status === "approved"}
                    onClick={() => void moderate(r.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="text-link"
                    disabled={!!busy || r.status === "rejected"}
                    onClick={() => void moderate(r.id, "rejected")}
                  >
                    Hide
                  </button>
                </div>
              </div>
            ))}
          {data && !data.reviews.some((r) => r.status === filter) && (
            <p>No reviews in this section.</p>
          )}
        </div>
      )}
    </section>
  );
}
export function VerifyBanner() {
  const account = useAccount(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  if (account.user?.emailVerified) return null;
  async function send() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ message: string }>(
        "/api/account/send-verification",
        { method: "POST", headers: account.headers, body: "{}" },
      );
      setNotice(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="commerce-panel">
      <strong>Get your order updates by email.</strong>
      <p className="muted">
        Verify your email address to receive confirmations, payment updates and
        courier tracking.
      </p>
      <button className="text-link" onClick={() => void send()} disabled={busy}>
        {busy ? "Sending…" : "Send verification email"}
      </button>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
export function EmailAccess() {
  const location = useLocation(),
    account = useAccount();
  const [token] = useState(
    () =>
      new URLSearchParams(location.hash.slice(1)).get(
        location.hash.startsWith("#reset=") ? "reset" : "verify",
      ) || "",
  );
  const mode = location.hash.startsWith("#reset=")
    ? "reset"
    : location.hash.startsWith("#verify=")
      ? "verify"
      : "forgot";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [recovery, setRecovery] = useState(""),
    [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget);
      const r = await api<{ message?: string; recoveryCode?: string }>(
        `/api/account/${mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : "verify-email"}`,
        {
          method: "POST",
          body: JSON.stringify({
            token,
            email: f.get("email"),
            password: f.get("password"),
          }),
        },
      );
      setNotice(
        r.message ||
          (mode === "reset"
            ? "Password changed. Save your new recovery code, then sign in."
            : "Email verified. Your order updates will be sent here."),
      );
      setRecovery(r.recoveryCode || "");
      setDone(true);
      if (mode !== "forgot") await account.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page section-pad">
      <section className="account-auth-card commerce-access">
        <p className="eyebrow">QADAM FLEX · YOUR ACCOUNT</p>
        <h1>
          {mode === "reset"
            ? "Reset password."
            : mode === "verify"
              ? "Verify your email."
              : "Forgot password?"}
        </h1>
        {!done && (
          <form className="customer-form" onSubmit={(e) => void submit(e)}>
            <fieldset disabled={busy}>
              {mode === "forgot" && (
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
              )}
              {mode === "reset" && (
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={200}
                  />
                  <small>At least 12 characters.</small>
                </label>
              )}
              {mode === "verify" && (
                <p>Confirm this email address to receive your order updates.</p>
              )}
              <button className="button" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "forgot"
                    ? "Email me a reset link"
                    : mode === "reset"
                      ? "Save new password"
                      : "Verify email"}
              </button>
            </fieldset>
          </form>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {recovery && <code className="recovery-code">{recovery}</code>}
        <div className="commerce-actions">
          <Link className="text-link" to="/account">
            {mode === "verify" ? "Go to your account" : "Back to sign in"}
          </Link>
          {mode === "forgot" && (
            <Link className="text-link" to="/account?mode=recover">
              Use a recovery code
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
