import { SaleContribution } from "./product";

export type OrderProduct = {
  productId: string;
  batchId: string | null;
  batchNumber: number | null;
  harvestRecordId: string | null;
  contributions: SaleContribution[];
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
  reviewed?: boolean;
};

export type OrderAddress = {
  id?: string;
  fullName: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  phone: string;
};

export type OrderStatus =
  | "pending"
  | "accepted"
  | "processing"
  | "to_receive"
  | "delivered"
  | "claimed"
  | "cancelled";

export type PaymentMethod =
  | "gcash"
  | "cod";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled";

export type FulfillmentStatus =
  | "pending"
  | "fulfilled"
  | "stock_unavailable"
  | "manual_review";

export type CommissionStatus =
  | "pending"
  | "charged"
  | "not_applicable";

export type CodCommissionReservationStatus =
  | "not_applicable"
  | "reserved"
  | "consumed"
  | "released";

export type OrderType = {
  id?: string;
  orderNumber?: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmName: string;
  products: OrderProduct[];
  delivery: "pickup" | "delivery";
  payment: PaymentMethod;
  address: OrderAddress | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  subTotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;

  // ================= FARMER DECISION =================
  farmerDecision?: "accepted" | "rejected";
  farmerDecisionAt?: any;
  rejectionReason?: string;

  // ================= TIMESTAMPS =================
  createdAt?: any;
  processingAt?: any;
  toReceiveAt?: any;
  deliveredAt?: any;
  cancelledAt?: any;
  paidAt?: any;
  updatedAt?: any;
  inventoryFulfilledAt?: any;

  // ================= CANCEL =================
  cancelledBy?: "buyer" | "farmer";
  cancelReason?: string;

  // ================= COMMISSION =================
  commissionRate?: number;
  commissionAmount?: number;
  commissionStatus?: CommissionStatus;
  commissionChargedAt?: any;

  farmerEarning?: number;
  farmerWalletCredited?: boolean;
  farmerWalletCreditedAt?: any;
  farmerWalletPendingCredited?: boolean;
  farmerWalletPendingCreditedAt?: any;
  financialStatus?: "pending" | "settled" | "refunded" | "manual_review";

  codCommissionReserved?: number;
  codCommissionReservationStatus?: CodCommissionReservationStatus;

  // ================= PAYMENT =================
  paymentStatus?: PaymentStatus;
  xenditPaymentRequestId?: string;
  xenditPaymentId?: string;
  xenditReferenceId?: string;
  xenditPaymentChannel?: string;
  xenditPaymentStatus?: string;
  paymentFailureCode?: string;
  paymentFailureReason?: string;
  paymentRequestCreatedAt?: any;

  // ================= INVENTORY / FULFILLMENT =================
  inventoryFulfilled?: boolean;
  fulfillmentStatus?: FulfillmentStatus;
  fulfillmentError?: string;
  serverValidated?: boolean;
  serverValidatedAt?: any;

  // ================= XENDIT WEBHOOK =================
  xenditWebhookEvent?: string;
  xenditWebhookReceivedAt?: any;
};
