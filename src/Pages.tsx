import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Heart,
  LoaderCircle,
  MessageCircle,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { BusinessLinks } from "./Business";
import { useAccount } from "./customer-account";
import { PaymentDestination } from "./Payment";
import type { Payment } from "./types";
import { api, money, requestId } from "./api";
import {
  Accordion,
  BagLines,
  Modal,
  ProductCard,
  Quantity,
  SizeSelector,
} from "./components";
import type { CartItem } from "./types";

export function Shop() {
  const { products } = useStore();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(false);
  const q = params.get("q") || "",
    category = params.get("category") || "",
    size = params.get("size") || "",
    color = params.get("color") || "",
    sort = params.get("sort") || "edit";
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const shown = products
    .filter(
      (p) =>
        (!q ||
          `${p.name} ${p.subtitle} ${p.description} ${p.color}`
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (!category || p.category === category) &&
        (!size || p.sizes.includes(size)) &&
        (!color || p.color === color),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "low"
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : sort === "high"
            ? (b.price ?? -1) - (a.price ?? -1)
            : 0,
    );
  const filterContent = (
    <>
      <div className="filter-group">
        <label htmlFor="category">Collection</label>
        <select
          id="category"
          value={category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="">All shoes</option>
          <option>Loafers</option>
          <option>Formal shoes</option>
        </select>
      </div>
      <div className="filter-group">
        <label htmlFor="color">Color</label>
        <select
          id="color"
          value={color}
          onChange={(e) => set("color", e.target.value)}
        >
          <option value="">All colors</option>
          {[...new Set(products.map((p) => p.color))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>Size</label>
        <div className="filter-sizes">
          {["7", "8", "9", "10", "11"].map((s) => (
            <button
              className={size === s ? "selected" : ""}
              key={s}
              onClick={() => set("size", size === s ? "" : s)}
              aria-pressed={size === s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <button className="text-link" onClick={() => setParams({})}>
        Clear all filters <X size={13} />
      </button>
    </>
  );
  return (
    <main className="shop-page">
      <section className="page-intro section-pad">
        <p className="eyebrow">THE QADAM COLLECTION</p>
        <div className="intro-row">
          <h1>{category || "A pair for your every day."}</h1>
          <p>
            Considered silhouettes. Distinctive details.
            <br />
            Find a little character for your wardrobe.
          </p>
        </div>
      </section>
      <section className="shop-content section-pad">
        <div className="shop-toolbar">
          <div className="inline-search">
            <Search size={17} />
            <input
              type="search"
              aria-label="Search the collection"
              placeholder="Find your pair…"
              value={q}
              onChange={(e) => set("q", e.target.value)}
            />
            {q && (
              <button aria-label="Clear search" onClick={() => set("q", "")}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="toolbar-right">
            <span className="muted">
              {shown.length} {shown.length === 1 ? "pair" : "pairs"}
            </span>
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => set("sort", e.target.value)}
            >
              <option value="edit">The Qadam edit</option>
              <option value="name">Name: A–Z</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
            <button className="filter-button" onClick={() => setFilters(true)}>
              <SlidersHorizontal size={17} /> Filters
            </button>
          </div>
        </div>
        <div className="shop-layout">
          <aside className="shop-filters">{filterContent}</aside>
          <div>
            {(category || size || color) && (
              <div className="active-filters">
                {[
                  ["category", category],
                  ["size", size && `Size ${size}`],
                  ["color", color],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <button key={k} onClick={() => set(k, "")}>
                      {v}
                      <X size={12} />
                    </button>
                  ))}
              </div>
            )}
            {shown.length ? (
              <div className="product-grid shop-grid">
                {shown.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={32} />
                <h2>No pairs found.</h2>
                <p>Try another search or clear your filters.</p>
                <button className="button" onClick={() => setParams({})}>
                  View the collection <ArrowRight size={17} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
      <Modal
        open={filters}
        onClose={() => setFilters(false)}
        label="Collection filters"
        drawer
      >
        <div className="modal-heading">
          <h2>A more considered search.</h2>
          <button aria-label="Close filters" onClick={() => setFilters(false)}>
            <X />
          </button>
        </div>
        {filterContent}
        <button className="button full" onClick={() => setFilters(false)}>
          Show {shown.length} pairs <ArrowRight size={17} />
        </button>
      </Modal>
    </main>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const { products, settings, add, wishlist, toggleWish } = useStore();
  const p = products.find((p) => p.slug === slug);
  const [size, setSize] = useState(""),
    [quantity, setQuantity] = useState(1),
    [selected, setSelected] = useState(0),
    [error, setError] = useState(""),
    [zoom, setZoom] = useState(false);
  useEffect(() => {
    setSize("");
    setQuantity(1);
    setSelected(0);
    setError("");
  }, [slug]);
  if (!p) return <NotFound />;
  const saved = wishlist.includes(p.id);
  return (
    <main className="product-page section-pad">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/shop">The collection</Link>
        <span>/</span>
        <Link to={`/shop?category=${encodeURIComponent(p.category)}`}>
          {p.category}
        </Link>
        <span>/</span>
        <span>{p.name}</span>
      </nav>
      <div className="product-layout">
        <div className="product-gallery">
          <button
            className="gallery-main"
            onClick={() => setZoom(true)}
            aria-label={`Enlarge ${p.name} photograph`}
          >
            <img
              src={p.images[selected]}
              alt={`${p.subtitle}, view ${selected + 1}`}
              style={{ objectPosition: p.imagePosition }}
            />
            <span>
              TAKE A CLOSER LOOK <Search size={14} />
            </span>
          </button>
          <div className="gallery-thumbnails">
            {p.images.map((img, i) => (
              <button
                key={img}
                className={selected === i ? "selected" : ""}
                onClick={() => setSelected(i)}
                aria-label={`Show product image ${i + 1}`}
                aria-pressed={selected === i}
              >
                <img
                  src={img}
                  alt=""
                  style={{ objectPosition: p.imagePosition }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="product-description">
          <p className="eyebrow">QADAM FLEX / {p.sku || "THE COLLECTION"}</p>
          <h1>{p.name}</h1>
          <div className="product-color">
            <span className="color-dot" style={{ background: p.swatch }} />
            {p.color}
          </div>
          <p className="price-large">{money(p.price)}</p>
          <p className="product-story">{p.description}</p>
          <SizeSelector
            product={p}
            size={size}
            setSize={(s) => {
              setSize(s);
              setError("");
            }}
          />
          <div className="purchase-row">
            <Quantity
              value={quantity}
              onChange={(q) => setQuantity(Math.max(1, q))}
            />
            <button
              className={`wish-button ${saved ? "saved" : ""}`}
              onClick={() => toggleWish(p.id)}
              aria-label={`${saved ? "Remove from" : "Add to"} wishlist`}
            >
              <Heart size={18} fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "Save this pair"}
            </button>
          </div>
          <p className="field-error" role="alert">
            {error}
          </p>
          <button
            className="button full product-add"
            onClick={() =>
              size
                ? add(p.id, size, quantity)
                : setError("Choose your size before adding this pair.")
            }
            disabled={p.stock === 0}
          >
            {p.stock === 0 ? "Currently unavailable" : "Add to bag"}
            <ShoppingBag size={18} />
          </button>
          <p className="purchase-note">
            <Check size={14} />
            {p.price === null
              ? "Price and availability confirmed when you enquire."
              : "Final delivery details are confirmed at checkout."}
          </p>
          {settings?.whatsapp && (
            <a
              className="text-link"
              href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Hi QADAM FLEX, I would like to enquire about ${p.name}${size ? `, size ${size}` : ""}. ${window.location.href}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Enquire on WhatsApp <MessageCircle size={16} />
            </a>
          )}
          <div className="product-accordions">
            <Accordion title="The details" defaultOpen>
              <ul>
                {p.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Accordion>
            <Accordion title="Delivery & exchanges">
              <p>{settings?.deliveryText}</p>
              <p>{settings?.returnsText}</p>
              <Link className="text-link" to="/shipping">
                Read more <ArrowUpRight size={12} />
              </Link>
            </Accordion>
            <Accordion title="Finding your fit">
              <p>
                Select the size you usually wear. We will confirm the sizing
                system and availability before your order is finalized.
              </p>
            </Accordion>
          </div>
        </div>
      </div>
      <section className="related-products">
        <div className="section-heading">
          <div>
            <p className="eyebrow">KEEP EXPLORING</p>
            <h2>A different kind of step.</h2>
          </div>
          <Link className="text-link" to="/shop">
            All shoes <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="product-grid related-grid">
          {products
            .filter((x) => x.id !== p.id)
            .slice(0, 3)
            .map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
        </div>
      </section>
      <Modal
        open={zoom}
        onClose={() => setZoom(false)}
        label={`${p.name} enlarged photograph`}
      >
        <div className="modal-heading">
          <p>{p.name}</p>
          <button
            onClick={() => setZoom(false)}
            aria-label="Close enlarged photograph"
          >
            <X />
          </button>
        </div>
        <img className="zoom-image" src={p.images[selected]} alt={p.subtitle} />
      </Modal>
    </main>
  );
}

export function Wishlist() {
  const { products, wishlist } = useStore();
  const saved = products.filter((p) => wishlist.includes(p.id));
  return (
    <main className="section-pad wishlist-page">
      <div className="page-intro compact">
        <p className="eyebrow">YOUR PERSONAL EDIT</p>
        <h1>A few favourites.</h1>
        <p className="muted">The pairs you would like to come back to.</p>
      </div>
      {saved.length ? (
        <div className="product-grid">
          {saved.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Heart size={36} strokeWidth={1} />
          <h2>Something will catch your eye.</h2>
          <p>Tap the heart on a pair to save it here.</p>
          <Link className="button" to="/shop">
            Find your favourites <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </main>
  );
}

function SelectionSummary({ discount = 0 }: { discount?: number }) {
  const { products, cart, settings } = useStore();
  const priced =
    cart.length > 0 &&
    cart.every((i) => products.find((p) => p.id === i.id)?.price != null);
  const subtotal = cart.reduce(
    (n, i) =>
      n + (products.find((p) => p.id === i.id)?.price || 0) * i.quantity,
    0,
  );
  return (
    <>
      <div className="total-line">
        <span>Subtotal</span>
        <strong>{priced ? money(subtotal) : "Price on request"}</strong>
      </div>
      <div className="total-line muted">
        <span>Delivery</span>
        <span>
          {settings?.shippingFee != null
            ? money(settings.shippingFee)
            : "To be confirmed"}
        </span>
      </div>
      {discount > 0 && (
        <div className="total-line">
          <span>Discount</span>
          <span>−{money(discount)}</span>
        </div>
      )}
      <div className="total-line grand-total">
        <span>
          {priced && settings?.shippingFee != null ? "Total" : "Your selection"}
        </span>
        <strong>
          {priced && settings?.shippingFee != null
            ? money(subtotal - discount + settings.shippingFee)
            : `${cart.reduce((n, i) => n + i.quantity, 0)} pair${cart.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"}`}
        </strong>
      </div>
    </>
  );
}
export function Cart() {
  const { cart } = useStore();
  return (
    <main className="section-pad cart-page">
      <div className="page-intro compact">
        <p className="eyebrow">A STEP CLOSER</p>
        <h1>Your bag.</h1>
      </div>
      {cart.length ? (
        <div className="cart-layout">
          <div>
            <BagLines />
            <Link className="text-link continue-shopping" to="/shop">
              Continue exploring <ArrowUpRight size={16} />
            </Link>
          </div>
          <aside className="order-summary">
            <p className="eyebrow">THE SUMMARY</p>
            <SelectionSummary />
            <p className="muted small">
              We confirm prices, availability and delivery before any purchase
              is finalized.
            </p>
            <Link className="button full" to="/checkout">
              Continue <ArrowRight size={17} />
            </Link>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={40} strokeWidth={1} />
          <h2>Your next pair is out there.</h2>
          <p>Explore the collection to fill your bag.</p>
          <Link className="button" to="/shop">
            Shop the collection <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </main>
  );
}

export function Checkout() {
  const { cart, products, settings, clear } = useStore();
  const account = useAccount();
  const [paymentMethod, setPaymentMethod] = useState<Payment["method"]>("bank");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discountCode, setDiscountCode] = useState(""),
    [applied, setApplied] = useState(""),
    [discount, setDiscount] = useState(0),
    [discountError, setDiscountError] = useState("");
  const requestRef = useRef({ payload: "", key: requestId() }),
    navigate = useNavigate();
  const canOrder = Boolean(
    settings &&
    settings.shippingFee !== null &&
    cart.length &&
    cart.every((i) => {
      const p = products.find((p) => p.id === i.id);
      return p && p.price !== null && p.stockBySize?.[i.size] != null;
    }),
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (!account.user) {
      setBusy(false);
      navigate("/account?next=/checkout");
      return;
    }
    const f = new FormData(e.currentTarget);
    const payload = JSON.stringify({
      paymentMethod,
      customer: Object.fromEntries(f),
      items: cart,
      discountCode: applied,
    });
    if (requestRef.current.payload !== payload)
      requestRef.current = { payload, key: requestId() };
    try {
      const result = await api<{ reference: string; kind: string }>(
        "/api/requests",
        {
          method: "POST",
          body: payload,
          headers: {
            ...account.headers,
            "Idempotency-Key": requestRef.current.key,
          },
        },
      );
      sessionStorage.setItem("qf-last-confirmation", JSON.stringify(result));
      clear();
      navigate(`/account?order=${encodeURIComponent(result.reference)}`, {
        replace: true,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function applyCode() {
    setDiscountError("");
    try {
      const result = await api<{ discount: number }>("/api/discount", {
        method: "POST",
        body: JSON.stringify({ items: cart, code: discountCode }),
      });
      setDiscount(result.discount);
      setApplied(discountCode.toUpperCase());
    } catch (e) {
      setDiscountError((e as Error).message);
      setApplied("");
      setDiscount(0);
    }
  }
  useEffect(() => {
    setApplied("");
    setDiscount(0);
  }, [cart]);
  if (!cart.length)
    return (
      <main className="section-pad">
        <div className="empty-state">
          <ShoppingBag size={38} />
          <h1>Start with your next pair.</h1>
          <Link className="button" to="/shop">
            Explore the collection <ArrowRight size={18} />
          </Link>
        </div>
      </main>
    );
  return (
    <main className="checkout-page section-pad">
      <nav className="breadcrumbs">
        <Link to="/cart">Your bag</Link>
        <span>/</span>
        <span>{canOrder ? "Checkout" : "Your enquiry"}</span>
      </nav>
      <div className="checkout-layout">
        <section>
          <p className="eyebrow">THE NEXT STEP</p>
          <h1>{canOrder ? "Make them yours." : "Let’s find your pair."}</h1>
          <p className="muted checkout-intro">
            {canOrder
              ? "Confirm your details and choose how to pay."
              : "Share a few details. We will confirm the price, your size and delivery before you decide."}
          </p>
          <div className="checkout-account">
            {account.loading ? (
              <p role="status">Checking your account…</p>
            ) : account.user ? (
              <p>
                Signed in as <strong>{account.user.email}</strong> ·{" "}
                <Link to="/account">My account</Link>
              </p>
            ) : (
              <p>
                <Link to="/account?next=/checkout">Sign in</Link> or{" "}
                <Link to="/account?mode=register&next=/checkout">
                  create an account
                </Link>{" "}
                to track your order and submit payment proof.
              </p>
            )}
          </div>
          <form className="customer-form" onSubmit={submit}>
            <fieldset disabled={busy} key={account.user?.id || "guest"}>
              <legend>Your details</legend>
              <div className="form-row">
                <label>
                  Full name
                  <input
                    name="name"
                    defaultValue={account.user?.name}
                    autoComplete="name"
                    required
                    maxLength={80}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Mobile number
                  <input
                    name="phone"
                    defaultValue={account.user?.phone}
                    autoComplete="tel"
                    type="tel"
                    required
                    maxLength={30}
                    placeholder="03XX XXXXXXX"
                  />
                </label>
              </div>
              <label>
                City
                <input
                  name="city"
                  defaultValue={account.user?.city}
                  autoComplete="address-level2"
                  required
                  maxLength={80}
                  placeholder="Your city"
                />
              </label>
              <label>
                Delivery address
                <textarea
                  name="address"
                  defaultValue={account.user?.address}
                  autoComplete="street-address"
                  required
                  maxLength={500}
                  rows={3}
                  placeholder="House, street, area and any helpful directions"
                />
              </label>
              <label>
                Anything else? <span className="muted">(optional)</span>
                <textarea
                  name="notes"
                  maxLength={1000}
                  rows={2}
                  placeholder="Tell us about your usual shoe size or ask a question."
                />
              </label>
            </fieldset>
            <fieldset className="checkout-payment-options" disabled={busy}>
              <legend>Payment method</legend>
              {(
                [
                  ["bank", "Bank transfer", "Pay to the owner’s bank account"],
                  [
                    "easypaisa",
                    "Easypaisa",
                    "Transfer from your Easypaisa app",
                  ],
                  ...(settings?.codEnabled
                    ? [
                        [
                          "cod",
                          "Cash on delivery",
                          "Pay when your order arrives",
                        ],
                      ]
                    : []),
                ] as const
              ).map(([method, label, description]) => (
                <label
                  key={method}
                  className={`payment-option ${paymentMethod === method ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="payment-choice"
                    checked={paymentMethod === method}
                    onChange={() =>
                      setPaymentMethod(method as Payment["method"])
                    }
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
              {paymentMethod !== "cod" && (
                <PaymentDestination
                  payment={{
                    method: paymentMethod,
                    status: canOrder ? "awaiting_payment" : "not_required",
                  }}
                />
              )}
            </fieldset>
            <div className="checkout-reassurance">
              <CheckCircle2 size={21} />
              <div>
                <strong>
                  {canOrder
                    ? paymentMethod === "cod"
                      ? "Cash on delivery"
                      : "Payment proof, kept private"
                    : "Confirm first. Pay later."}
                </strong>
                <p>
                  {canOrder
                    ? paymentMethod === "cod"
                      ? "Pay the confirmed total when your order arrives."
                      : "Place your order, then upload your transfer receipt on the payment step. The owner will review it."
                    : "Send your selection. The store will confirm stock and delivery in your account before you pay."}
                </p>
              </div>
            </div>
            <p className="field-error" role="alert">
              {error}
            </p>
            <button
              type={account.user ? "submit" : "button"}
              onClick={
                !account.user
                  ? () => navigate("/account?next=/checkout")
                  : undefined
              }
              className="button full"
              disabled={busy || account.loading}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  Saving your request…
                </>
              ) : (
                <>
                  {!account.user
                    ? "Sign in to continue"
                    : canOrder
                      ? paymentMethod === "cod"
                        ? "Place order"
                        : "Place order & view payment"
                      : "Send my enquiry"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="legal-note">
              Your details are used to respond to this request.{" "}
              <Link to="/privacy">Privacy information</Link> ·{" "}
              <Link to="/payments">Bank & Easypaisa</Link>
            </p>
          </form>
        </section>
        <aside className="order-summary">
          <p className="eyebrow">YOUR CONSIDERED SELECTION</p>
          <BagLines />
          <SelectionSummary discount={discount} />
          {cart.every(
            (i) => products.find((p) => p.id === i.id)?.price != null,
          ) && (
            <div className="discount-form">
              <label htmlFor="discount">Have a discount code?</label>
              <div>
                <input
                  id="discount"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="Code"
                />
                <button type="button" onClick={() => void applyCode()}>
                  Apply
                </button>
              </div>
              {applied && <p className="success-note">{applied} applied.</p>}
              <p className="field-error" role="alert">
                {discountError}
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
export function Confirmation() {
  const location = useLocation();
  let result = location.state as { reference: string; kind: string } | null;
  if (!result)
    try {
      result = JSON.parse(
        sessionStorage.getItem("qf-last-confirmation") || "null",
      );
    } catch {
      /* empty */
    }
  return (
    <main className="confirmation section-pad">
      <span className="confirmation-icon">
        <Check size={30} />
      </span>
      <p className="eyebrow">A GOOD NEXT STEP</p>
      <h1>
        {result?.kind === "order"
          ? "Your order is recorded."
          : "Your enquiry is recorded."}
      </h1>
      <p>
        {result?.kind === "order"
          ? "Your cash-on-delivery order is awaiting confirmation."
          : "Your selected pairs and contact details are saved for the store to review."}
      </p>
      {result && (
        <div className="reference-box">
          <span className="eyebrow">YOUR REFERENCE</span>
          <strong>{result.reference}</strong>
        </div>
      )}
      <p className="muted">
        Keep your reference for any follow-up.
        <br />
        {result?.kind !== "order" && "No payment has been taken."}
      </p>
      <div className="confirmation-actions">
        <Link className="button" to="/shop">
          Keep exploring <ArrowRight size={17} />
        </Link>
        <Link className="text-link" to="/contact">
          Get in touch <ArrowUpRight size={14} />
        </Link>
      </div>
    </main>
  );
}

export function Contact() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reference, setReference] = useState("");
  const key = useRef(requestId());
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ reference: string }>("/api/messages", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      setReference(result.reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="contact-page section-pad">
      <p className="eyebrow">CONTACT</p>
      <div className="contact-layout">
        <section>
          <h1>Get in touch.</h1>
          <p className="muted">Questions about sizes, orders or delivery.</p>
          <div className="contact-details">
            <BusinessLinks />
          </div>
          <Link to="/payments" className="contact-payment-link">
            Bank & Easypaisa details <ArrowUpRight size={16} />
          </Link>
        </section>
        <section>
          {reference ? (
            <div className="message-success">
              <CheckCircle2 size={36} />
              <h2>A note, well received.</h2>
              <p>Your message has been recorded.</p>
              <p className="reference-box">{reference}</p>
            </div>
          ) : (
            <form className="customer-form" onSubmit={submit}>
              <fieldset disabled={busy}>
                <legend>Leave a note</legend>
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <label>
                  Mobile number
                  <input
                    type="tel"
                    name="phone"
                    required
                    maxLength={30}
                    autoComplete="tel"
                    placeholder="03XX XXXXXXX"
                  />
                </label>
                <label>
                  Your message
                  <textarea
                    name="message"
                    required
                    maxLength={1500}
                    rows={6}
                    placeholder="How can we help?"
                  />
                </label>
              </fieldset>
              <p className="field-error" role="alert">
                {error}
              </p>
              <button className="button full" disabled={busy}>
                {busy ? "Saving your note…" : "Send your note"}
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ArrowRight size={17} />
                )}
              </button>
              <p className="legal-note">
                Your contact details are used to respond to your note.{" "}
                <Link to="/privacy">Privacy information</Link> ·{" "}
                <Link to="/payments">Bank & Easypaisa</Link>
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export function InfoPage({ page }: { page: string }) {
  const { settings } = useStore();
  const content: Record<
    string,
    {
      eyebrow: string;
      title: string;
      intro: string;
      sections: [string, string][];
    }
  > = {
    about: {
      eyebrow: "OUR PERSPECTIVE",
      title: "Start with a good step.",
      intro:
        "QADAM FLEX is a footwear store with a considered edit of men’s loafers and formal shoes. We look for the details that give an everyday pair a little character.",
      sections: [
        [
          "An edited collection",
          "From textured loafers to polished formal silhouettes, our collection is deliberately small. Explore the actual product photographs and choose the details that speak to you.",
        ],
        [
          "A conversation before a purchase",
          "Enquire about the pair you like. We will confirm its price, sizing, availability and delivery details before your purchase is finalized.",
        ],
        [
          "Your style, your pace",
          "A simple shoe can bring an outfit together. Our perspective is uncomplicated: choose a pair you enjoy wearing.",
        ],
      ],
    },
    shipping: {
      eyebrow: "DELIVERY & EXCHANGES",
      title: "The details, before you order.",
      intro:
        "We want you to have the information you need before choosing your next pair.",
      sections: [
        [
          "Delivery",
          settings?.deliveryText ||
            "Tell us your city when you enquire. We will confirm delivery details before you order.",
        ],
        [
          "Exchanges & returns",
          settings?.returnsText ||
            "Please enquire about exchange and return terms before placing an order.",
        ],
        [
          "Sizes & fit",
          "Available size labels are 7, 8, 9, 10 and 11. The sizing system and product availability are confirmed when you enquire.",
        ],
        [
          "Order enquiries",
          "An enquiry reserves no stock and creates no payment obligation. Keep your reference if you need to follow up.",
        ],
      ],
    },
    privacy: {
      eyebrow: "YOUR INFORMATION",
      title: "A little clarity.",
      intro:
        "This store uses the details you provide to manage your enquiry or order.",
      sections: [
        [
          "What is collected",
          "Forms collect your name, email, contact and delivery details, selected products and sizes, and order notes. Accounts store a password hash and recovery-code hash. Manual payment orders may include a transaction reference and the receipt image you upload.",
        ],
        [
          "How it is used",
          "The store uses these details to manage your account, orders and payment review. You can view your own records after signing in. The store administrator can review orders and receipts; other customers cannot access them. Receipt images are not published as product images.",
        ],
        [
          "Essential browser storage",
          "Your bag and wishlist are saved in your browser. Essential, HTTP-only session cookies keep customers and the administrator signed in. Customer sessions last up to seven days unless you sign out or reset your password. This website does not include advertising trackers.",
        ],
        [
          "Questions or removal requests",
          "Contact the store through the contact page and include your enquiry or order reference. Avoid sending sensitive payment or identity documents through the message form.",
        ],
      ],
    },
    terms: {
      eyebrow: "STORE INFORMATION",
      title: "Before your next step.",
      intro:
        "Please confirm the details of your selected pair before completing a purchase.",
      sections: [
        [
          "Product information",
          "The supplied photographs show the available styles. Screen settings and lighting can affect how colors appear. Product names describe the store’s collection; visible manufacturer markings remain part of the photographs.",
        ],
        [
          "Pricing & availability",
          "“Price on request” means the amount and availability still need confirmation. Selecting a size or submitting an enquiry does not reserve stock.",
        ],
        [
          "Orders & payments",
          "An enquiry is not a purchase. Confirmed orders support bank transfer, Easypaisa or cash on delivery where available. Upload transfer receipts in your account; the store confirms payments manually. Do not pay for an enquiry until the store confirms the order and total.",
        ],
        [
          "Delivery & exchanges",
          "Delivery charges, timing, fit details and applicable exchange or return terms should be confirmed before purchasing.",
        ],
      ],
    },
  };
  const c = content[page] || content.about;
  return (
    <main className="info-page section-pad">
      <div className="info-title">
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p>{c.intro}</p>
      </div>
      {page === "about" && (
        <div className="about-image">
          <img
            src="/products/dark-suede.jpg"
            alt="The Midnight Penny loafer from the QADAM FLEX collection"
          />
        </div>
      )}
      <div className="info-sections">
        {c.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <Link className="button" to={page === "about" ? "/shop" : "/contact"}>
        {page === "about" ? "Explore the collection" : "Get in touch"}
        <ArrowUpRight size={17} />
      </Link>
    </main>
  );
}
export function FAQ() {
  const { settings } = useStore();
  return (
    <main className="faq-page section-pad">
      <div className="info-title">
        <p className="eyebrow">A LITTLE CLARITY</p>
        <h1>
          Good questions.
          <br />
          Simple answers.
        </h1>
      </div>
      <div className="faq-content">
        <Accordion title="How do I enquire about a pair?" defaultOpen>
          <p>
            Select your shoe, choose a size, and add it to your bag. Continue to
            the enquiry form and share your contact details. Keep the reference
            you receive.
          </p>
        </Accordion>
        <Accordion title="Which sizes are available?">
          <p>
            Our current size labels are 7–11. Ask us to confirm the sizing
            system and availability for your chosen pair.
          </p>
        </Accordion>
        <Accordion title="Why does a product say “Price on request”? ">
          <p>
            Its price has not been confirmed in the catalog. Submit an enquiry
            to discuss the pair before committing to a purchase.
          </p>
        </Accordion>
        <Accordion title="Do I need to pay when I enquire?">
          <p>
            No. An enquiry creates no payment obligation and does not reserve
            stock.
          </p>
        </Accordion>
        <Accordion title="How does delivery work?">
          <p>{settings?.deliveryText}</p>
        </Accordion>
        <Accordion title="Can I exchange or return a pair?">
          <p>{settings?.returnsText}</p>
        </Accordion>
        <Accordion title="How do I follow up?">
          <p>Use the contact page and include your saved request reference.</p>
        </Accordion>
      </div>
      <Link className="text-link" to="/contact">
        Something else on your mind? <ArrowUpRight size={16} />
      </Link>
    </main>
  );
}
export function NotFound() {
  return (
    <main className="section-pad">
      <div className="empty-state not-found">
        <p className="eyebrow">404 / A SMALL DETOUR</p>
        <h1>A step off the path.</h1>
        <p>We could not find that page. Your next pair is still waiting.</p>
        <Link className="button" to="/shop">
          Back to the collection <ArrowRight size={17} />
        </Link>
      </div>
    </main>
  );
}
export function checkoutItems(items: CartItem[]) {
  return items.map(({ id, size, quantity }) => ({ id, size, quantity }));
}
