import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import type { Product, Settings, CartItem } from "./types";
const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
type State = {
  products: Product[];
  settings: Settings | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  cart: CartItem[];
  wishlist: string[];
  bagOpen: boolean;
  setBagOpen: (v: boolean) => void;
  quick: string | null;
  setQuick: (v: string | null) => void;
  add: (id: string, size: string, quantity?: number) => void;
  update: (id: string, size: string, quantity: number) => void;
  clear: () => void;
  toggleWish: (id: string) => void;
  toast: (message: string) => void;
};
const Context = createContext<State | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]),
    [settings, setSettings] = useState<Settings | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = read<unknown>("qf-bag", []);
    return Array.isArray(raw)
      ? raw
          .filter(
            (i) =>
              i &&
              typeof i.id === "string" &&
              typeof i.size === "string" &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 10,
          )
          .slice(0, 20)
      : [];
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const raw = read<unknown>("qf-wishlist", []);
    return Array.isArray(raw) ? raw.filter((i) => typeof i === "string") : [];
  });
  const [bagOpen, setBagOpen] = useState(false),
    [quick, setQuick] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const reload = useCallback(async () => {
    try {
      const d = await api<{ products: Product[]; settings: Settings }>(
        "/api/catalog",
      );
      setProducts(d.products);
      setSettings(d.settings);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    try {
      localStorage.setItem("qf-bag", JSON.stringify(cart));
    } catch {
      /* Browser storage may be unavailable. */
    }
  }, [cart]);
  useEffect(() => {
    try {
      localStorage.setItem("qf-wishlist", JSON.stringify(wishlist));
    } catch {
      /* Browser storage may be unavailable. */
    }
  }, [wishlist]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(id);
  }, [notice]);
  const add = (id: string, size: string, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id && i.size === size);
      return existing
        ? prev.map((i) =>
            i === existing
              ? { ...i, quantity: Math.min(10, i.quantity + quantity) }
              : i,
          )
        : [...prev, { id, size, quantity }];
    });
    setQuick(null);
    setBagOpen(true);
  };
  const update = (id: string, size: string, quantity: number) =>
    setCart((prev) =>
      quantity < 1
        ? prev.filter((i) => !(i.id === id && i.size === size))
        : prev.map((i) =>
            i.id === id && i.size === size
              ? { ...i, quantity: Math.min(10, quantity) }
              : i,
          ),
    );
  const toggleWish = (id: string) =>
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  return (
    <Context.Provider
      value={{
        products,
        settings,
        loading,
        error,
        reload,
        cart,
        wishlist,
        bagOpen,
        setBagOpen,
        quick,
        setQuick,
        add,
        update,
        clear: () => setCart([]),
        toggleWish,
        toast: setNotice,
      }}
    >
      {children}
      <div role="status" className={`toast ${notice ? "visible" : ""}`}>
        {notice}
      </div>
    </Context.Provider>
  );
}
export function useStore() {
  const state = useContext(Context);
  if (!state) throw Error("Store provider missing");
  return state;
}
