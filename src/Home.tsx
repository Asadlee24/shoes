import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, MoveUpRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useStore } from "./store";
import { ProductCard, ServiceStrip } from "./components";
gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const { products } = useStore();
  const root = useRef<HTMLElement>(null),
    scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const context = gsap.context(() => {
      gsap.fromTo(
        ".hero-copy > *",
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          stagger: 0.1,
          ease: "power3.out",
          delay: 0.1,
        },
      );
      gsap.fromTo(
        ".hero-shoe",
        { y: 45, rotation: -6, opacity: 0 },
        {
          y: 0,
          rotation: 0,
          opacity: 1,
          duration: 1.4,
          ease: "power3.out",
          delay: 0.2,
        },
      );
      gsap.fromTo(
        ".hero-orbit",
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 0.5, duration: 1.5, delay: 0.2 },
      );
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
        gsap.fromTo(
          el,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 94%", once: true },
          },
        ),
      );
      gsap.to(".detail-photo img", {
        yPercent: -7,
        ease: "none",
        scrollTrigger: {
          trigger: ".detail-feature",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    }, root);
    const el = scene.current;
    const fine = matchMedia("(pointer:fine)").matches;
    const move = (e: PointerEvent) => {
      if (!el || !fine) return;
      const b = el.getBoundingClientRect();
      gsap.to(el.querySelector(".shoe-parallax"), {
        rotationY: ((e.clientX - b.left - b.width / 2) / b.width) * 12,
        rotationX: (-(e.clientY - b.top - b.height / 2) / b.height) * 9,
        x: (e.clientX - b.left - b.width / 2) * 0.025,
        y: (e.clientY - b.top - b.height / 2) * 0.018,
        duration: 1.2,
        ease: "power3.out",
      });
    };
    const leave = () => {
      if (el)
        gsap.to(el.querySelector(".shoe-parallax"), {
          rotationX: 0,
          rotationY: 0,
          x: 0,
          y: 0,
          duration: 1.2,
          ease: "power3.out",
        });
    };
    el?.addEventListener("pointermove", move);
    el?.addEventListener("pointerleave", leave);
    return () => {
      context.revert();
      el?.removeEventListener("pointermove", move);
      el?.removeEventListener("pointerleave", leave);
    };
  }, [products.length]);
  return (
    <main ref={root} className="home">
      <section className="hero">
        <div className="hero-topline">
          <span className="eyebrow">
            <span className="live-dot" /> THE QADAM EDIT
          </span>
          <span className="eyebrow hero-top-right">
            EVERYDAY. OCCASIONALLY EXTRAORDINARY.
          </span>
        </div>
        <div className="hero-main">
          <div className="hero-copy">
            <p className="hero-edition">THE FIRST COLLECTION / 01</p>
            <h1>
              A considered
              <br />
              <em>step.</em>
            </h1>
            <p className="hero-description">
              A little character. An easy confidence.
              <br />
              Find the pair that feels like you.
            </p>
            <div className="hero-ctas">
              <Link to="/shop" className="button button-sage">
                Explore the collection <ArrowUpRight size={19} />
              </Link>
              <a
                href="#collection"
                className="hero-scroll"
                aria-label="Scroll to the collection"
              >
                <ArrowDown size={19} />
              </a>
            </div>
            <div className="hero-footnote">
              <span>LOAFERS & FORMAL FOOTWEAR</span>
              <span>AVAILABLE IN SIZES 7–11</span>
            </div>
          </div>
          <div className="hero-scene" ref={scene}>
            <div className="scene-light" />
            <div className="hero-orbit" />
            <div className="hero-orbit orbit-two" />
            <div className="shoe-shadow" />
            <span className="scene-number" aria-hidden="true">
              01
            </span>
            <div className="shoe-parallax">
              <img
                className="hero-shoe"
                src="/products/hero-loafer.png"
                alt="Brown suede penny loafer with a contrasting tan sole"
                width="1536"
                height="1024"
                fetchPriority="high"
              />
            </div>
            <div className="scene-caption">
              <div>
                <span className="eyebrow">IN FOCUS</span>
                <Link to="/product/brown-suede-loafer">
                  The Suede Penny <ArrowUpRight size={15} />
                </Link>
              </div>
              <span className="scene-swatch" />
              <span className="scene-color">TAUPE BROWN</span>
            </div>
            <span className="scene-coordinate" aria-hidden="true">
              QF — 001
            </span>
          </div>
        </div>
        <div className="hero-bottom">
          <span>GOOD SHOES. LESS OVERTHINKING.</span>
          <a href="#collection">
            SCROLL TO DISCOVER <ArrowDown size={13} />
          </a>
        </div>
      </section>
      <ServiceStrip />
      <section className="collection-section section-pad" id="collection">
        <div className="section-heading reveal">
          <div>
            <p className="eyebrow">01 / THE COLLECTION</p>
            <h2>
              Your next
              <br className="mobile-break" /> everyday pair.
            </h2>
          </div>
          <Link className="text-link" to="/shop">
            Explore all shoes <ArrowUpRight size={16} />
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
      </section>
      <section className="detail-feature">
        <div className="detail-photo">
          <img
            src="/products/black-textured.jpg"
            alt="Close-up of the textured black loafer and metal strap detail"
            loading="lazy"
          />
          <div className="detail-tag">
            <span>THE TEXTURED BIT</span>
            <MoveUpRight size={22} />
          </div>
        </div>
        <div className="detail-copy">
          <div className="reveal">
            <p className="eyebrow">02 / A CLOSER LOOK</p>
            <h2>
              Details make
              <br />
              the <em>difference.</em>
            </h2>
            <p>
              A textured finish. A considered silhouette. The small things that
              bring an outfit together.
            </p>
            <div className="detail-rule" />
            <div className="detail-facts">
              <span>01 — DISTINCTIVE TEXTURES</span>
              <span>02 — REFINED DETAILS</span>
              <span>03 — EVERYDAY CHARACTER</span>
            </div>
            <Link
              to="/product/black-textured-loafer"
              className="button button-outline"
            >
              Meet the Textured Bit <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="style-section section-pad">
        <div className="section-heading reveal">
          <div>
            <p className="eyebrow">03 / FIND YOUR STYLE</p>
            <h2>
              For wherever
              <br />
              the day takes you.
            </h2>
          </div>
          <p className="section-description">
            From your regular routine to a reason
            <br />
            to dress up. Start with the shoes.
          </p>
        </div>
        <div className="style-grid">
          <Link
            to="/shop?category=Loafers"
            className="style-tile loafers-tile reveal"
          >
            <span className="eyebrow">THE EVERYDAY EDIT</span>
            <img
              src="/products/dark-suede.jpg"
              alt="Dark penny loafers with tan soles"
              loading="lazy"
            />
            <div>
              <h3>Loafers</h3>
              <span className="icon-circle">
                <ArrowUpRight />
              </span>
            </div>
          </Link>
          <Link
            to="/shop?category=Formal+shoes"
            className="style-tile formal-tile reveal"
          >
            <span className="eyebrow">THE DRESSED-UP EDIT</span>
            <img
              src="/products/black-formal.jpg"
              alt="Polished black formal loafers"
              loading="lazy"
            />
            <div>
              <h3>Formal, rethought.</h3>
              <span className="icon-circle">
                <ArrowUpRight />
              </span>
            </div>
          </Link>
        </div>
      </section>
      <section className="brand-statement section-pad">
        <p className="eyebrow reveal">A NOTE FROM QADAM FLEX</p>
        <h2 className="reveal">
          Your style starts
          <br />
          with a <em>good step.</em>
        </h2>
        <div className="statement-bottom reveal">
          <p>
            We keep our collection considered.
            <br />
            Loafers and formal shoes, chosen for
            <br />
            the details that make them stand out.
          </p>
          <Link className="text-link" to="/about">
            Our perspective <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
