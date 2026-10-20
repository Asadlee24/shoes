import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
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
const Showroom = lazy(() => import("./Showroom"));
gsap.registerPlugin(ScrollTrigger);
const focusPairs = [
  {
    id: "textured-bit",
    image: "/products/hero-textured.png",
    slug: "black-textured-loafer",
    name: "The Textured Bit",
    color: "Black",
    swatch: "#222222",
    index: "01",
  },
  {
    id: "suede-penny",
    image: "/products/hero-loafer.png",
    slug: "brown-suede-loafer",
    name: "The Suede Penny",
    color: "Taupe brown",
    swatch: "#887365",
    index: "02",
  },
];
export default function Home() {
  const { products } = useStore();
  const { theme } = useTheme();
  const root = useRef<HTMLElement>(null);
  const [focus, setFocus] = useState(0),
    [reset, setReset] = useState(0);
  const pair = focusPairs[focus];
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
      gsap.utils
        .toArray<HTMLElement>(".mono-reveal")
        .forEach((el) =>
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
      gsap.to(".mono-ticker-track", {
        xPercent: -10,
        ease: "none",
        scrollTrigger: {
          trigger: ".mono-ticker",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
        },
      });
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
          <span className="mono-label">
            <span className="edition-dot" /> THE QADAM EDIT — VOL. 01
          </span>
          <span className="mono-label">LOAFERS / FORMAL FOOTWEAR</span>
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
            <p className="mono-intro">
              Your day. Your pace.
              <br />A pair with a little more character.
            </p>
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
            <div className="mono-hero-caption">
              <span>AN EVERYDAY POINT OF VIEW.</span>
              <span>SIZES 7—11</span>
            </div>
          </div>
          <div className="mono-stage">
            <div className="stage-axis" aria-hidden="true">
              <span>QF / STUDIO</span>
              <span>001—002</span>
            </div>
            <Suspense
              fallback={
                <div className="showroom showroom-placeholder">
                  <div className="showroom-fallback">
                    <span className="fallback-plinth" />
                    <img
                      src={pair.image}
                      alt={pair.name}
                      className={focus === 0 ? "black-cutout" : "brown-cutout"}
                    />
                  </div>
                </div>
              }
            >
              <Showroom
                key={pair.id}
                image={pair.image}
                dark={theme === "dark"}
                reset={reset}
              />
            </Suspense>
            <div className="stage-interaction">
              <span>
                <MousePointer2 size={12} /> MOVE TO EXPLORE
              </span>
              <button
                onClick={() => setReset((v) => v + 1)}
                aria-label="Reset product display"
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <div className="stage-product">
              <div>
                <span className="mono-label">IN THE STUDIO / {pair.index}</span>
                <Link to={`/product/${pair.slug}`}>
                  {pair.name}
                  <ArrowUpRight size={19} />
                </Link>
                <p>{pair.color}</p>
              </div>
              <div
                className="stage-pair-picker"
                aria-label="Choose a featured pair"
              >
                {focusPairs.map((p, i) => (
                  <button
                    key={p.id}
                    className={focus === i ? "selected" : ""}
                    onClick={() => setFocus(i)}
                    aria-label={`Display ${p.name}`}
                    aria-pressed={focus === i}
                  >
                    <span style={{ background: p.swatch }} />
                    <span className="pair-number">{p.index}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mono-hero-bottom">
          <span>LESS ORDINARY. MORE YOU.</span>
          <a href="#collection">
            THE COLLECTION <ArrowDown size={12} />
          </a>
        </div>
      </section>
      <div className="mono-ticker" aria-hidden="true">
        <div className="mono-ticker-track">
          <span>GOOD SHOES.</span>
          <span className="ticker-outline">YOUR WAY.</span>
          <ArrowUpRight />
          <span>QADAM FLEX.</span>
          <span className="ticker-outline">GOOD FORM.</span>
          <ArrowUpRight />
        </div>
      </div>
      <section className="mono-collection section-pad" id="collection">
        <div className="mono-section-heading mono-reveal">
          <div>
            <span className="mono-label">01 / THE LINEUP</span>
            <h2>
              A SMALL EDIT.
              <br />
              <span>A STRONG POINT OF VIEW.</span>
            </h2>
          </div>
          <Link className="mono-text-link" to="/shop">
            All {products.length} styles <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="product-grid">
          {products
            .filter((p) => p.featured)
            .slice(0, 4)
            .map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
        </div>
        <div className="collection-footnote">
          <p>Choose your pair. Select your size. Start a conversation.</p>
          <span>QADAM FLEX / COLLECTION 01</span>
        </div>
      </section>
      <section className="mono-closeup">
        <div className="closeup-copy mono-reveal">
          <span className="mono-label">02 / DETAIL STUDY</span>
          <h2>
            LOOK
            <br />
            <span>CLOSER.</span>
          </h2>
          <p>
            A textured upper. Dark metal detailing.
            <br />
            The small things that bring it together.
          </p>
          <Link
            className="mono-button mono-button-inverse"
            to="/product/black-textured-loafer"
          >
            Meet the Textured Bit{" "}
            <span>
              <ArrowUpRight size={20} />
            </span>
          </Link>
          <div className="closeup-spec">
            <span>PATTERNED UPPER</span>
            <span>DEFINED SOLE</span>
            <span>SLIP-ON FORM</span>
          </div>
        </div>
        <div className="closeup-scene">
          <span className="closeup-large-index" aria-hidden="true">
            02
          </span>
          <div className="closeup-light" />
          <img
            className="closeup-shoe"
            src="/products/hero-textured.png"
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
            <span className="mono-label">03 / TWO SIDES OF YOUR DAY</span>
            <h2>
              THE EVERYDAY.
              <br />
              <span>AND THE EXTRA.</span>
            </h2>
          </div>
          <p>
            From a regular routine
            <br />
            to a reason to dress up.
          </p>
        </div>
        <div className="occasion-grid">
          <Link
            to="/shop?category=Loafers"
            className="occasion-card mono-reveal"
          >
            <div className="occasion-photo">
              <img
                src="/products/dark-suede.jpg"
                alt="Dark penny loafers for everyday outfits"
                loading="lazy"
              />
              <span className="occasion-index">01 / EVERYDAY</span>
            </div>
            <div className="occasion-name">
              <h3>OFF THE CLOCK.</h3>
              <span className="occasion-arrow">
                <ArrowUpRight size={25} />
              </span>
            </div>
            <p>Explore loafers</p>
          </Link>
          <Link
            to="/shop?category=Formal+shoes"
            className="occasion-card occasion-offset mono-reveal"
          >
            <div className="occasion-photo">
              <img
                src="/products/black-formal.jpg"
                alt="Polished black formal loafers"
                loading="lazy"
              />
              <span className="occasion-index">02 / OCCASION</span>
            </div>
            <div className="occasion-name">
              <h3>ON YOUR TERMS.</h3>
              <span className="occasion-arrow">
                <ArrowUpRight size={25} />
              </span>
            </div>
            <p>Explore formal shoes</p>
          </Link>
        </div>
      </section>
      <section className="mono-note section-pad">
        <span className="mono-label mono-reveal">OUR POINT OF VIEW</span>
        <div className="mono-note-layout">
          <h2 className="mono-reveal">
            STYLE IS
            <br />
            PERSONAL.
            <br />
            <span>START THERE.</span>
          </h2>
          <div className="mono-note-copy mono-reveal">
            <span className="note-asterisk" aria-hidden="true">
              ✳
            </span>
            <p>
              We keep the collection focused.
              <br />
              Loafers and formal shoes with details
              <br />
              that stand out in their own way.
            </p>
            <Link className="mono-text-link" to="/about">
              Get to know Qadam <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
