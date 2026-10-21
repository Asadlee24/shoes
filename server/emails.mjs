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
  Img,
  Link,
  render,
  toPlainText,
} from "react-email";

export const emailEvents = {
  low_stock: ["Low stock alert", "A shoe size needs your attention."],
  tracking_updated: [
    "Your delivery tracking",
    "Your courier details are ready in your account.",
  ],
  password_reset: [
    "Reset your password",
    "Use the button below to choose a new password. This link expires in 15 minutes. If you did not request this, you can ignore this email.",
  ],
  verify_email: [
    "Verify your email",
    "Confirm this email address to receive your order confirmations and delivery updates. This link expires in 24 hours.",
  ],
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
const ink = "#17212b",
  muted = "#5e6975",
  blue = "#006ba6";
const website = "https://www.qadamflex.bond";
const money = (value) =>
  value == null
    ? "To be confirmed"
    : new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 0,
      }).format(value / 100);
const label = (value) => String(value || "").replaceAll("_", " ");
const textStyle = {
  margin: "0",
  fontSize: "14px",
  lineHeight: "22px",
  color: ink,
};
const divider = () =>
  h(Hr, {
    style: { border: "0", borderTop: "1px solid #e5e9ed", margin: "24px 0" },
  });
const line = (name, value, key = name, total = false) =>
  h(
    Row,
    { key },
    h(
      Column,
      {
        style: {
          width: "45%",
          padding: total ? "16px 0 0" : "6px 0",
          verticalAlign: "top",
          color: total ? ink : muted,
          fontSize: total ? "16px" : "13px",
          lineHeight: "22px",
          fontWeight: total ? "700" : "400",
        },
      },
      name,
    ),
    h(
      Column,
      {
        style: {
          padding: total ? "16px 0 0" : "6px 0",
          verticalAlign: "top",
          color: total ? blue : ink,
          fontSize: total ? "20px" : "13px",
          lineHeight: "24px",
          fontWeight: "600",
          textAlign: "right",
          overflowWrap: "anywhere",
        },
      },
      value,
    ),
  );
const badges = {
  new_order: "NEW ORDER",
  new_enquiry: "CUSTOMER ENQUIRY",
  support_message: "CUSTOMER SUPPORT",
  order_confirmed: "ORDER CONFIRMED",
  status_changed: "ORDER UPDATE",
  payment_submitted: "REVIEW REQUIRED",
  payment_approved: "PAYMENT VERIFIED",
  payment_rejected: "PAYMENT UPDATE",
  test: "EMAIL CONNECTED",
};

export async function renderOwnerEmail(payload) {
  let [title, description] = emailEvents[payload.event];
  if (payload.audience === "customer") {
    const copy = {
      new_order: [
        "We've received your order",
        "Thank you for choosing Qadam Flex. View your order and payment instructions in your account.",
      ],
      new_enquiry: [
        "We've received your enquiry",
        "Your selection has reached our store. We will confirm availability in your account.",
      ],
      order_confirmed: [
        "Your order is confirmed",
        "Your order is ready for payment. View the payment details in your account.",
      ],
      status_changed: [
        "Your order has an update",
        `Your order status is now ${label(payload.status)}. Open your account for details.`,
      ],
      payment_approved: [
        "Your payment is verified",
        "Thank you. We have verified your payment and will process your order.",
      ],
      payment_rejected: [
        "Please check your payment receipt",
        "Your receipt needs attention. View the store's note in your account.",
      ],
    };
    [title, description] = copy[payload.event] || [title, description];
  }
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
            backgroundColor: "#eef1f4",
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
              maxWidth: "600px",
              border: "1px solid #dfe5eb",
              borderRadius: "16px",
              overflow: "hidden",
            },
          },
          h(
            Section,
            {
              style: {
                backgroundColor: "#0b1017",
                backgroundImage: "linear-gradient(#0b1017,#0b1017)",
                borderTop: "4px solid #008acb",
                padding: "22px 20px 20px",
                textAlign: "center",
              },
            },
            h(
              Link,
              { href: website, style: { textDecoration: "none" } },
              h(Img, {
                src: `${website}/brand/logo-transparent.png`,
                alt: "Qadam Flex shoe store",
                width: "194",
                height: "151",
                style: {
                  display: "block",
                  margin: "0 auto",
                  maxWidth: "100%",
                  height: "auto",
                  border: "0",
                },
              }),
            ),
            h(
              Text,
              {
                style: {
                  margin: "12px 0 0",
                  color: "#c4d3e0",
                  fontSize: "10px",
                  lineHeight: "18px",
                  letterSpacing: "3px",
                  fontWeight: "600",
                },
              },
              "STORE NOTIFICATIONS",
            ),
          ),
          h(
            Section,
            { style: { padding: "28px 24px 30px" } },
            h(
              Text,
              {
                style: {
                  margin: "0 0 14px",
                  color: blue,
                  fontSize: "10px",
                  lineHeight: "18px",
                  letterSpacing: "1.5px",
                  fontWeight: "700",
                },
              },
              badges[payload.event] || "QADAM FLEX",
            ),
            h(
              Heading,
              {
                as: "h1",
                style: {
                  fontSize: "28px",
                  lineHeight: "35px",
                  fontWeight: "700",
                  letterSpacing: "-0.7px",
                  margin: "0 0 14px",
                  color: ink,
                },
              },
              title,
            ),
            h(
              Text,
              { style: { ...textStyle, color: muted, marginBottom: "24px" } },
              description,
            ),
            payload.reference &&
              h(
                Section,
                {
                  style: {
                    backgroundColor: "#f4f7fa",
                    border: "1px solid #e5eaf0",
                    borderRadius: "8px",
                    padding: "16px",
                  },
                },
                h(
                  Text,
                  {
                    style: {
                      margin: "0 0 4px",
                      color: muted,
                      fontSize: "10px",
                      lineHeight: "18px",
                      letterSpacing: "1px",
                    },
                  },
                  "REFERENCE",
                ),
                h(
                  Text,
                  {
                    style: {
                      margin: "0 0 12px",
                      fontWeight: "700",
                      color: ink,
                      fontSize: "15px",
                      lineHeight: "23px",
                      overflowWrap: "anywhere",
                    },
                  },
                  payload.reference,
                ),
                line("Status", label(payload.status)),
                payload.customer?.name &&
                  line("Customer", payload.customer.name),
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
                divider(),
                h(
                  Heading,
                  {
                    as: "h2",
                    style: {
                      margin: "0 0 12px",
                      color: ink,
                      fontSize: "17px",
                      lineHeight: "25px",
                    },
                  },
                  "Order summary",
                ),
                ...payload.items.map((item, index) =>
                  h(
                    Row,
                    { key: `item-${index}` },
                    h(
                      Column,
                      {
                        style: {
                          padding: "12px 10px 12px 0",
                          borderBottom: "1px solid #edf0f3",
                          width: "66%",
                          verticalAlign: "top",
                        },
                      },
                      h(
                        Text,
                        { style: { ...textStyle, fontWeight: "600" } },
                        item.name,
                      ),
                      h(
                        Text,
                        {
                          style: {
                            margin: "3px 0 0",
                            color: muted,
                            fontSize: "12px",
                            lineHeight: "19px",
                          },
                        },
                        `Size ${item.size} · Qty ${item.quantity}`,
                      ),
                    ),
                    h(
                      Column,
                      {
                        style: {
                          padding: "12px 0",
                          borderBottom: "1px solid #edf0f3",
                          textAlign: "right",
                          verticalAlign: "top",
                        },
                      },
                      h(
                        Text,
                        { style: { ...textStyle, fontWeight: "600" } },
                        money(
                          item.price == null
                            ? null
                            : item.price * item.quantity,
                        ),
                      ),
                    ),
                  ),
                ),
                h(
                  Section,
                  { style: { paddingTop: "12px" } },
                  line("Subtotal", money(payload.totals?.subtotal)),
                  line(
                    "Delivery",
                    payload.totals?.shipping === 0
                      ? "Free delivery"
                      : money(payload.totals?.shipping),
                  ),
                  payload.totals?.discount > 0 &&
                    line("Discount", `−${money(payload.totals.discount)}`),
                  line(
                    "Order total",
                    money(payload.totals?.total),
                    "total",
                    true,
                  ),
                ),
              ),
            payload.message &&
              h(
                Section,
                null,
                divider(),
                h(
                  Heading,
                  {
                    as: "h2",
                    style: {
                      fontSize: "17px",
                      lineHeight: "25px",
                      margin: "0 0 12px",
                    },
                  },
                  payload.audience === "customer"
                    ? "Your update"
                    : payload.event === "low_stock"
                      ? "Stock alert"
                      : "Customer message",
                ),
                h(
                  Section,
                  {
                    style: {
                      borderLeft: "3px solid #008acb",
                      padding: "12px 16px",
                      backgroundColor: "#f4f7fa",
                    },
                  },
                  h(
                    Text,
                    {
                      style: {
                        ...textStyle,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      },
                    },
                    payload.message,
                  ),
                ),
              ),
            h(
              Button,
              {
                href:
                  payload.actionUrl ||
                  `${website}/${payload.audience === "customer" ? "account" : "admin"}`,
                style: {
                  display: "block",
                  boxSizing: "border-box",
                  backgroundColor: blue,
                  border: `1px solid ${blue}`,
                  borderRadius: "6px",
                  color: "#ffffff",
                  padding: "16px 18px",
                  textAlign: "center",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginTop: "28px",
                },
              },
              payload.event === "password_reset"
                ? "Reset password"
                : payload.event === "verify_email"
                  ? "Verify email"
                  : payload.audience === "customer"
                    ? "View your order"
                    : "Open store dashboard",
            ),
            h(
              Text,
              {
                style: {
                  margin: "14px 0 0",
                  color: muted,
                  fontSize: "11px",
                  lineHeight: "18px",
                  textAlign: "center",
                },
              },
              payload.actionUrl
                ? "This private link works once. Never share it with anyone."
                : "Sign in to view this update and your private details.",
            ),
          ),
          h(
            Section,
            {
              style: {
                borderTop: "1px solid #e5e9ed",
                padding: "20px 24px",
                textAlign: "center",
                backgroundColor: "#f8fafb",
              },
            },
            h(
              Text,
              {
                style: {
                  margin: "0 0 10px",
                  color: ink,
                  fontSize: "12px",
                  lineHeight: "20px",
                  fontWeight: "700",
                  letterSpacing: "1px",
                },
              },
              "QADAM FLEX",
            ),
            h(
              Text,
              {
                style: {
                  margin: "0 0 12px",
                  fontSize: "12px",
                  lineHeight: "22px",
                  color: muted,
                },
              },
              h(
                Link,
                {
                  href: website,
                  style: { color: blue, textDecoration: "underline" },
                },
                "Visit store",
              ),
              " · ",
              h(
                Link,
                {
                  href: "https://www.instagram.com/qadamflex",
                  style: { color: blue, textDecoration: "underline" },
                },
                "Instagram",
              ),
              " · ",
              h(
                Link,
                {
                  href: "https://www.tiktok.com/@qadamflexoffical",
                  style: { color: blue, textDecoration: "underline" },
                },
                "TikTok",
              ),
            ),
            h(
              Text,
              {
                style: {
                  margin: "0",
                  color: muted,
                  fontSize: "11px",
                  lineHeight: "18px",
                },
              },
              payload.audience === "customer"
                ? "An account update from Qadam Flex. Need help? Visit the support page on our website."
                : "You're receiving this store alert at the notification address saved in Store settings.",
            ),
          ),
        ),
      ),
    ),
  );
  return { subject, html, text: toPlainText(html) };
}
