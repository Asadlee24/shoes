import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ImagePlus,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Package,
  Plus,
  Save,
  Settings2,
  ShoppingBag,
  X,
} from "lucide-react";
import { api, money } from "./api";
import { useStore } from "./store";
import { Modal } from "./components";
import type { Discount, Product, Settings, StoreRequest } from "./types";

type Dashboard = {
  products: Product[];
  settings: Settings;
  requests: StoreRequest[];
};
export default function Admin() {
  const { reload } = useStore();
  const [csrf, setCsrf] = useState(""),
    [loading, setLoading] = useState(true),
    [loginError, setLoginError] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("overview"),
    [data, setData] = useState<Dashboard | null>(null),
    [edit, setEdit] = useState<Product | null>(null),
    [creating, setCreating] = useState(false),
    [request, setRequest] = useState<StoreRequest | null>(null),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState<Settings | null>(null),
    [requestFilter, setRequestFilter] = useState("all");
  const headers = { "X-CSRF-Token": csrf };
  const refresh = useCallback(async () => {
    try {
      const d = await api<Dashboard>("/api/admin/dashboard");
      setData(d);
      setSettings(d.settings);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void api<{ csrf: string }>("/api/admin/session")
      .then((s) => {
        setCsrf(s.csrf);
        return refresh();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const d = await api<{ csrf: string }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      setCsrf(d.csrf);
      await refresh();
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await api("/api/admin/logout", { method: "POST", headers });
    setCsrf("");
    setData(null);
  }
  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      await api(
        creating ? "/api/admin/products" : `/api/admin/products/${edit.id}`,
        {
          method: creating ? "POST" : "PUT",
          headers,
          body: JSON.stringify(edit),
        },
      );
      setEdit(null);
      setCreating(false);
      await refresh();
      await reload();
      setNotice("Product saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify(settings),
      });
      await refresh();
      await reload();
      setNotice("Store settings saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(r: StoreRequest, status: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/requests/${r.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      await refresh();
      setRequest({ ...r, status });
      setNotice("Request status updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files || !edit) return;
    setBusy(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 12 - edit.images.length)) {
        if (file.size > 3000000)
          throw Error("Choose images smaller than 3 MB.");
        const b64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1]);
          r.onerror = () => reject(Error("Could not read image."));
          r.readAsDataURL(file);
        });
        const r = await api<{ url: string }>("/api/admin/upload", {
          method: "POST",
          headers,
          body: JSON.stringify({ type: file.type, data: b64 }),
        });
        urls.push(r.url);
      }
      setEdit({
        ...edit,
        images: [...edit.images, ...urls],
        image: edit.image || urls[0],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function createProduct() {
    setCreating(true);
    setEdit({
      id: "",
      slug: "",
      name: "",
      subtitle: "",
      category: "Loafers",
      color: "",
      swatch: "#333333",
      price: null,
      stock: null,
      sizes: ["7", "8", "9", "10", "11"],
      published: false,
      featured: false,
      image: "",
      images: [],
      description: "",
      details: [],
      imagePosition: "50% 70%",
    });
  }
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(id);
  }, [notice]);
  if (loading)
    return (
      <div className="admin-login">
        <LoaderCircle className="spin" />
      </div>
    );
  if (!csrf)
    return (
      <main className="admin-login">
        <Link className="eyebrow" to="/">
          QADAM FLEX / STORE MANAGEMENT
        </Link>
        <div className="login-panel">
          <span className="admin-login-icon">
            <ShoppingBag size={29} />
          </span>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>
            A considered
            <br />
            store.
          </h1>
          <p className="muted">
            Sign in to manage your collection and enquiries.
          </p>
          <form className="customer-form" onSubmit={login}>
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                required
                defaultValue="admin"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <p className="field-error" role="alert">
              {loginError}
            </p>
            <button className="button full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="admin-setup-note">
            First time? Run <code>npm run admin:setup</code> in the project
            terminal, then restart the server.
          </p>
        </div>
        <Link className="text-link" to="/">
          Back to the store <ArrowUpRight size={14} />
        </Link>
      </main>
    );
  const incomplete =
    data?.products.filter(
      (p) => p.published && (p.price === null || p.stock === null),
    ).length || 0;
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-logo">
          QADAM<span>FLEX / STORE</span>
        </Link>
        <p className="eyebrow">WORKSPACE</p>
        <nav>
          {[
            ["overview", "Overview", LayoutGrid],
            ["products", "Collection", Package],
            ["requests", "Orders & enquiries", ShoppingBag],
            ["settings", "Store settings", Settings2],
          ].map(([id, label, Icon]) => (
            <button
              key={String(id)}
              onClick={() => {
                setTab(String(id));
                setError("");
              }}
              className={tab === id ? "active" : ""}
            >
              <Icon size={18} />
              {String(label)}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/" target="_blank">
            View storefront <ArrowUpRight size={16} />
          </Link>
          <button onClick={() => void logout()}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span>
            QADAM FLEX /{" "}
            {tab === "requests" ? "ORDERS & ENQUIRIES" : tab.toUpperCase()}
          </span>
          <span className="admin-user">
            ADMIN <span className="user-dot">A</span>
          </span>
        </header>
        <div className="admin-body">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success-banner" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {!data ? (
            <button className="button" onClick={() => void refresh()}>
              Load store data
            </button>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <div className="admin-page-heading">
                    <div>
                      <p className="eyebrow">YOUR STORE, AT A GLANCE</p>
                      <h1>Good to see you.</h1>
                      <p className="muted">
                        Your collection and customer conversations.
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={() => {
                        setTab("products");
                        createProduct();
                      }}
                    >
                      Add a product <Plus size={16} />
                    </button>
                  </div>
                  <div className="admin-stat-grid">
                    {[
                      [
                        "Published products",
                        data.products.filter((p) => p.published).length,
                      ],
                      [
                        "New enquiries",
                        data.requests.filter(
                          (r) => r.kind === "inquiry" && r.status === "new",
                        ).length,
                      ],
                      [
                        "Orders",
                        data.requests.filter((r) => r.kind === "order").length,
                      ],
                      [
                        "Draft products",
                        data.products.filter((p) => !p.published).length,
                      ],
                    ].map(([label, value]) => (
                      <div className="admin-stat" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  {incomplete > 0 && (
                    <div className="setup-banner">
                      <div>
                        <h3>A few details to finish.</h3>
                        <p>
                          {incomplete} published products need prices or stock.
                          They currently accept enquiries. Add your business
                          contact and delivery details in store settings.
                        </p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => setTab("settings")}
                      >
                        Complete setup <ArrowUpRight size={15} />
                      </button>
                    </div>
                  )}
                  <div className="admin-section-title">
                    <h2>Recent conversations</h2>
                    <button
                      className="text-link"
                      onClick={() => setTab("requests")}
                    >
                      View all <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <RequestTable
                    requests={data.requests.slice(0, 6)}
                    onSelect={setRequest}
                  />
                </>
              )}
              {tab === "products" && (
                <>
                  <div className="admin-page-heading">
                    <div>
                      <p className="eyebrow">THE COLLECTION</p>
                      <h1>Every pair, considered.</h1>
                    </div>
                    <button className="button" onClick={createProduct}>
                      Add a product <Plus size={16} />
                    </button>
                  </div>
                  <div className="admin-products">
                    {data.products.map((p) => (
                      <article key={p.id}>
                        <div className="admin-product-photo">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.subtitle}
                              style={{ objectPosition: p.imagePosition }}
                            />
                          ) : (
                            <ImagePlus size={28} />
                          )}
                          <span
                            className={`status-pill ${p.published ? "published" : ""}`}
                          >
                            {p.published ? "Published" : "Draft"}
                          </span>
                        </div>
                        <div className="admin-product-meta">
                          <p>{p.category}</p>
                          <h3>{p.name}</h3>
                          <span>
                            {money(p.price)} ·{" "}
                            {p.stock === null
                              ? "Stock unconfirmed"
                              : `${p.stock} in stock`}
                          </span>
                          <button
                            className="text-link"
                            onClick={() => {
                              setCreating(false);
                              setEdit(structuredClone(p));
                              setError("");
                            }}
                          >
                            Edit product <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "requests" && (
                <>
                  <div className="admin-page-heading">
                    <div>
                      <p className="eyebrow">CUSTOMER CONVERSATIONS</p>
                      <h1>Orders & enquiries.</h1>
                    </div>
                    <select
                      aria-label="Filter requests"
                      value={requestFilter}
                      onChange={(e) => setRequestFilter(e.target.value)}
                    >
                      <option value="all">All requests</option>
                      <option value="inquiry">Enquiries</option>
                      <option value="order">Orders</option>
                      <option value="new">New enquiries</option>
                    </select>
                  </div>
                  <RequestTable
                    requests={data.requests.filter((r) =>
                      requestFilter === "all" || requestFilter === "new"
                        ? requestFilter === "all" || r.status === "new"
                        : r.kind === requestFilter,
                    )}
                    onSelect={setRequest}
                  />
                </>
              )}
              {tab === "settings" && settings && (
                <>
                  <div className="admin-page-heading">
                    <div>
                      <p className="eyebrow">THE BUSINESS DETAILS</p>
                      <h1>Make it your store.</h1>
                    </div>
                  </div>
                  <form
                    onSubmit={saveSettings}
                    className="admin-settings customer-form"
                  >
                    <section>
                      <h2>Contact & identity</h2>
                      <div className="form-row">
                        <label>
                          Contact email
                          <input
                            type="email"
                            value={settings.email}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          WhatsApp number
                          <input
                            placeholder="923XXXXXXXXX"
                            value={settings.whatsapp}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                whatsapp: e.target.value,
                              })
                            }
                          />
                          <small>
                            Country code and digits only. Leave empty to hide.
                          </small>
                        </label>
                      </div>
                      <div className="form-row">
                        <label>
                          Instagram username
                          <input
                            value={settings.instagram}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                instagram: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Business address
                          <input
                            value={settings.address}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                address: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Announcement
                        <input
                          value={settings.announcement}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              announcement: e.target.value,
                            })
                          }
                        />
                      </label>
                    </section>
                    <section>
                      <h2>Official details & manual payments</h2>
                      {(
                        [
                          ["website", "Official website"],
                          ["phone", "Contact number"],
                          ["tiktok", "TikTok username"],
                          ["bankAccountHolder", "Bank account holder"],
                          ["bankIban", "Bank IBAN"],
                          ["bankAccountNumber", "Bank account number"],
                          ["easypaisaHolder", "Easypaisa account holder"],
                          ["easypaisaNumber", "Easypaisa number"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            value={settings[key] || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                [key]: e.target.value,
                              })
                            }
                            maxLength={200}
                          />
                        </label>
                      ))}
                    </section>
                    <section>
                      <h2>Delivery & checkout</h2>
                      <label>
                        Delivery fee in PKR
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Leave empty until confirmed"
                          value={
                            settings.shippingFee === null
                              ? ""
                              : settings.shippingFee / 100
                          }
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              shippingFee:
                                e.target.value === ""
                                  ? null
                                  : Math.round(Number(e.target.value) * 100),
                            })
                          }
                        />
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.codEnabled}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              codEnabled: e.target.checked,
                            })
                          }
                        />
                        Enable cash on delivery for products with confirmed
                        prices and stock
                      </label>
                      <label>
                        Delivery information
                        <textarea
                          rows={3}
                          value={settings.deliveryText}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              deliveryText: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Returns & exchange terms
                        <textarea
                          rows={3}
                          value={settings.returnsText}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              returnsText: e.target.value,
                            })
                          }
                        />
                      </label>
                    </section>
                    <section>
                      <div className="admin-section-title">
                        <h2>Discount codes</h2>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              discounts: [
                                ...(settings.discounts || []),
                                {
                                  code: "",
                                  type: "percent",
                                  value: 10,
                                  minimum: 0,
                                  expires: null,
                                  active: false,
                                },
                              ],
                            })
                          }
                        >
                          Add code <Plus size={15} />
                        </button>
                      </div>
                      <p className="muted small">
                        Codes apply only to priced products. Fixed amounts and
                        minimums below are in PKR.
                      </p>
                      {(settings.discounts || []).map((d, i) => {
                        const change = (p: Partial<Discount>) =>
                          setSettings({
                            ...settings,
                            discounts: settings.discounts!.map((x, j) =>
                              j === i ? { ...x, ...p } : x,
                            ),
                          });
                        return (
                          <div className="discount-editor" key={i}>
                            <label>
                              Code
                              <input
                                value={d.code}
                                onChange={(e) =>
                                  change({ code: e.target.value.toUpperCase() })
                                }
                              />
                            </label>
                            <label>
                              Type
                              <select
                                value={d.type}
                                onChange={(e) =>
                                  change({
                                    type: e.target.value as Discount["type"],
                                    value: 10,
                                  })
                                }
                              >
                                <option value="percent">Percent</option>
                                <option value="fixed">Fixed PKR</option>
                              </select>
                            </label>
                            <label>
                              Amount
                              <input
                                type="number"
                                min="1"
                                max={d.type === "percent" ? 100 : undefined}
                                value={
                                  d.type === "fixed" ? d.value / 100 : d.value
                                }
                                onChange={(e) =>
                                  change({
                                    value: Math.round(
                                      Number(e.target.value) *
                                        (d.type === "fixed" ? 100 : 1),
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Minimum PKR
                              <input
                                type="number"
                                min="0"
                                value={d.minimum / 100}
                                onChange={(e) =>
                                  change({
                                    minimum: Math.round(
                                      Number(e.target.value) * 100,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Expiry
                              <input
                                type="date"
                                value={d.expires?.slice(0, 10) || ""}
                                onChange={(e) =>
                                  change({
                                    expires: e.target.value
                                      ? `${e.target.value}T23:59:59.000Z`
                                      : null,
                                  })
                                }
                              />
                            </label>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={d.active}
                                onChange={(e) =>
                                  change({ active: e.target.checked })
                                }
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              aria-label="Remove discount"
                              onClick={() =>
                                setSettings({
                                  ...settings,
                                  discounts: settings.discounts!.filter(
                                    (_, j) => j !== i,
                                  ),
                                })
                              }
                            >
                              <X size={17} />
                            </button>
                          </div>
                        );
                      })}
                    </section>
                    <button className="button" disabled={busy}>
                      {busy ? "Saving…" : "Save store settings"}
                      <Save size={17} />
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Modal
        open={Boolean(edit)}
        onClose={() => {
          if (!busy) setEdit(null);
        }}
        label="Edit product"
        drawer
      >
        {edit && (
          <form className="customer-form product-editor" onSubmit={saveProduct}>
            <div className="modal-heading">
              <h2>{creating ? "A new pair." : "Edit this pair."}</h2>
              <button
                type="button"
                aria-label="Close editor"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                <X />
              </button>
            </div>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <label>
              Product name
              <input
                required
                maxLength={100}
                value={edit.name}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    name: e.target.value,
                    ...(creating
                      ? {
                          slug: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/-$/, ""),
                        }
                      : {}),
                  })
                }
              />
            </label>
            <label>
              Product link
              <input
                required
                value={edit.slug}
                onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
              />
            </label>
            <label>
              Short description
              <input
                value={edit.subtitle}
                onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Collection
                <select
                  value={edit.category}
                  onChange={(e) =>
                    setEdit({ ...edit, category: e.target.value })
                  }
                >
                  <option>Loafers</option>
                  <option>Formal shoes</option>
                </select>
              </label>
              <label>
                Color
                <input
                  required
                  value={edit.color}
                  onChange={(e) => setEdit({ ...edit, color: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Price in PKR
                <input
                  type="number"
                  min="1"
                  placeholder="Price on request"
                  value={edit.price === null ? "" : edit.price / 100}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      price:
                        e.target.value === ""
                          ? null
                          : Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </label>
              <label>
                Stock confirmation
                <span className="muted">
                  Set quantities for each size below.
                </span>
              </label>
            </div>
            <label>
              Color swatch
              <input
                type="color"
                value={edit.swatch}
                onChange={(e) => setEdit({ ...edit, swatch: e.target.value })}
              />
            </label>
            <label>Available size labels</label>
            <div className="size-options">
              {["7", "8", "9", "10", "11"].map((s) => (
                <button
                  type="button"
                  key={s}
                  className={edit.sizes.includes(s) ? "selected" : ""}
                  onClick={() =>
                    setEdit({
                      ...edit,
                      sizes: edit.sizes.includes(s)
                        ? edit.sizes.filter((x) => x !== s)
                        : [...edit.sizes, s],
                    })
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="size-stock-grid">
              {edit.sizes.map((s) => (
                <label key={s}>
                  Size {s} stock
                  <input
                    type="number"
                    min="0"
                    placeholder="Unconfirmed"
                    value={edit.stockBySize?.[s] ?? ""}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        stockBySize: {
                          ...edit.stockBySize,
                          [s]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Description
              <textarea
                rows={4}
                value={edit.description}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </label>
            <label>
              Details (one per line)
              <textarea
                rows={4}
                value={edit.details.join("\n")}
                onChange={(e) =>
                  setEdit({ ...edit, details: e.target.value.split("\n") })
                }
              />
            </label>
            <label>
              Gallery <span className="muted">— first image is the cover</span>
            </label>
            <div className="admin-gallery">
              {edit.images.map((src, i) => (
                <div key={src}>
                  <img src={src} alt={`Product image ${i + 1}`} />
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() =>
                      setEdit({
                        ...edit,
                        images: edit.images.filter((x) => x !== src),
                      })
                    }
                  >
                    <X size={13} />
                  </button>
                  {i > 0 && (
                    <button
                      type="button"
                      className="make-cover"
                      onClick={() =>
                        setEdit({
                          ...edit,
                          images: [
                            src,
                            ...edit.images.filter((x) => x !== src),
                          ],
                        })
                      }
                    >
                      Cover
                    </button>
                  )}
                </div>
              ))}
            </div>
            <label className="upload-label">
              <ImagePlus size={18} />
              Add photos (JPG, PNG, WebP; up to 3 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={busy}
                onChange={(e) => void upload(e.target.files)}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={edit.published}
                onChange={(e) =>
                  setEdit({ ...edit, published: e.target.checked })
                }
              />
              Publish in the store
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={edit.featured}
                onChange={(e) =>
                  setEdit({ ...edit, featured: e.target.checked })
                }
              />
              Feature on the homepage
            </label>
            <button className="button full" disabled={busy}>
              {busy ? "Saving…" : "Save product"}
              <Save size={17} />
            </button>
          </form>
        )}
      </Modal>
      <Modal
        open={Boolean(request)}
        onClose={() => setRequest(null)}
        label="Request details"
        drawer
      >
        {request && (
          <>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{request.kind.toUpperCase()}</p>
                <h2>{request.id}</h2>
              </div>
              <button
                onClick={() => setRequest(null)}
                aria-label="Close request"
              >
                <X />
              </button>
            </div>
            <p className="muted">
              {new Date(request.created).toLocaleString()}
            </p>
            <div className="request-status">
              <span className="eyebrow">STATUS</span>
              <select
                aria-label="Request status"
                disabled={busy}
                value={request.status}
                onChange={(e) => void changeStatus(request, e.target.value)}
              >
                {(request.kind === "inquiry"
                  ? ["new", "contacted", "resolved"]
                  : [
                      "pending",
                      "confirmed",
                      "processing",
                      "shipped",
                      "delivered",
                      "cancelled",
                    ]
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <div className="request-customer">
              <h3>{request.data.customer.name}</h3>
              <a href={`tel:${request.data.customer.phone}`}>
                {request.data.customer.phone}
              </a>
              <p>{request.data.customer.city}</p>
              <p>{request.data.customer.address}</p>
              {request.data.customer.notes && (
                <div className="customer-note">
                  {request.data.customer.notes}
                </div>
              )}
            </div>
            {request.data.items.map((i) => (
              <div className="request-item" key={`${i.id}:${i.size}`}>
                <div>
                  <h4>{i.name}</h4>
                  <p>
                    Size {i.size} · Quantity {i.quantity}
                  </p>
                </div>
                <span>{money(i.price)}</span>
              </div>
            ))}
            {request.data.totals.total !== null && (
              <div className="total-line grand-total">
                <span>Total</span>
                <strong>{money(request.data.totals.total)}</strong>
              </div>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
function RequestTable({
  requests,
  onSelect,
}: {
  requests: StoreRequest[];
  onSelect: (r: StoreRequest) => void;
}) {
  return requests.length ? (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Status</th>
            <th>Received</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>
                <button className="text-link" onClick={() => onSelect(r)}>
                  {r.id}
                </button>
              </td>
              <td>
                <strong>{r.data.customer.name}</strong>
                <span>{r.data.customer.city || r.data.customer.phone}</span>
              </td>
              <td>{r.kind}</td>
              <td>
                <span
                  className={`status-pill ${r.status === "new" ? "new-status" : ""}`}
                >
                  {r.status}
                </span>
              </td>
              <td>{new Date(r.created).toLocaleDateString()}</td>
              <td>
                <button
                  aria-label={`Open request ${r.id}`}
                  onClick={() => onSelect(r)}
                >
                  <ArrowUpRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="admin-empty">
      <ShoppingBag size={28} />
      <h3>No conversations yet.</h3>
      <p>Customer enquiries and orders will appear here.</p>
    </div>
  );
}
