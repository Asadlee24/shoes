import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  LogOut,
  Package,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api, money } from "./api";
import { useAccount } from "./customer-account";
import { useStore } from "./store";
import { OrderPayment } from "./Payment";
import type { StoreRequest } from "./types";
export default function Account() {
  const account = useAccount(),
    { toast, settings } = useStore();
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate();
  const mode = ["register", "recover"].includes(params.get("mode") || "")
    ? params.get("mode")!
    : "login";
  const next = params.get("next") === "/checkout" ? "/checkout" : "/account";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recoveryCode, setRecoveryCode] = useState(""),
    [savedCode, setSavedCode] = useState(false);
  const [tab, setTab] = useState("orders"),
    [orders, setOrders] = useState<StoreRequest[]>([]),
    [ordersLoading, setOrdersLoading] = useState(false),
    [ordersError, setOrdersError] = useState("");
  const userId = account.user?.id;
  const ordersRequest = useRef<AbortController | null>(null);
  const loadOrders = useCallback(async () => {
    if (!userId) return;
    ordersRequest.current?.abort();
    const controller = new AbortController();
    ordersRequest.current = controller;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const result = await api<{ orders: StoreRequest[] }>(
        "/api/account/orders",
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setOrders(result.orders);
    } catch (error) {
      if (!controller.signal.aborted) setOrdersError((error as Error).message);
    } finally {
      if (!controller.signal.aborted) setOrdersLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    setOrders([]);
    void loadOrders();
    return () => ordersRequest.current?.abort();
  }, [loadOrders]);
  useEffect(() => {
    setError("");
  }, [mode, tab]);
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await account.authenticate(
        mode,
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      if (result.recoveryCode) {
        setRecoveryCode(result.recoveryCode);
        setSavedCode(false);
      } else navigate(next, { replace: true });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ user: NonNullable<typeof account.user> }>(
        "/api/account/profile",
        { method: "PUT", headers: account.headers, body: JSON.stringify(data) },
      );
      account.update(result);
      toast("Your details are saved.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    try {
      const result = await api<{
        user: NonNullable<typeof account.user>;
        csrf: string;
      }>("/api/account/password", {
        method: "POST",
        headers: account.headers,
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      account.update(result);
      form.reset();
      toast("Password changed. Other sessions are signed out.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await account.logout();
      setOrders([]);
      navigate("/account", { replace: true });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (account.loading)
    return (
      <main className="account-page section-pad">
        <p role="status">Opening your account…</p>
      </main>
    );
  if (account.error)
    return (
      <main className="account-page section-pad">
        <h1>Your account.</h1>
        <p role="alert">{account.error}</p>
        <button className="button" onClick={() => void account.refresh()}>
          Try again
        </button>
      </main>
    );
  if (recoveryCode)
    return (
      <main className="account-page section-pad">
        <section className="account-auth-card recovery-card">
          <ShieldCheck size={32} />
          <p className="eyebrow">ACCOUNT RECOVERY</p>
          <h1>Keep this safe.</h1>
          <p>
            This private code lets you reset your password. Save it somewhere
            secure; it is shown only once. Never share it with the store or
            anyone else.
          </p>
          <code className="recovery-code">{recoveryCode}</code>
          <button
            className="text-link"
            onClick={() =>
              void navigator.clipboard
                .writeText(recoveryCode)
                .then(() => toast("Recovery code copied."))
                .catch(() => toast("Select the code to copy it."))
            }
          >
            <Copy size={16} />
            Copy recovery code
          </button>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={savedCode}
              onChange={(event) => setSavedCode(event.target.checked)}
            />
            I have saved my recovery code
          </label>
          <button
            className="button full"
            disabled={!savedCode}
            onClick={() => {
              setRecoveryCode("");
              navigate(next, { replace: true });
            }}
          >
            Continue <ArrowRight size={17} />
          </button>
        </section>
      </main>
    );
  if (!account.user)
    return (
      <main className="account-page section-pad">
        <div className="account-auth-layout">
          <section className="account-auth-intro">
            <p className="eyebrow">QADAM FLEX · YOUR ACCOUNT</p>
            <h1>
              Your pairs.
              <br />
              Your place.
            </h1>
            <p>
              Keep your orders, delivery details and payment receipts together.
            </p>
            <div className="account-benefits">
              <span>
                <Package size={20} />
                Follow every order
              </span>
              <span>
                <ShieldCheck size={20} />
                Private payment receipts
              </span>
              <span>
                <UserRound size={20} />
                Save your delivery details
              </span>
            </div>
            <Link className="text-link" to="/shop">
              Explore the collection <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="account-auth-card">
            <h2>
              {mode === "register"
                ? "Create an account"
                : mode === "recover"
                  ? "Recover your account"
                  : "Welcome back"}
            </h2>
            <p className="muted">
              {mode === "register"
                ? "A few details, and you’re in."
                : mode === "recover"
                  ? "Use the private recovery code saved when you registered."
                  : "Sign in to view your orders and payments."}
            </p>
            <form
              className="customer-form"
              key={mode}
              onSubmit={(event) => void signIn(event)}
            >
              <fieldset disabled={busy}>
                {mode === "register" && (
                  <label>
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      maxLength={80}
                      required
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    maxLength={254}
                    required
                  />
                </label>
                {mode === "recover" && (
                  <label>
                    Recovery code
                    <input
                      name="recoveryCode"
                      autoComplete="off"
                      maxLength={40}
                      minLength={40}
                      required
                      spellCheck={false}
                    />
                  </label>
                )}
                <label>
                  {mode === "recover" ? "New password" : "Password"}
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? undefined : 12}
                    maxLength={200}
                    required
                  />
                  {mode !== "login" && (
                    <small className="muted">At least 12 characters.</small>
                  )}
                </label>
                <p className="field-error" role="alert">
                  {error}
                </p>
                <button className="button full" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "register"
                      ? "Create account"
                      : mode === "recover"
                        ? "Reset password"
                        : "Sign in"}
                  <ArrowRight size={17} />
                </button>
              </fieldset>
            </form>
            <div className="account-auth-switch">
              <button
                className="text-link"
                onClick={() =>
                  setParams({
                    mode: mode === "register" ? "login" : "register",
                    next,
                  })
                }
              >
                {mode === "register"
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
              {mode !== "recover" && (
                <button
                  className="text-link"
                  onClick={() => setParams({ mode: "recover", next })}
                >
                  Forgot password?
                </button>
              )}
              {mode === "recover" && (
                <button
                  className="text-link"
                  onClick={() => setParams({ mode: "login", next })}
                >
                  Back to sign in
                </button>
              )}
            </div>
            <p className="legal-note">
              By continuing, you agree to our <Link to="/terms">terms</Link> and{" "}
              <Link to="/privacy">privacy policy</Link>.
            </p>
          </section>
        </div>
      </main>
    );
  const user = account.user;
  const selected = params.get("order");
  return (
    <main className="account-page section-pad">
      <div className="account-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Hello, {user.name.split(" ")[0]}.</h1>
          <p className="muted">{user.email}</p>
        </div>
        <button
          className="text-link"
          disabled={busy}
          onClick={() => void logout()}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
      <nav className="account-tabs" aria-label="Account sections">
        {[
          ["orders", "Orders & payments"],
          ["profile", "Delivery details"],
          ["security", "Password"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "orders" && (
        <section>
          <div className="account-orders-heading">
            <h2>Your orders</h2>
            <button
              className="text-link"
              disabled={ordersLoading}
              onClick={() => void loadOrders()}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
          {ordersError && (
            <p className="field-error" role="alert">
              {ordersError}
            </p>
          )}
          {ordersLoading && (
            <p role="status" className="muted">
              Checking your orders…
            </p>
          )}
          {!orders.length && !ordersLoading && !ordersError && (
            <div className="account-empty">
              <Package size={36} />
              <h2>Your next pair is waiting.</h2>
              <p>Your orders and enquiries will appear here.</p>
              <Link className="button" to="/shop">
                Shop the collection <ArrowRight size={17} />
              </Link>
            </div>
          )}
          <div className="account-orders">
            {orders.map((order) => (
              <details
                className="account-order"
                key={`${order.id}-${order.data.payment?.status}`}
                open={selected === order.id || orders.length === 1 || undefined}
              >
                <summary>
                  <div>
                    <span className="eyebrow">
                      {order.kind === "order" ? "ORDER" : "ENQUIRY"} ·{" "}
                      {new Date(order.created).toLocaleDateString("en-PK")}
                    </span>
                    <h3>{order.id}</h3>
                  </div>
                  <div>
                    <span className="status-pill">{order.status}</span>
                    <strong>
                      {order.data.totals.total === null
                        ? "To be confirmed"
                        : money(order.data.totals.total)}
                    </strong>
                  </div>
                </summary>
                <div className="account-order-body">
                  <div className="account-order-items">
                    {order.data.items.map((item) => (
                      <div key={`${item.id}-${item.size}`}>
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            Size {item.size} · Qty {item.quantity}
                          </small>
                        </span>
                        <span>{money(item.price)}</span>
                      </div>
                    ))}
                    <dl className="account-totals">
                      <div>
                        <dt>Subtotal</dt>
                        <dd>{money(order.data.totals.subtotal)}</dd>
                      </div>
                      {order.data.totals.discount > 0 && (
                        <div>
                          <dt>Discount</dt>
                          <dd>−{money(order.data.totals.discount)}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Delivery</dt>
                        <dd>
                          {order.data.totals.shipping === null
                            ? "To be confirmed"
                            : order.data.totals.shipping === 0
                              ? "Free delivery"
                              : money(order.data.totals.shipping)}
                        </dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd>
                          {order.data.totals.total === null
                            ? "To be confirmed"
                            : money(order.data.totals.total)}
                        </dd>
                      </div>
                    </dl>
                    <div className="account-delivery">
                      <p className="eyebrow">DELIVERY TO</p>
                      <strong>{order.data.customer.name}</strong>
                      <p>
                        {order.data.customer.address},{" "}
                        {order.data.customer.city}
                      </p>
                      <p>{order.data.customer.phone}</p>
                    </div>
                    {settings?.whatsapp && (
                      <a
                        className="text-link"
                        href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Hi QADAM FLEX, I need help with ${order.id}.`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ask about this order <ArrowUpRight size={15} />
                      </a>
                    )}
                  </div>
                  <OrderPayment order={order} onSaved={loadOrders} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
      {tab === "profile" && (
        <section className="account-settings">
          <h2>Delivery details</h2>
          <p className="muted">Saved for your next checkout.</p>
          <form
            className="customer-form"
            onSubmit={(event) => void saveProfile(event)}
          >
            <fieldset disabled={busy}>
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  defaultValue={user.name}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Mobile number
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={user.phone}
                  maxLength={30}
                />
              </label>
              <label>
                City
                <input
                  name="city"
                  autoComplete="address-level2"
                  defaultValue={user.city}
                  maxLength={80}
                />
              </label>
              <label>
                Address
                <textarea
                  name="address"
                  autoComplete="street-address"
                  defaultValue={user.address}
                  maxLength={500}
                  rows={3}
                />
              </label>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save details"}
                <Check size={17} />
              </button>
            </fieldset>
          </form>
        </section>
      )}
      {tab === "security" && (
        <section className="account-settings">
          <h2>Change password</h2>
          <p className="muted">Other sessions will be signed out.</p>
          <form
            className="customer-form"
            onSubmit={(event) => void changePassword(event)}
          >
            <fieldset disabled={busy}>
              <label>
                Current password
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  maxLength={200}
                  required
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={200}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Update password"}
              </button>
            </fieldset>
          </form>
        </section>
      )}
      <p className="field-error" role="alert">
        {error}
      </p>
    </main>
  );
}
