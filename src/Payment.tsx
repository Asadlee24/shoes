import { useEffect, useState } from "react";
import { Copy, Upload, CheckCircle2, Clock3, CircleAlert } from "lucide-react";
import { api, money } from "./api";
import { useStore } from "./store";
import { useAccount } from "./customer-account";
import type { StoreRequest, Payment } from "./types";
export function PaymentDestination({ payment }: { payment: Payment }) {
  const { settings, toast } = useStore();
  // Enquiries have no frozen recipient yet; show the owner's published details.
  // Confirmed orders continue using the account snapshot saved with the order.
  const recipient =
    payment.recipient ||
    (payment.method === "bank" && settings?.bankIban
      ? {
          holder: settings.bankAccountHolder,
          iban: settings.bankIban,
          account: settings.bankAccountNumber,
        }
      : payment.method === "easypaisa" && settings?.easypaisaNumber
        ? { holder: settings.easypaisaHolder, number: settings.easypaisaNumber }
        : null);
  if (!recipient || !["bank", "easypaisa"].includes(payment.method))
    return null;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied.");
    } catch {
      toast("Select the number to copy it.");
    }
  }
  return (
    <div className="transfer-destination">
      <p className="eyebrow">
        {payment.method === "bank" ? "BANK TRANSFER" : "EASYPAISA"} · PKR
      </p>
      <dl>
        {[
          ["Account holder", recipient.holder],
          ["IBAN", recipient.iban],
          ["Account number", recipient.account],
          ["Easypaisa number", recipient.number],
        ].map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <span>{value}</span>
                <button
                  type="button"
                  onClick={() => void copy(value)}
                  aria-label={`Copy ${label}`}
                >
                  <Copy size={16} />
                </button>
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      {payment.status === "not_required" && (
        <p className="muted small">
          Please wait for the store to confirm your order total before paying.
        </p>
      )}
    </div>
  );
}
export const paymentLabel = (status?: string) =>
  ({
    awaiting_payment: "Awaiting payment",
    under_review: "Receipt under review",
    paid: "Payment confirmed",
    rejected: "Receipt needs attention",
    cod: "Cash on delivery",
    not_required: "Awaiting store confirmation",
  })[status || ""] || "Awaiting store confirmation";
export function ReceiptForm({
  order,
  onSaved,
}: {
  order: StoreRequest;
  onSaved: () => Promise<void>;
}) {
  const { headers } = useAccount();
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const reference = new FormData(event.currentTarget).get("reference");
    try {
      if (
        !file ||
        file.size > 2000000 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error("Choose a JPG, PNG or WebP receipt smaller than 2 MB.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () =>
          reject(new Error("The receipt could not be read."));
        reader.readAsDataURL(file);
      });
      await api(`/api/account/orders/${order.id}/proof`, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: file.type, data, reference }),
      });
      setFile(null);
      await onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="customer-form receipt-form"
      onSubmit={(event) => void submit(event)}
    >
      <fieldset disabled={busy}>
        <legend>Send payment proof</legend>
        <label>
          Transaction ID / reference
          <input
            name="reference"
            required
            maxLength={100}
            placeholder="Reference from your transfer receipt"
            autoComplete="off"
          />
        </label>
        <label className="receipt-upload">
          <Upload size={21} />
          <span>
            {file ? file.name : "Choose your payment receipt"}
            <small>JPG, PNG or WebP · Up to 2 MB</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setError("");
            }}
          />
        </label>
        {preview && (
          <img
            className="receipt-preview"
            src={preview}
            alt="Your selected payment receipt"
          />
        )}
        <p className="field-error" role="alert">
          {error}
        </p>
        <button className="button" disabled={busy}>
          {busy ? "Uploading…" : "Submit payment proof"}
        </button>
      </fieldset>
    </form>
  );
}
export function OrderPayment({
  order,
  onSaved,
}: {
  order: StoreRequest;
  onSaved: () => Promise<void>;
}) {
  const payment = order.data.payment;
  const Icon =
    payment?.status === "paid"
      ? CheckCircle2
      : payment?.status === "rejected"
        ? CircleAlert
        : Clock3;
  return (
    <section className="order-payment">
      <div
        className={`payment-state payment-${payment?.status || "not_required"}`}
      >
        <Icon size={20} />
        <strong>{paymentLabel(payment?.status)}</strong>
      </div>
      {order.status === "cancelled" ? (
        <p>
          This order is cancelled. If you transferred money, contact the store
          with your reference to arrange a refund.
        </p>
      ) : order.kind === "inquiry" ? (
        <>
          {payment && <PaymentDestination payment={payment} />}
          <p>
            The store will confirm availability and delivery before requesting
            payment. Check this page for updates.
          </p>
        </>
      ) : payment?.method === "cod" ? (
        <p>Pay {money(order.data.totals.total)} when your order arrives.</p>
      ) : (
        payment && (
          <>
            <PaymentDestination payment={payment} />
            {payment.status === "awaiting_payment" && (
              <p>
                Transfer exactly{" "}
                <strong>{money(order.data.totals.total)}</strong> to this
                account, then upload your receipt below.
              </p>
            )}
            {payment.note && (
              <p className="payment-review-note">Store note: {payment.note}</p>
            )}
            {payment.reference && (
              <p className="muted small">
                Transaction reference: {payment.reference}
              </p>
            )}
            {payment.proofId && (
              <a
                className="text-link"
                href={`/api/account/proofs/${payment.proofId}`}
                target="_blank"
                rel="noreferrer"
              >
                View submitted receipt
              </a>
            )}
            {["awaiting_payment", "rejected"].includes(payment.status) && (
              <ReceiptForm order={order} onSaved={onSaved} />
            )}
            {payment.status === "under_review" && (
              <p>
                The owner will check your transfer. Your payment status updates
                here after review.
              </p>
            )}
          </>
        )
      )}
    </section>
  );
}
export function AdminPayment({
  order,
  headers,
  preview,
  onUpdated,
}: {
  order: StoreRequest;
  headers: Record<string, string>;
  preview: boolean;
  onUpdated: (order: StoreRequest) => void;
}) {
  const payment = order.data.payment;
  const [note, setNote] = useState(""),
    [method, setMethod] = useState(
      payment?.method === "easypaisa"
        ? "easypaisa"
        : payment?.method === "cod"
          ? "cod"
          : "bank",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(status?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ request: StoreRequest }>(
        status
          ? `/api/admin/payments/${payment?.proofId}`
          : `/api/admin/requests/${order.id}/confirm`,
        {
          method: status ? "PATCH" : "POST",
          headers,
          body: JSON.stringify(status ? { status, note } : { method }),
        },
      );
      onUpdated(result.request);
      setNote("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!payment) return null;
  return (
    <section className="admin-payment-panel">
      <h3>Payment</h3>
      <p className="payment-state">
        {payment.method === "bank"
          ? "Bank transfer"
          : payment.method === "easypaisa"
            ? "Easypaisa"
            : payment.method === "cod"
              ? "Cash on delivery"
              : "Enquiry"}{" "}
        · {paymentLabel(payment.status)}
      </p>
      {order.kind === "inquiry" &&
        order.data.items.length > 0 &&
        order.status !== "resolved" && (
          <div className="customer-form">
            <p className="muted small">
              Set prices, size stock and the delivery fee first. Confirming
              reserves stock and lets this customer complete payment in their
              account.
            </p>
            <label>
              Payment method
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                disabled={busy || preview}
              >
                <option value="bank">Bank transfer</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="cod">Cash on delivery</option>
              </select>
            </label>
            <button
              className="button"
              disabled={busy || preview}
              onClick={() => void action()}
            >
              {busy ? "Confirming…" : "Confirm enquiry as order"}
            </button>
          </div>
        )}
      <PaymentDestination payment={payment} />
      {payment.reference && (
        <p>
          Transaction: <strong>{payment.reference}</strong>
        </p>
      )}
      {payment.note && <p>Store note: {payment.note}</p>}
      {payment.proofId && !preview && (
        <a
          className="receipt-image-link"
          href={`/api/admin/proofs/${payment.proofId}`}
          target="_blank"
          rel="noreferrer"
        >
          <img
            className="receipt-preview"
            src={`/api/admin/proofs/${payment.proofId}`}
            alt="Customer payment receipt"
          />
          <span className="text-link">Open full receipt</span>
        </a>
      )}
      {payment.status === "under_review" && order.status !== "cancelled" && (
        <div className="customer-form">
          <label>
            Review note
            <textarea
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Required when rejecting a receipt"
              disabled={busy || preview}
            />
          </label>
          <div className="payment-review-actions">
            <button
              className="button"
              disabled={busy || preview}
              onClick={() => void action("approved")}
            >
              Approve payment
            </button>
            <button
              className="button secondary"
              disabled={busy || preview}
              onClick={() => void action("rejected")}
            >
              Reject receipt
            </button>
          </div>
        </div>
      )}
      <p className="field-error" role="alert">
        {error}
      </p>
    </section>
  );
}
