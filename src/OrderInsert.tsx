/// <reference types="vite/client" />

import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import type { StoreRequest } from "./types";
import cardStyles from "./order-insert.css?raw";
import "./order-insert.css";

const printStyles = `
  html { color-scheme: only light; }
  body { margin: 0; padding: 24px; background: #eeefed; font: 14px system-ui, sans-serif; }
  .print-toolbar { max-width: 148mm; margin: 0 auto 18px; display: flex; flex-wrap: wrap;
    align-items: center; gap: 10px 16px; color: #292f32; }
  .print-toolbar button { padding: 10px 18px; border: 0; border-radius: 4px;
    color: white; background: #102f40; font: inherit; cursor: pointer; }
  .qf-insert { width: min(100%, 148mm); margin: 0 auto; }
  @page { margin: 0; }
  @media print {
    body { padding: 0; background: white; }
    .print-toolbar { display: none; }
    .qf-insert { width: 148mm; height: 105mm; max-width: none; margin: 0 auto;
      padding: 9mm 11mm; border-radius: 0; break-inside: avoid;
      print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .qf-insert h3 { font-size: 36pt; }
  }
`;

export default function OrderInsert({ order }: { order: StoreRequest }) {
  const card = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const firstName = order.data.customer.name.trim().split(/\s+/, 1)[0];
  const greeting =
    firstName && firstName.length <= 28 ? `Hi ${firstName},` : "Hi there,";

  async function printCard() {
    if (!card.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Allow pop-ups for Qadam Flex, then try printing again.");
      return;
    }
    setError("");
    printWindow.opener = null;
    const doc = printWindow.document;
    doc.documentElement.lang = "en";
    doc.title = `Qadam Flex thank-you card · ${order.id}`;
    const viewport = doc.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    const style = doc.createElement("style");
    style.textContent = cardStyles + printStyles;
    doc.head.append(viewport, style);
    const toolbar = doc.createElement("div");
    toolbar.className = "print-toolbar";
    const button = doc.createElement("button");
    button.textContent = "Print card";
    button.disabled = true;
    const hint = doc.createElement("span");
    hint.textContent = "A6 landscape · print at 100% scale";
    toolbar.append(button, hint);
    const insert = doc.importNode(card.current, true);
    doc.body.replaceChildren(toolbar, insert);
    try {
      await insert.querySelector("img")?.decode();
      await doc.fonts.ready;
    } catch {
      hint.textContent =
        "The logo could not load. Close this tab and try again.";
      return;
    }
    if (printWindow.closed) return;
    const print = () => {
      printWindow.focus();
      printWindow.print();
    };
    button.disabled = false;
    button.addEventListener("click", print);
    print();
  }

  return (
    <section
      className="qf-insert-section"
      aria-label="Delivery box thank-you card"
    >
      <details>
        <summary>
          Delivery box thank-you card <span>A6</span>
        </summary>
        <article className="qf-insert" ref={card}>
          <header>
            <img
              src={
                new URL("/brand/logo-transparent.webp", window.location.origin)
                  .href
              }
              alt="Qadam Flex"
            />
            <p>
              THE QADAM FLEX EDIT
              <br />
              PACKED FOR YOU
            </p>
          </header>
          <h3>
            Good steps
            <br />
            start here.
          </h3>
          <p className="qf-insert-message">
            <strong>{greeting}</strong> thank you for choosing Qadam Flex. We
            hope your new pair takes you somewhere good.
          </p>
          <footer>
            <span>QADAMFLEX.BOND</span>
            <span>ORDER {order.id}</span>
          </footer>
        </article>
      </details>
      <button type="button" className="button" onClick={() => void printCard()}>
        <Printer size={17} aria-hidden="true" /> Print thank-you card
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
