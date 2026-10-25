import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  MoveUpRight,
  MousePointer2,
  RotateCcw,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useStore } from "./store";
import { useTheme } from "./theme";
import { ProductCard } from "./components";
import Showroom from "./Showroom";
import { money } from "./api";
import { catalogueStyles } from "../shared/catalogue.mjs";
gsap.registerPlugin(ScrollTrigger);
const focusPairs = [
  {
    id: "textured-bit",
    image: "/products/hero-textured.webp",
    slug: "black-textured-loafer",
    name: "The Textured Bit",
    color: "Black",
    swatch: "#222222",
    index: "01",
  },
  {
    id: "suede-penny",
    image: "/products/hero-loafer.webp",
    slug: "brown-suede-loafer",
    name: "The Suede Penny",
    color: "Taupe brown",
    swatch: "#887365",
    index: "02",
  },
  {
    id: "product-1b0c8d9f",
    image: "/products/hero-olive-v1.webp",
    slug: "olive-suede-penny-loafer",
    name: "Olive Suede Penny Loafer",
    color: "Olive-Khaki",
    swatch: "#77694b",
    index: "03",
  },
  {
    id: "product-869254ac",
    image: "/products/hero-chocolate-v1.webp",
    slug: "brown-suede-penny-loafer",
    name: "Brown Suede Penny Loafer",
    color: "Chocolate brown",
    swatch: "#684536",
    index: "04",
  },
];
export default function Home() {
  const { products } = useStore();
  const { theme } = useTheme();
  const root = useRef<HTMLElement>(null);
  const [focus, setFocus] = useState(0),
    [reset, setReset] = useState(0);
  // The hero is a four-pair showcase, independent of catalogue availability.
  const pair = focusPairs[focus] || focusPairs[0];
  const product = products.find((p) => p.id === pair.id);
  useEffect(() => {
    if (!root.current || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .fromTo(
          ".mono-title-line span",
          { yPercent: 105, rotate: 3 },
          { yPercent: 0, rotate: 0, duration: 1.15, stagger: 0.12 },
          0.05,
        )
        .fromTo(
          ".mono-intro,.mono-hero-actions,.mono-hero-caption",
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.85, stagger: 0.1 },
          0.35,
        )
        .fromTo(
          ".mono-stage",
          { opacity: 0, y: 35 },
          { opacity: 1, y: 0, duration: 1.15 },
          0.15,
        );
      gsap.utils.toArray<HTMLElement>(".mono-reveal").forEach((el) =>
        gsap.fromTo(
          el,
          { y: 35, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 91%", once: true },
          },
        ),
      );
      gsap.fromTo(
        ".closeup-shoe",
        { rotation: 9, y: 60 },
        {
          rotation: -4,
          y: -30,
          ease: "none",
          scrollTrigger: {
            trigger: ".mono-closeup",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.4,
          },
        },
      );
      gsap.to(".occasion-photo img", {
        yPercent: -6,
        ease: "none",
        scrollTrigger: {
          trigger: ".mono-occasions",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.3,
        },
      });
    }, root);
    return () => context.revert();
  }, [products.length]);
  return (
    <main className="home mono-home" ref={root}>
      <section className="mono-hero">
        <div className="mono-topline">
          <span className="mono-label">MEN’S FOOTWEAR</span>
          <span className="mono-label">SIZES 7–11</span>
        </div>
        <div className="mono-hero-layout">
          <div className="mono-hero-copy">
            <h1 aria-label="Good form.">
              <span className="mono-title-line">
                <span>GOOD</span>
              </span>
              <span className="mono-title-line title-outline">
                <span>FORM.</span>
              </span>
            </h1>
            <p className="mono-intro">Loafers, sneakers and formal shoes.</p>
            <div className="mono-hero-actions">
              <Link className="mono-button" to="/shop">
                Shop the collection{" "}
                <span>
                  <ArrowUpRight size={20} />
                </span>
              </Link>
              <a
                className="mono-scroll"
                href="#collection"
                aria-label="Discover the collection"
              >
                <ArrowDown size={18} />
              </a>
            </div>
          </div>
          {pair && (
            <div className="mono-stage">
              <Showroom
                key={pair.id}
                image={pair.image}
                dark={theme === "dark"}
                reset={reset}
              />
              <div className="stage-interaction">
                <span>
                  <MousePointer2 size={12} /> MOVE MOUSE · DRAG TO FLIP
                </span>
                <div className="stage-buttons">
                  <button
                    type="button"
                    onClick={() => setReset((v) => v + 1)}
                    aria-label="Reset product display"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
              <div className="stage-product">
                <div>
                  <Link to={product ? `/product/${product.slug}` : "/shop"}>
                    {pair.name}
                    <ArrowUpRight size={19} />
                  </Link>
                  <p>
                    {pair.color} ·{" "}
                    {product ? money(product.price) : "Explore available pairs"}
                  </p>
                </div>
                <div
                  className="stage-pair-picker"
                  aria-label="Choose a featured pair"
                >
                  {focusPairs.map((p, i) => (
                    <button
                      key={p.id}
                      className={pair.id === p.id ? "selected" : ""}
                      onClick={() => setFocus(i)}
                      aria-label={`Display ${p.name}`}
                      aria-pressed={pair.id === p.id}
                    >
                      <span style={{ background: p.swatch }} />
                      <span className="pair-number">{p.index}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="mono-collection section-pad" id="collection">
        <div className="mono-section-heading mono-reveal">
          <div>
            <h2>THE COLLECTION.</h2>
          </div>
          <Link className="mono-text-link" to="/shop">
            All {catalogueStyles(products).length} styles{" "}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="product-grid">
          {products
            .filter((p) => p.featured && !p.variantOf)
            .map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
        </div>
      </section>
      <section className="mono-closeup">
        <div className="closeup-copy mono-reveal">
          <h2>
            LOOK
            <br />
            <span>CLOSER.</span>
          </h2>
          <p>Textured upper. Metal strap.</p>
          <Link
            className="mono-button mono-button-inverse"
            to="/product/black-textured-loafer"
          >
            View details{" "}
            <span>
              <ArrowUpRight size={20} />
            </span>
          </Link>
        </div>
        <div className="closeup-scene">
          <div className="closeup-light" />
          <img
            className="closeup-shoe"
            src="/products/hero-textured.webp"
            alt="A closer look at the textured black loafer and dark metal detailing"
            loading="lazy"
          />
          <Link
            className="closeup-corner"
            to="/product/black-textured-loafer"
            aria-label="Explore The Textured Bit"
          >
            <MoveUpRight size={28} />
          </Link>
          <span className="closeup-caption">THE TEXTURED BIT / BLACK</span>
        </div>
      </section>
      <section className="mono-occasions section-pad">
        <div className="mono-section-heading mono-reveal">
          <div>
            <h2>BY STYLE.</h2>
          </div>
        </div>
        <div className="occasion-grid">
          <Link
            to="/shop?category=Loafers"
            className="occasion-card mono-reveal"
          >
            <div className="occasion-photo">
              <img
                src="/products/midnight-penny-gallery-1-studio-v3.webp"
                alt="Dark penny loafers for everyday outfits"
                loading="lazy"
              />
            </div>
            <div className="occasion-name">
              <h3>LOAFERS</h3>
              <span className="occasion-arrow">
                <ArrowUpRight size={25} />
              </span>
            </div>
          </Link>
          <Link
            to="/shop?category=Formal+shoes"
            className="occasion-card occasion-offset mono-reveal"
          >
            <div className="occasion-photo">
              <img
                src="/products/evening-bit-gallery-1-studio-v3.webp"
                alt="Polished black formal loafers"
                loading="lazy"
              />
            </div>
            <div className="occasion-name">
              <h3>FORMAL SHOES</h3>
              <span className="occasion-arrow">
                <ArrowUpRight size={25} />
              </span>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
