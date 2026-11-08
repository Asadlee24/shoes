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
            THE QADAM FLEX EDIT
            <br />
            PACKED WITH CARE
          </p>
        </header>
        <div className="qf-insert-body">
          <div className="qf-insert-copy">
            <p className="qf-insert-kicker">A LITTLE NOTE FOR YOU</p>
            <h2>
              Good steps
              <br />
              start here.
            </h2>
            <p className="qf-insert-message">
              <strong>{greeting}</strong> Thanks for stepping out with Qadam
              Flex. We hope your new pair takes you somewhere good.
            </p>
          </div>
          <svg
            className="qf-insert-mark"
            viewBox="0 0 108 108"
            fill="none"
            stroke="#255a6d"
            aria-hidden="true"
          >
            <circle cx="54" cy="54" r="48" />
            <circle cx="54" cy="54" r="41" strokeDasharray="1 4" />
            <path d="M34 69 66 37m-17 0h17v17M45 74l27-27m-2 20 4-4" />
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
