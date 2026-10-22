export type Product = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  category: string;
  color: string;
  swatch: string;
  variantOf?: string;
  sku?: string;
  price: number | null;
  stock: number | null;
  stockBySize?: Record<string, number | null>;
  sizes: string[];
  published: boolean;
  featured: boolean;
  image: string;
  images: string[];
  hero?: string;
  imagePosition?: string;
  description: string;
  details: string[];
  sizeSystem?: string;
  footLengthsCm?: Record<string, number | null>;
  fitNotes?: string;
};
export type Discount = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minimum: number;
  expires: string | null;
  active: boolean;
};
export type Settings = {
  brand: string;
  currency: string;
  email: string;
  orderNotificationEmail?: string;
  whatsapp: string;
  instagram: string;
  website: string;
  phone: string;
  tiktok: string;
  bankAccountHolder: string;
  bankIban: string;
  bankAccountNumber: string;
  easypaisaHolder: string;
  easypaisaNumber: string;
  address: string;
  announcement: string;
  shippingFee: number | null;
  codEnabled: boolean;
  deliveryText: string;
  returnsText: string;
  deliveryEstimate?: string;
  exchangeWindowDays?: number | null;
  discounts?: Discount[];
};
export type CartItem = { id: string; size: string; quantity: number };
export type StoreRequest = {
  id: string;
  kind: "inquiry" | "order";
  status: string;
  created: string;
  data: {
    archivedAt?: string;
    tracking?: {
      courier: string;
      number: string;
      url: string;
      updated: string;
    };
    payment?: Payment;
    customer: {
      name: string;
      phone: string;
      city: string;
      address: string;
      notes: string;
    };
    items: (CartItem & { name: string; price: number | null })[];
    totals: {
      total: number | null;
      subtotal: number | null;
      shipping: number | null;
      discount: number;
    };
  };
};

export type Payment = {
  method: "bank" | "easypaisa" | "cod" | "inquiry";
  status:
    | "awaiting_payment"
    | "under_review"
    | "paid"
    | "rejected"
    | "cod"
    | "not_required";
  recipient?: {
    holder: string;
    iban?: string;
    account?: string;
    number?: string;
  } | null;
  proofId?: string;
  reference?: string;
  note?: string;
};
