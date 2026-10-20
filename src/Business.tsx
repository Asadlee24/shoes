import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Copy,
  Phone,
  MessageCircle,
  Instagram,
  Globe,
  CreditCard,
} from "lucide-react";
import { useStore } from "./store";
export function BusinessLinks() {
  const { settings: s } = useStore();
  if (!s) return null;
  const links = [
    s.phone && {
      href: `tel:+${s.phone.replace(/^\+/, "").replace(/^0/, "92")}`,
      text: s.phone,
      icon: Phone,
    },
    s.whatsapp && {
      href: `https://wa.me/${s.whatsapp}`,
      text: "WhatsApp",
      icon: MessageCircle,
    },
    s.instagram && {
      href: `https://www.instagram.com/${s.instagram.replace(/^@/, "")}`,
      text: "Instagram",
      icon: Instagram,
    },
    s.tiktok && {
      href: `https://www.tiktok.com/@${s.tiktok.replace(/^@/, "")}`,
      text: "TikTok",
      icon: ArrowUpRight,
    },
    s.website && {
      href: s.website,
      text: new URL(s.website).hostname,
      icon: Globe,
    },
  ].filter(Boolean) as { href: string; text: string; icon: typeof Phone }[];
  return (
    <nav
      className="business-links"
      aria-label="Official QADAM FLEX contact links"
    >
      {links.map(({ href, text, icon: Icon }) => (
        <a
          key={text}
          href={href}
          target={href.startsWith("https:") ? "_blank" : undefined}
          rel="noreferrer"
        >
          <Icon size={16} />
          <span>{text}</span>
        </a>
      ))}
    </nav>
  );
}
export function Payments() {
  const { settings: s, toast } = useStore();
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied.");
    } catch {
      toast("Select the number to copy it.");
    }
  }
  const row = (label: string, value: string, code = false) => (
    <div className="payment-row" key={label}>
      <dt>{label}</dt>
      <dd>
        <span className={code ? "payment-code" : ""}>
          {label === "IBAN" ? value.match(/.{1,4}/g)?.join(" ") : value}
        </span>
        <button
          type="button"
          onClick={() => void copy(value)}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
        >
          <Copy size={17} />
        </button>
      </dd>
    </div>
  );
  return (
    <main className="payments-page section-pad">
      <div className="payment-intro">
        <p className="eyebrow">PAYMENT DETAILS · PKR</p>
        <h1>Bank & Easypaisa.</h1>
        <p>
          Confirm your order, size and delivery before paying. Share your
          receipt and reference on WhatsApp; transfers are confirmed manually.
        </p>
      </div>
      <div className="payment-grid">
        <section className="payment-card">
          <div className="payment-card-heading">
            <CreditCard size={24} />
            <h2>Bank transfer</h2>
          </div>
          {s?.bankIban ? (
            <dl>
              {row("Account holder", s.bankAccountHolder)}
              {row("IBAN", s.bankIban, true)}
              {row("Account number", s.bankAccountNumber, true)}
              {row("Currency", "PKR")}
            </dl>
          ) : (
            <p>Please contact us for bank details.</p>
          )}
        </section>
        <section className="payment-card">
          <div className="payment-card-heading">
            <Phone size={24} />
            <h2>Easypaisa</h2>
          </div>
          {s?.easypaisaNumber ? (
            <dl>
              {row("Account holder", s.easypaisaHolder)}
              {row("Easypaisa number", s.easypaisaNumber, true)}
              {row("Currency", "PKR")}
            </dl>
          ) : (
            <p>Please contact us for Easypaisa details.</p>
          )}
        </section>
      </div>
      <div className="payment-followup">
        {s?.whatsapp && (
          <a
            className="button"
            href={`https://wa.me/${s.whatsapp}?text=${encodeURIComponent("Hi QADAM FLEX, please confirm my order and payment details.")}`}
            target="_blank"
            rel="noreferrer"
          >
            Confirm on WhatsApp <ArrowUpRight size={18} />
          </a>
        )}
        <Link className="text-link" to="/shop">
          Back to shoes
        </Link>
      </div>
    </main>
  );
}
