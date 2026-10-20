import { Component, lazy, Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { StoreProvider, useStore } from "./store";
import {
  BagDrawer,
  ErrorState,
  Footer,
  Header,
  PageLoader,
  QuickView,
} from "./components";
import Home from "./Home";
import {
  Cart,
  Checkout,
  Confirmation,
  Contact,
  FAQ,
  InfoPage,
  NotFound,
  ProductPage,
  Shop,
  Wishlist,
} from "./Pages";
const Admin = lazy(() => import("./Admin"));
function ScrollPosition() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  return null;
}
function Storefront() {
  const { loading, error } = useStore();
  const location = useLocation();
  useEffect(() => {
    const page = location.pathname.startsWith("/product/")
      ? "The collection"
      : location.pathname.split("/")[1]?.replace(/^./, (s) => s.toUpperCase());
    document.title = `${page ? page + " — " : ""}QADAM FLEX — A considered step.`;
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <div id="main-content">
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState />
        ) : (
          <Routes>
            <Route index element={<Home />} />
            <Route path="shop" element={<Shop />} />
            <Route path="product/:slug" element={<ProductPage />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="confirmation" element={<Confirmation />} />
            <Route path="contact" element={<Contact />} />
            <Route path="faq" element={<FAQ />} />
            {["about", "shipping", "privacy", "terms"].map((p) => (
              <Route key={p} path={p} element={<InfoPage page={p} />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </div>
      <Footer />
      <BagDrawer />
      <QuickView />
    </>
  );
}
class StoreErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty-state">
        <h1>A small pause.</h1>
        <p>The store could not finish opening. Please reload and try again.</p>
        <a className="button" href="/">
          Open the store again
        </a>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <StoreErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <ScrollPosition />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/admin/*" element={<Admin />} />
              <Route path="*" element={<Storefront />} />
            </Routes>
          </Suspense>
        </StoreProvider>
      </BrowserRouter>
    </StoreErrorBoundary>
  );
}
