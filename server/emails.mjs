import { createElement as h } from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
  Row,
  Column,
  render,
  toPlainText,
} from "react-email";

export const emailEvents = {
  new_order: [
    "New order",
    "A customer has placed an order. Open the store dashboard to review it.",
  ],
  new_enquiry: [
    "New enquiry",
    "A customer has sent a selection for the store to review.",
  ],
  support_message: [
    "New support message",
    "A customer has contacted the store.",
  ],
  order_confirmed: [
    "Order confirmed for payment",
    "An enquiry has been confirmed as an order. The customer can now submit payment proof.",
  ],
  status_changed: [
    "Order status updated",
    "The store has updated this request's status.",
  ],
  payment_submitted: [
    "Payment receipt submitted",
    "A customer has uploaded a receipt. Review it in the dashboard before fulfilling the order.",
  ],
  payment_approved: [
    "Payment approved",
    "The store has verified the payment receipt.",
  ],
  payment_rejected: [
    "Payment receipt rejected",
    "The receipt needs correction. The customer can see the review in their account.",
  ],
  test: [
    "Qadam Flex email test",
    "Your store's email sending connection is working. New orders, confirmations, payment updates and website support messages will be sent to this notification address.",
  ],
};
const ink = "#171717",
  muted = "#666666";
const money = (value) =>
  value == null
    ? "To be confirmed"
    : new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 0,
      }).format(value / 100);
const label = (value) => String(value || "").replaceAll("_", " ");
const line = (name, value, key = name) =>
  h(
    Row,
    { key, style: { margin: "10px 0" } },
    h(
      Column,
      {
        style: {
          width: "42%",
          color: muted,
          fontSize: "14px",
          verticalAlign: "top",
        },
      },
      name,
    ),
    h(
      Column,
      {
        style: {
          color: ink,
          fontSize: "14px",
          fontWeight: "600",
          textAlign: "right",
          overflowWrap: "anywhere",
        },
      },
      value,
    ),
  );

export async function renderOwnerEmail(payload) {
  const [title, description] = emailEvents[payload.event];
  const subject = payload.reference ? `${title} · ${payload.reference}` : title;
  const html = await render(
    h(
      Html,
      { lang: "en", dir: "ltr" },
      h(Head),
      h(
        Body,
        {
          style: {
            backgroundColor: "#f4f4f1",
            margin: "0",
            padding: "24px 12px",
            fontFamily: "Arial, Helvetica, sans-serif",
            color: ink,
          },
        },
        h(Preview, null, description),
        h(
          Container,
          {
            style: {
              backgroundColor: "#ffffff",
              maxWidth: "560px",
              border: "1px solid #e5e5e1",
              padding: "32px 24px",
            },
          },
          h(
            Text,
            {
              style: {
                margin: "0 0 28px",
                fontWeight: "700",
                fontSize: "18px",
                letterSpacing: "2px",
              },
            },
            "QADAM FLEX",
          ),
          h(
            Heading,
            {
              as: "h1",
              style: {
                fontSize: "25px",
                lineHeight: "32px",
                margin: "0 0 16px",
              },
            },
            title,
          ),
          h(
            Text,
            { style: { fontSize: "15px", lineHeight: "24px", color: muted } },
            description,
          ),
          payload.reference &&
            h(
              Section,
              null,
              line("Reference", payload.reference),
              line("Status", label(payload.status)),
              payload.customer?.name && line("Customer", payload.customer.name),
              payload.customer?.city && line("City", payload.customer.city),
              payload.payment?.method &&
                line("Payment method", label(payload.payment.method)),
              payload.payment?.status &&
                line("Payment status", label(payload.payment.status)),
            ),
          payload.items?.length > 0 &&
            h(
              Section,
              null,
              h(Hr, {
                style: {
                  border: "0",
                  borderTop: "1px solid #e5e5e1",
                  margin: "24px 0",
                },
              }),
              ...payload.items.map((item, index) =>
                line(
                  `${item.name} · Size ${item.size} · Qty ${item.quantity}`,
                  money(item.price == null ? null : item.price * item.quantity),
                  `item-${index}`,
                ),
              ),
              line("Subtotal", money(payload.totals?.subtotal)),
              line(
                "Delivery",
                payload.totals?.shipping === 0
                  ? "Free delivery"
                  : money(payload.totals?.shipping),
              ),
              payload.totals?.discount > 0 &&
                line("Discount", `−${money(payload.totals.discount)}`),
              line("Total", money(payload.totals?.total)),
            ),
          payload.message &&
            h(
              Section,
              null,
              h(
                Heading,
                { as: "h2", style: { fontSize: "17px", marginTop: "24px" } },
                "Customer message",
              ),
              h(
                Text,
                {
                  style: {
                    whiteSpace: "pre-wrap",
                    fontSize: "14px",
                    lineHeight: "23px",
                    overflowWrap: "anywhere",
                  },
                },
                payload.message,
              ),
            ),
          h(
            Button,
            {
              href: "https://www.qadamflex.bond/admin",
              style: {
                display: "block",
                boxSizing: "border-box",
                backgroundColor: ink,
                color: "#ffffff",
                padding: "15px 20px",
                textAlign: "center",
                textDecoration: "none",
                fontSize: "14px",
                marginTop: "28px",
              },
            },
            "Open store dashboard",
          ),
          h(
            Text,
            {
              style: {
                color: muted,
                fontSize: "12px",
                lineHeight: "20px",
                margin: "24px 0 0",
              },
            },
            "Store notification · Sign in to view full delivery details and private receipts. Manage the receiving email in Store settings.",
          ),
        ),
      ),
    ),
  );
  return { subject, html, text: toPlainText(html) };
}
