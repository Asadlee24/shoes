import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Heart,
  ShoppingBag,
  UserRound,
  Menu,
  X,
  Plus,
  Minus,
  ChevronDown,
  Check,
  LoaderCircle,
  Sun,
  Moon,
  Truck,
} from "lucide-react";
import { useStore } from "./store";
import { useTheme } from "./theme";
import { BusinessLinks } from "./Business";
import { SocialLinks } from "./Social";
import { money } from "./api";
import type { Product } from "./types";

export function Brand({ signature = false }: { signature?: boolean }) {
  const wordmarkClip = useId();
  return (
    <Link
      to="/"
      aria-label="QADAM FLEX homepage"
      className={`brand brand-lockup ${signature ? "brand-signature" : ""}`}
    >
      {signature ? (
        <svg
          className="brand-complete"
          viewBox="245 40 955 1073"
          aria-hidden="true"
          focusable="false"
        >
          <image
            href="/brand/logo-transparent.png"
            width="1413"
            height="1113"
          />
        </svg>
      ) : (
        <>
          <svg
            className="brand-emblem"
            viewBox="275 40 845 670"
            aria-hidden="true"
            focusable="false"
          >
            <image
              href="/brand/logo-transparent.png"
              width="1413"
              height="1113"
            />
          </svg>
          <svg
            className="brand-wordmark"
            viewBox="245 710 955 403"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <clipPath id={wordmarkClip} clipPathUnits="userSpaceOnUse">
                {/* Exclude the shoe's remaining sole pixels above the letters,
                    while retaining the taller curved top of the Q. */}
                <path d="M245 710H415V714H1200V1113H245Z" />
              </clipPath>
            </defs>
            <image
              href="/brand/logo-transparent.png"
              width="1413"
              height="1113"
              clipPath={`url(#${wordmarkClip})`}
            />
          </svg>
        </>
      )}
    </Link>
  );
}
export function Header() {
  const { settings, cart, wishlist, setBagOpen } = useStore();
  const { theme, toggleTheme } = useTheme();
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false);
  const location = useLocation(),
    navigate = useNavigate();
  const home = location.pathname === "/";
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [location.pathname, location.search]);
  return (
    <>
      <div
        className={`announcement ${home ? "dark" : ""} ${settings?.shippingFee === 0 ? "has-free-delivery" : ""}`}
      >
        <span>
          {settings?.shippingFee === 0 ? (
            <>
              <Truck size={13} aria-hidden="true" /> FREE DELIVERY ON ALL ORDERS
            </>
          ) : settings?.announcement &&
            settings.announcement !==
              "A considered collection. A better step." ? (
            settings.announcement
          ) : (
            "Loafers & formal shoes · Sizes 7–11"
          )}
        </span>
        <span className="announcement-right">PAKISTAN · PKR</span>
      </div>
      <header className={`header ${home ? "header-dark" : ""}`}>
        <div className="header-inner">
          <Brand />
          <nav aria-label="Main navigation" className="desktop-nav">
            <Link
              to="/shop"
              className={location.pathname === "/shop" ? "active" : ""}
            >
              Shop all <ChevronDown size={12} />
            </Link>
            <Link to="/shop?category=Loafers">Loafers</Link>
            <Link to="/shop?category=Formal+shoes">Formal shoes</Link>
            <Link to="/shop?category=Sneakers">Sneakers</Link>
            <Link to="/about">About</Link>
          </nav>
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              aria-label="Search the collection"
              onClick={() => setSearch(true)}
            >
              <Search size={19} />
            </button>
            <Link
              className="account-nav"
              to="/account"
              aria-label="Your account and orders"
              title="Your account"
            >
              <UserRound size={19} />
            </Link>
            <Link
              className="wish-nav"
              to="/wishlist"
              aria-label={`Wishlist, ${wishlist.length} saved products`}
            >
              <Heart size={19} />
              {wishlist.length > 0 && (
                <span className="count">{wishlist.length}</span>
              )}
            </Link>
            <button
              className="bag-trigger"
              onClick={() => setBagOpen(true)}
              aria-label={`Open bag, ${cart.reduce((n, i) => n + i.quantity, 0)} items`}
            >
              <ShoppingBag size={19} />
              <span className="count">
                {cart.reduce((n, i) => n + i.quantity, 0)}
              </span>
            </button>
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>
      <Modal
        open={menu}
        onClose={() => setMenu(false)}
        label="Navigation"
        drawer
      >
        <div className="modal-heading">
          <Brand />
          <button aria-label="Close menu" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <nav className="mobile-links">
          <Link to="/account">
            Your account & orders <UserRound />
          </Link>
          <Link to="/shop">
            Shop all <ArrowUpRight />
          </Link>
          <Link to="/shop?category=Loafers">
            Loafers <ArrowUpRight />
          </Link>
          <Link to="/shop?category=Formal+shoes">
            Formal shoes <ArrowUpRight />
          </Link>
          <Link to="/shop?category=Sneakers">
            Sneakers <ArrowUpRight />
          </Link>
          <Link to="/about">
            About <ArrowUpRight />
          </Link>
          <Link to="/contact">
            Get in touch <ArrowUpRight />
          </Link>
        </nav>
        <SocialLinks />
        <p className="eyebrow">Sizes 7–11 · Pakistan</p>
      </Modal>
      <Modal
        open={search}
        onClose={() => setSearch(false)}
        label="Search the collection"
      >
        <div className="modal-heading">
          <h2>Find your next pair.</h2>
          <button aria-label="Close search" onClick={() => setSearch(false)}>
            <X />
          </button>
        </div>
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            navigate(`/shop?q=${encodeURIComponent(String(q || ""))}`);
            setSearch(false);
          }}
        >
          <Search size={22} />
          <input
            name="q"
            type="search"
            placeholder="Try suede, black, or formal…"
            aria-label="Search products"
            autoFocus
          />
          <button className="icon-circle" aria-label="Search">
            <ArrowRight />
          </button>
        </form>
        <p className="muted">
          Explore the details. Find the pair that feels like you.
        </p>
        <div className="search-suggestions">
          <Link to="/shop?q=suede">
            Suede loafers <ArrowUpRight size={16} />
          </Link>
          <Link to="/shop?category=Formal+shoes">
            Formal shoes <ArrowUpRight size={16} />
          </Link>
        </div>
      </Modal>
    </>
  );
}

export function Modal({
  open,
  onClose,
  label,
  children,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${drawer ? "drawer" : ""}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = ref.current.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const { wishlist, toggleWish, setQuick } = useStore();
  const saved = wishlist.includes(product.id);
  const studioImage =
    product.id === "textured-bit"
      ? "/products/hero-textured.png"
      : product.id === "suede-penny"
        ? "/products/hero-loafer.png"
        : null;
  return (
    <article className="product-card reveal">
      <div
        className={`product-media ${product.id === "midnight-penny" ? "midnight-media" : ""} ${studioImage ? "cutout-card" : ""} ${product.id === "textured-bit" ? "textured-cutout-card" : ""}`}
      >
        <span className="product-index">0{index + 1} / QF</span>
        <Link
          to={`/product/${product.slug}`}
          aria-label={`View ${product.name}`}
        >
          <img
            src={studioImage || product.image}
            alt={product.subtitle}
            style={
              studioImage
                ? undefined
                : { objectPosition: product.imagePosition }
            }
            loading="lazy"
            width="900"
            height="1200"
          />
        </Link>
        <button
          className={`save-product ${saved ? "saved" : ""}`}
          onClick={() => toggleWish(product.id)}
          aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} wishlist`}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        <button className="quick-view" onClick={() => setQuick(product.id)}>
          A closer look <Plus size={17} />
        </button>
      </div>
      <div className="product-meta">
        <div>
          <Link to={`/product/${product.slug}`}>
            <h3>{product.name}</h3>
          </Link>
          <p>
            {product.category} <span>·</span> {product.color}
          </p>
        </div>
        <span
          className="color-dot"
          style={{ background: product.swatch }}
          aria-label={product.color}
        />
      </div>
      <div className="product-price">
        {money(product.price)}
        {product.price === null && <ArrowUpRight size={14} />}
      </div>
    </article>
  );
}
export function SizeSelector({
  product,
  size,
  setSize,
}: {
  product: Product;
  size: string;
  setSize: (value: string) => void;
}) {
  const [guide, setGuide] = useState(false);
  return (
    <>
      <div className="size-heading">
        <label>
          Choose your size <span>{size && `— ${size}`}</span>
        </label>
        <button onClick={() => setGuide(true)} className="text-link">
          Size guide <ArrowUpRight size={12} />
        </button>
      </div>
      <div className="size-options">
        {product.sizes.map((s) => (
          <button
            key={s}
            className={s === size ? "selected" : ""}
            onClick={() => setSize(s)}
            aria-pressed={size === s}
            disabled={product.stockBySize?.[s] === 0}
            title={
              product.stockBySize?.[s] === 0
                ? "Currently unavailable"
                : undefined
            }
          >
            {s}
          </button>
        ))}
      </div>
      <Modal open={guide} onClose={() => setGuide(false)} label="Size guide">
        <div className="modal-heading">
          <h2>A good fit starts here.</h2>
          <button onClick={() => setGuide(false)} aria-label="Close size guide">
            <X />
          </button>
        </div>
        <p>Available size labels: {product.sizes.join(", ")}.</p>
        <p className="muted">
          Tell us the size you usually wear when you enquire. We will confirm
          the sizing system, fit and availability for your selected pair. A
          measurement chart has not been provided yet.
        </p>
      </Modal>
    </>
  );
}
export function QuickView() {
  const { quick, setQuick, products, add } = useStore();
  const p = products.find((p) => p.id === quick);
  const [size, setSize] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setSize("");
    setError("");
  }, [quick]);
  return (
    <Modal
      open={Boolean(p)}
      onClose={() => setQuick(null)}
      label={p?.name || "Product quick view"}
    >
      {p && (
        <>
          <div className="modal-heading">
            <p className="eyebrow">A CLOSER LOOK</p>
            <button onClick={() => setQuick(null)} aria-label="Close product">
              <X />
            </button>
          </div>
          <div className="quick-layout">
            <div className="quick-image">
              <img
                src={p.image}
                style={{ objectPosition: p.imagePosition }}
                alt={p.subtitle}
              />
            </div>
            <div>
              <p className="eyebrow">{p.category}</p>
              <h2>{p.name}</h2>
              <p className="muted">{p.color}</p>
              <p className="price-large">{money(p.price)}</p>
              <SizeSelector
                product={p}
                size={size}
                setSize={(s) => {
                  setSize(s);
                  setError("");
                }}
              />
              <p className="field-error" role="alert">
                {error}
              </p>
              <button
                className="button full"
                onClick={() =>
                  size
                    ? add(p.id, size)
                    : setError("Choose a size to continue.")
                }
                disabled={p.stock === 0}
              >
                {p.stock === 0 ? "Currently unavailable" : "Add to bag"}
                <ShoppingBag size={17} />
              </button>
              <Link
                className="text-link quick-details"
                to={`/product/${p.slug}`}
                onClick={() => setQuick(null)}
              >
                Explore this pair <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
export function Quantity({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="quantity">
      <button
        aria-label="Decrease quantity"
        onClick={() => onChange(value - 1)}
      >
        <Minus size={13} />
      </button>
      <span>{value}</span>
      <button
        aria-label="Increase quantity"
        disabled={value >= 10}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
export function BagLines() {
  const { cart, products, update, setBagOpen } = useStore();
  return (
    <>
      {cart.map((item) => {
        const p = products.find((p) => p.id === item.id);
        return (
          <div className="bag-line" key={`${item.id}:${item.size}`}>
            {p ? (
              <>
                <Link
                  to={`/product/${p.slug}`}
                  onClick={() => setBagOpen(false)}
                  className="bag-image"
                >
                  <img
                    src={p.image}
                    alt={p.subtitle}
                    style={{ objectPosition: p.imagePosition }}
                  />
                </Link>
                <div className="bag-info">
                  <Link
                    to={`/product/${p.slug}`}
                    onClick={() => setBagOpen(false)}
                  >
                    <h3>{p.name}</h3>
                  </Link>
                  <p>
                    {p.color} · Size {item.size}
                  </p>
                  <p>{money(p.price)}</p>
                  <Quantity
                    value={item.quantity}
                    onChange={(q) => update(item.id, item.size, q)}
                  />
                </div>
              </>
            ) : (
              <div className="bag-info">
                <h3>Unavailable product</h3>
                <p>Remove this item to continue.</p>
              </div>
            )}
            <button
              className="remove-line"
              aria-label={`Remove ${p?.name || "item"}, size ${item.size}`}
              onClick={() => update(item.id, item.size, 0)}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </>
  );
}
export function BagDrawer() {
  const { bagOpen, setBagOpen, cart, products } = useStore();
  const priced =
    cart.length > 0 &&
    cart.every((i) => products.find((p) => p.id === i.id)?.price != null);
  const total = cart.reduce(
    (n, i) =>
      n + (products.find((p) => p.id === i.id)?.price || 0) * i.quantity,
    0,
  );
  return (
    <Modal
      open={bagOpen}
      onClose={() => setBagOpen(false)}
      label="Your shopping bag"
      drawer
    >
      <div className="modal-heading">
        <h2>
          Your bag{" "}
          <span className="small-count">
            {cart.reduce((n, i) => n + i.quantity, 0)}
          </span>
        </h2>
        <button aria-label="Close bag" onClick={() => setBagOpen(false)}>
          <X />
        </button>
      </div>
      {cart.length ? (
        <>
          <div className="drawer-lines">
            <BagLines />
          </div>
          <div className="drawer-bottom">
            <div className="total-line">
              <span>{priced ? "Subtotal" : "Pricing"}</span>
              <strong>{priced ? money(total) : "Confirmed on enquiry"}</strong>
            </div>
            <p className="muted small">
              {priced
                ? "Delivery and final availability are confirmed at the next step."
                : "Send your selection. We will confirm prices, sizes and delivery before you order."}
            </p>
            <Link
              className="button full"
              to="/checkout"
              onClick={() => setBagOpen(false)}
            >
              Continue with your selection <ArrowRight size={17} />
            </Link>
            <Link
              className="text-link center"
              to="/cart"
              onClick={() => setBagOpen(false)}
            >
              View your bag
            </Link>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={38} strokeWidth={1} />
          <h3>Your bag is empty.</h3>
          <p>Add a pair from the collection.</p>
          <Link className="button" to="/shop" onClick={() => setBagOpen(false)}>
            Explore the collection <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </Modal>
  );
}
export function Footer() {
  const { settings } = useStore();
  return (
    <footer className="footer">
      {settings?.shippingFee === 0 && (
        <div className="footer-delivery">
          <Truck size={19} aria-hidden="true" />
          <span>Free delivery on all orders</span>
          <span>PAKISTAN · PKR</span>
        </div>
      )}
      <div className="footer-top">
        <div className="footer-brand">
          <Brand signature />
          <Link to="/shop" className="footer-action">
            Shop all <ArrowUpRight />
          </Link>
        </div>
        <div className="footer-links">
          <div>
            <p>THE COLLECTION</p>
            <Link to="/shop">Shop all</Link>
            <Link to="/shop?category=Loafers">Loafers</Link>
            <Link to="/shop?category=Formal+shoes">Formal shoes</Link>
            <Link to="/wishlist">Your saved pairs</Link>
          </div>
          <div>
            <p>HERE TO HELP</p>
            <Link to="/account">Your account & orders</Link>
            <Link to="/contact">Get in touch</Link>
            <Link to="/faq">Questions & answers</Link>
            <Link to="/payments">Bank & Easypaisa</Link>
            <Link to="/shipping">Delivery & exchanges</Link>
            <Link to="/about">About</Link>
          </div>
          <div>
            <p>CONTACT</p>
            <BusinessLinks showWebsite={false} />
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} QADAM FLEX</span>
        <span>PAKISTAN · PKR</span>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>Opening the collection…</span>
    </div>
  );
}
export function ErrorState() {
  const { error, reload } = useStore();
  return (
    <div className="empty-state">
      <h2>Let’s try that again.</h2>
      <p>{error}</p>
      <button className="button" onClick={() => void reload()}>
        Reload collection <ArrowRight size={17} />
      </button>
    </div>
  );
}
export function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="accordion" open={defaultOpen || undefined}>
      <summary>
        {title}
        <Plus size={16} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function ServiceStrip() {
  return (
    <div className="service-strip">
      <span>
        <Check size={16} /> Sizes 7–11
      </span>
      <span>
        <ShoppingBag size={16} /> An edited collection
      </span>
      <Link to="/contact">
        Find your fit with us <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}
