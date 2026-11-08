import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Printer } from "lucide-react";
import type { StoreRequest } from "./types";
import "./order-insert.css";

export default function OrderInsert({ onPreview }: { onPreview: () => void }) {
  return (
    <section
      className="qf-insert-section"
      aria-label="Delivery box thank-you card"
    >
      <div>
        <strong>Delivery box thank-you card</strong>
        <p>Personalized for this order · A6 landscape</p>
      </div>
      <button type="button" className="button" onClick={onPreview}>
        Preview & print <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

export function OrderInsertPrintView({
  order,
  onBack,
}: {
  order: StoreRequest;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [logo, setLogo] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const firstName = order.data.customer.name.trim().split(/\s+/, 1)[0];
  const greeting =
    firstName && firstName.length <= 28 ? `Hi ${firstName},` : "Hi there,";

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="qf-print-page">
      <div className="qf-print-tools">
        <button type="button" className="qf-print-back" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" /> Back to order
        </button>
        <h1 ref={heading} tabIndex={-1}>
          Thank-you card
        </h1>
        <p>A6 landscape · 148 × 105 mm · 100% scale</p>
        <button
          type="button"
          className="qf-print-action"
          disabled={logo === "loading"}
          onClick={() => window.print()}
        >
          <Printer size={17} aria-hidden="true" />
          {logo === "loading" ? "Preparing card…" : "Print card"}
        </button>
      </div>
      <article className="qf-insert" aria-label="Qadam Flex thank-you card">
        <header>
          {logo === "unavailable" ? (
            <strong className="qf-insert-brand">QADAM FLEX</strong>
          ) : (
            <img
              src="/brand/logo-transparent.webp"
              alt="Qadam Flex"
              width="1413"
              height="1113"
              onLoad={() => setLogo("ready")}
              onError={() => setLogo("unavailable")}
            />
          )}
          <p>
            THE SHOEBOX EDIT
            <br />
            <span>PACKED WITH CARE</span>
          </p>
        </header>
        <div className="qf-insert-body">
          <div className="qf-insert-copy">
            <p className="qf-insert-kicker">A NOTE FROM QADAM FLEX</p>
            <h2>Thank you.</h2>
            <p className="qf-insert-message">
              <strong>{greeting}</strong> We’re glad you picked this pair. Wear
              them well, take the long way home, and make them yours.
            </p>
            <p className="qf-insert-signoff">See you out there, Qadam Flex</p>
          </div>
          <svg
            className="qf-insert-mark"
            viewBox="0 0 144 144"
            fill="none"
            stroke="#255a6d"
            aria-hidden="true"
          >
            <circle cx="72" cy="72" r="66" stroke="#8d6c3c" strokeWidth="0.8" />
            <circle
              cx="72"
              cy="72"
              r="60"
              stroke="#8d6c3c"
              strokeWidth="0.65"
              strokeDasharray="1 3"
            />
            <path d="M25 78c3-6 4-17 6-23 1-4 5-5 8-2l10 9c4 4 11 4 16 1l10-6c3-2 7 0 10 4l10 10c5 5 11 7 18 8 5 1 8 4 8 8v5H24v-8l1-6Z" />
            <path d="M25 84h92M24 92h97M34 58l13 10c5 4 14 5 20 1l12-7M70 72l7 4m0-8 7 4m1-4 7 4M37 85v7m62-7v7" />
            <path
              d="M72 25v12m-6-6h12m-6 75v12m-6-6h12M98 42l6-6m-6 0 6 6"
              stroke="#8d6c3c"
              strokeWidth="1.2"
            />
          </svg>
        </div>
        <footer>
          <span>QADAMFLEX.BOND</span>
          <span>ORDER {order.id}</span>
        </footer>
      </article>
      <p className="qf-print-help">
        On iPhone, you can also use Safari’s Share menu and choose Print.
      </p>
    </main>
  );
}
