import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../../FirebaseConfig";
import { getBatchesByProduct, recordSale } from "./productService";

import {
  OrderType,
  OrderProduct,
} from "../types/order";

const BACKEND_URL = String(
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/+$/, "");

const requestBackend = async <T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  if (!BACKEND_URL) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured.");
  }

  const user = getAuth().currentUser;
  if (!user) {
    throw new Error("Your login session has expired. Please login again.");
  }

  const token = await user.getIdToken();
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Backend request failed with status ${response.status}.`
    );
  }

  return data as T;
};

const settleOrderCompletionOnBackend = async (
  orderId: string
) => {
  if (!BACKEND_URL) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured.");
  }

  const user = getAuth().currentUser;

  if (!user) {
    throw new Error("Your login session has expired. Please login again.");
  }

  const token = await user.getIdToken();

  const response = await fetch(
    `${BACKEND_URL}/wallet/orders/${encodeURIComponent(orderId)}/deliver`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Failed to settle order completion (${response.status}).`
    );
  }

  return data;
};

// ================= ORDER NUMBER =================

const generateOrderNumber =
  () => {
    const now =
      new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        now.getDate()
      ).padStart(
        2,
        "0"
      );

    const hours =
      String(
        now.getHours()
      ).padStart(
        2,
        "0"
      );

    const minutes =
      String(
        now.getMinutes()
      ).padStart(
        2,
        "0"
      );

    const seconds =
      String(
        now.getSeconds()
      ).padStart(
        2,
        "0"
      );

    const random =
      Math.floor(
        1000 +
          Math.random() *
            9000
      );

    return `FG-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
  };

// ================= CREATE ORDER =================

export const createOrder =
  async (
    order: OrderType
  ) => {
    try {
      const orderNumber =
        order.orderNumber ||
        generateOrderNumber();

      const commissionRate =
        0.03;

      // FarmGate commission applies to the product subtotal, not the delivery fee.
      // It is financially settled when the order is delivered.
      const commissionAmount = Number(
        (Number(order.subTotal) * commissionRate).toFixed(2)
      );

      const commissionStatus = "pending";

      /*
       * New order lifecycle:
       *
       * pending
       *   -> farmer accepts
       * accepted
       *   -> GCash: buyer pays
       *   -> COD: stock is rechecked when processing starts
       * processing
       * to_receive
       * delivered
       *
       * No stock is deducted at checkout.
       */
      const docRef =
        await addDoc(
          collection(db, "orders"),
          {
            ...order,

            orderNumber,

            status: "pending",

            paymentStatus:
              order.paymentStatus ||
              "pending",

            inventoryFulfilled:
              false,

            fulfillmentStatus:
              "pending",

            commissionRate,

            commissionAmount,

            commissionStatus,

            farmerEarning: Number(
              Math.max(0, Number(order.subTotal) - commissionAmount).toFixed(2)
            ),

            farmerWalletCredited: false,

            financialStatus: "pending",

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

      return {
        id: docRef.id,
        orderNumber,
      };
    } catch (error) {
      console.log(
        "ERROR CREATING ORDER:",
        error
      );

      throw error;
    }
  };

// ================= UPDATE ORDER PRODUCTS =================
// Kept for compatibility with other app code.
// GCash fulfillment itself is now handled by Render.

export const updateOrderProducts =
  async (
    orderId: string,
    buyerId: string,
    products: OrderProduct[]
  ) => {
    try {
      const ref =
        doc(
          db,
          "orders",
          orderId
        );

      const snap =
        await getDoc(
          ref
        );

      if (
        !snap.exists()
      ) {
        throw new Error(
          "Order not found."
        );
      }

      const order =
        snap.data() as OrderType;

      if (
        order.buyerId !==
        buyerId
      ) {
        throw new Error(
          "You are not authorized to update this order."
        );
      }

      await updateDoc(
        ref,
        {
          products,

          updatedAt:
            serverTimestamp(),
        }
      );

      return true;
    } catch (error) {
      console.log(
        "ERROR UPDATING ORDER PRODUCTS:",
        error
      );

      throw error;
    }
  };

// ================= CREATE GCASH PAYMENT =================

export const createGcashPayment = async (
  orderId: string,
  buyerId: string
) => {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.buyerId !== buyerId) {
      throw new Error("You are not authorized to pay for this order.");
    }

    if (order.payment !== "gcash") {
      throw new Error("This order is not a GCash order.");
    }

    if (order.status !== "accepted") {
      throw new Error("The farmer must accept the order before GCash payment.");
    }

    if (order.paymentStatus === "paid") {
      return {
        success: true,
        alreadyPaid: true,
        orderId,
        paymentStatus: "paid",
      };
    }

    return await requestBackend("/create-payment", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
  } catch (error) {
    console.log("ERROR CREATING GCASH PAYMENT:", error);
    throw error;
  }
};

// ================= GET ORDER PAYMENT STATUS =================

export const getOrderPaymentStatus =
  async (
    orderId: string,
    buyerId: string
  ) => {
    try {
      const ref =
        doc(
          db,
          "orders",
          orderId
        );

      const snap =
        await getDoc(
          ref
        );

      if (
        !snap.exists()
      ) {
        throw new Error(
          "Order not found."
        );
      }

      const order =
        snap.data() as OrderType;

      if (
        order.buyerId !==
        buyerId
      ) {
        throw new Error(
          "You are not authorized to view this payment status."
        );
      }

      return (
        order.paymentStatus ||
        "pending"
      );
    } catch (error) {
      console.log(
        "ERROR GETTING PAYMENT STATUS:",
        error
      );

      throw error;
    }
  };

// ================= GET ORDER =================

export const getOrderById =
  async (
    id: string
  ) => {
    try {
      const ref =
        doc(
          db,
          "orders",
          id
        );

      const snap =
        await getDoc(
          ref
        );

      if (
        !snap.exists()
      ) {
        throw new Error(
          "Order not found."
        );
      }

      return {
        id:
          snap.id,

        ...snap.data(),
      } as OrderType;
    } catch (error) {
      console.log(
        "ERROR GETTING ORDER:",
        error
      );

      throw error;
    }
  };

// ================= TIMESTAMP =================

const toMillis =
  (
    ts: any
  ) => {
    if (!ts) {
      return 0;
    }

    if (
      typeof ts.toMillis ===
      "function"
    ) {
      return ts.toMillis();
    }

    if (
      typeof ts.seconds ===
      "number"
    ) {
      return (
        ts.seconds *
        1000
      );
    }

    if (
      typeof ts ===
      "number"
    ) {
      return ts;
    }

    if (
      typeof ts ===
      "string"
    ) {
      const parsed =
        new Date(
          ts
        ).getTime();

      return Number.isFinite(
        parsed
      )
        ? parsed
        : 0;
    }

    return 0;
  };

// ================= GET BUYER ORDERS =================

export const getBuyerOrders =
  async (
    buyerId: string
  ) => {
    try {
      const q =
        query(
          collection(
            db,
            "orders"
          ),
          where(
            "buyerId",
            "==",
            buyerId
          )
        );

      const snapshot =
        await getDocs(
          q
        );

      const orders =
        snapshot.docs.map(
          (d) =>
            ({
              id:
                d.id,

              ...d.data(),
            } as OrderType)
        );

      return orders.sort(
        (
          a,
          b
        ) =>
          toMillis(
            b.createdAt
          ) -
          toMillis(
            a.createdAt
          )
      );
    } catch (error) {
      console.log(
        "ERROR GETTING BUYER ORDERS:",
        error
      );

      throw error;
    }
  };

// ================= GET FARMER ORDERS =================

export const getFarmerOrders =
  async (
    farmerId: string
  ) => {
    try {
      const q =
        query(
          collection(
            db,
            "orders"
          ),
          where(
            "farmerId",
            "==",
            farmerId
          )
        );

      const snapshot =
        await getDocs(
          q
        );

      const orders =
        snapshot.docs.map(
          (d) =>
            ({
              id:
                d.id,

              ...d.data(),
            } as OrderType)
        );

      return orders.sort(
        (
          a,
          b
        ) =>
          toMillis(
            b.createdAt
          ) -
          toMillis(
            a.createdAt
          )
      );
    } catch (error) {
      console.log(
        "ERROR GETTING FARMER ORDERS:",
        error
      );

      throw error;
    }
  };

// ================= MARK PRODUCT REVIEWED =================

export const markProductReviewed =
  async (
    orderId: string,
    productId: string
  ) => {
    try {
      const ref =
        doc(
          db,
          "orders",
          orderId
        );

      const snap =
        await getDoc(
          ref
        );

      if (
        !snap.exists()
      ) {
        throw new Error(
          "Order not found."
        );
      }

      const order =
        snap.data() as OrderType;

      const updatedProducts =
        (
          order.products ||
          []
        ).map(
          (product) =>
            product.productId ===
            productId
              ? {
                  ...product,

                  reviewed:
                    true,
                }
              : product
        );

      await updateDoc(
        ref,
        {
          products:
            updatedProducts,

          updatedAt:
            serverTimestamp(),
        }
      );
    } catch (error) {
      console.log(
        "ERROR MARKING REVIEW:",
        error
      );

      throw error;
    }
  };

// ================= BUYER CANCEL =================

export const cancelOrder =
  async (
    orderId: string,
    buyerId: string,
    reason: string
  ) => {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));

      if (!snap.exists()) {
        throw new Error("Order not found.");
      }

      const order = snap.data() as OrderType;

      if (order.buyerId !== buyerId) {
        throw new Error("You are not authorized to cancel this order.");
      }

      if (order.payment === "gcash" && order.paymentStatus === "paid") {
        throw new Error(
          "This GCash order has already been paid and cannot be cancelled here because a refund is required."
        );
      }

      await requestBackend(`/wallet/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason?.trim() || "Cancelled by buyer." }),
      });

      return true;
    } catch (error) {
      console.log("ERROR CANCELLING ORDER:", error);
      throw error;
    }
  };

// ================= STOCK VALIDATION =================

const getAvailableStock =
  async (
    productId: string
  ) => {
    if (!productId) {
      throw new Error(
        "Product ID is missing."
      );
    }

    const batches =
      await getBatchesByProduct(
        productId
      );

    return batches
      .filter(
        (batch: any) =>
          batch.archived !== true &&
          Number(batch.stock) > 0 &&
          batch.status === "Available"
      )
      .reduce(
        (
          total: number,
          batch: any
        ) =>
          total +
          Number(batch.stock || 0),
        0
      );
  };

const validateOrderStock =
  async (
    products: OrderProduct[]
  ) => {
    const requestedMap =
      new Map<
        string,
        {
          quantity: number;
          name: string;
          unit: string;
        }
      >();

    for (const product of products || []) {
      const productId =
        String(
          product.productId || ""
        ).trim();

      if (!productId) {
        throw new Error(
          `Product ID is missing for ${product.name || "an order item"}.`
        );
      }

      const current =
        requestedMap.get(
          productId
        );

      requestedMap.set(
        productId,
        {
          quantity:
            (current?.quantity || 0) +
            Number(product.quantity || 0),
          name:
            current?.name ||
            product.name ||
            "Product",
          unit:
            current?.unit ||
            product.unit ||
            "unit",
        }
      );
    }

    const checks =
      await Promise.all(
        Array.from(
          requestedMap.entries()
        ).map(
          async ([
            productId,
            requested,
          ]) => {
            const available =
              await getAvailableStock(
                productId
              );

            return {
              productId,
              ...requested,
              available,
            };
          }
        )
      );

    const shortages =
      checks.filter(
        (item) =>
          item.quantity >
          item.available
      );

    if (shortages.length > 0) {
      const details =
        shortages
          .map(
            (item) =>
              `${item.name}: requested ${item.quantity}, available ${item.available} ${String(item.unit).replace(/^per\s+/i, "")}`
          )
          .join("\n");

      throw new Error(
        `Insufficient stock.\n\n${details}`
      );
    }

    return checks;
  };

// ================= FARMER ACCEPT =================

export const acceptOrder =
  async (
    orderId: string,
    farmerId: string
  ) => {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));

      if (!snap.exists()) {
        throw new Error("Order not found.");
      }

      const order = snap.data() as OrderType;

      if (order.farmerId !== farmerId) {
        throw new Error("You are not authorized to accept this order.");
      }

      if (order.status !== "pending") {
        throw new Error("Only pending orders can be accepted.");
      }

      await requestBackend(`/wallet/orders/${encodeURIComponent(orderId)}/accept`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return true;
    } catch (error) {
      console.log("ERROR ACCEPTING ORDER:", error);
      throw error;
    }
  };

// ================= FARMER CANCEL ACCEPTED ORDER =================

export const cancelAcceptedOrderByFarmer =
  async (
    orderId: string,
    farmerId: string,
    reason: string
  ) => {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));

      if (!snap.exists()) {
        throw new Error("Order not found.");
      }

      const order = snap.data() as OrderType;

      if (order.farmerId !== farmerId) {
        throw new Error("You are not authorized to cancel this order.");
      }

      if (order.status !== "accepted") {
        throw new Error("Only accepted orders can be cancelled here.");
      }

      await requestBackend(`/wallet/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason?.trim() || "Cancelled by farmer." }),
      });

      return true;
    } catch (error) {
      console.log("ERROR CANCELLING ACCEPTED ORDER BY FARMER:", error);
      throw error;
    }
  };

// ================= FARMER DECLINE =================

export const declineOrder =
  async (
    orderId: string,
    farmerId: string,
    reason: string
  ) => {
    try {
      const ref =
        doc(
          db,
          "orders",
          orderId
        );

      const snap =
        await getDoc(ref);

      if (!snap.exists()) {
        throw new Error(
          "Order not found."
        );
      }

      const order =
        snap.data() as OrderType;

      if (
        order.farmerId !==
        farmerId
      ) {
        throw new Error(
          "You are not authorized to decline this order."
        );
      }

      if (
        order.status !==
        "pending"
      ) {
        throw new Error(
          "Only pending orders can be declined."
        );
      }

      await updateDoc(
        ref,
        {
          status:
            "cancelled",

          farmerDecision:
            "rejected",

          farmerDecisionAt:
            serverTimestamp(),

          cancelledBy:
            "farmer",

          cancelReason:
            reason,

          rejectionReason:
            reason,

          cancelledAt:
            serverTimestamp(),

          paymentStatus:
            order.payment ===
            "gcash"
              ? "cancelled"
              : order.paymentStatus ||
                "pending",

          inventoryFulfilled:
            false,

          fulfillmentStatus:
            "pending",

          updatedAt:
            serverTimestamp(),
        }
      );

      return true;
    } catch (error) {
      console.log(
        "ERROR DECLINING ORDER:",
        error
      );

      throw error;
    }
  };

// ================= UPDATE ORDER STATUS =================

export const updateOrderStatus =
  async (
    orderId: string,
    farmerId: string,
    status:
      | "accepted"
      | "processing"
      | "to_receive"
      | "delivered"
      | "claimed"
  ) => {
    try {
      const ref =
        doc(
          db,
          "orders",
          orderId
        );

      const snap =
        await getDoc(ref);

      if (!snap.exists()) {
        throw new Error(
          "Order not found."
        );
      }

      const order =
        snap.data() as OrderType;

      if (
        order.farmerId !==
        farmerId
      ) {
        throw new Error(
          "You are not authorized to update this order."
        );
      }

      if (
        status ===
        "accepted"
      ) {
        return await acceptOrder(
          orderId,
          farmerId
        );
      }

      // ================= PROCESSING =================
      if (
        status ===
        "processing"
      ) {
        if (
          order.status !==
          "accepted"
        ) {
          throw new Error(
            "Only accepted orders can be processed."
          );
        }

        /*
         * GCash:
         * payment.capture must already have fulfilled inventory.
         */
        if (
          order.payment ===
          "gcash"
        ) {
          if (
            order.paymentStatus !==
            "paid"
          ) {
            throw new Error(
              "This GCash order has not been paid yet."
            );
          }

          if (
            order.inventoryFulfilled !==
            true
          ) {
            throw new Error(
              "This GCash order has not been fulfilled from inventory yet."
            );
          }
        }

        /*
         * COD:
         * Stock is checked again immediately before processing and
         * deducted only when the farmer starts processing the order.
         */
        if (
          order.payment ===
          "cod"
        ) {
          if (
            order.inventoryFulfilled !==
            true
          ) {
            await validateOrderStock(
              order.products || []
            );

            const fulfilledProducts:
              OrderProduct[] = [
                ...(order.products || []),
              ];

            for (
              let index = 0;
              index <
                fulfilledProducts.length;
              index++
            ) {
              const product =
                fulfilledProducts[index];

              /*
               * A contribution trace means this product was already
               * deducted in an earlier attempt. Skip it so retrying
               * processing cannot deduct the same product twice.
               */
              if (
                Array.isArray(
                  product.contributions
                ) &&
                product.contributions.length >
                  0
              ) {
                continue;
              }

              const {
                contributions,
              } = await recordSale(
                product.productId,
                Number(
                  product.quantity
                )
              );

              const primary =
                contributions[0] ||
                null;

              fulfilledProducts[index] = {
                ...product,
                batchId:
                  primary?.batchId ??
                  null,
                batchNumber:
                  primary?.batchNumber ??
                  null,
                harvestRecordId:
                  primary?.harvestRecordId ??
                  null,
                contributions,
              };

              // Persist each successful product immediately so a later
              // failure can be retried without deducting this product again.
              await updateDoc(
                ref,
                {
                  products:
                    fulfilledProducts,

                  updatedAt:
                    serverTimestamp(),
                }
              );
            }

            await updateDoc(
              ref,
              {
                products:
                  fulfilledProducts,

                inventoryFulfilled:
                  true,

                fulfillmentStatus:
                  "fulfilled",

                inventoryFulfilledAt:
                  serverTimestamp(),
              }
            );
          }
        }

        await updateDoc(
          ref,
          {
            status:
              "processing",

            processingAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        return true;
      }

      // ================= TO RECEIVE =================
      if (
        status ===
        "to_receive"
      ) {
        if (
          order.status !==
          "processing"
        ) {
          throw new Error(
            "Only processing orders can be marked as To Receive."
          );
        }

        await updateDoc(
          ref,
          {
            status:
              "to_receive",

            toReceiveAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        return true;
      }

      // ================= COMPLETION =================
      if (status === "delivered" || status === "claimed") {
        const isPickup = order.delivery === "pickup";

        if ((status === "claimed") !== isPickup) {
          throw new Error(
            isPickup
              ? "Farm pickup orders must be marked as claimed."
              : "Delivery orders must be marked as delivered."
          );
        }

        if (order.status === status) {
          return true;
        }

        if (order.status !== "to_receive") {
          throw new Error(
            "Only To Receive orders can be completed."
          );
        }

        // Financial settlement remains on the trusted backend.
        const settlement =
          await settleOrderCompletionOnBackend(orderId);

        if (status === "claimed") {
          await updateDoc(ref, {
            status: "claimed",
            updatedAt: serverTimestamp(),
          });
        }

        return settlement;
      }

      throw new Error(
        "Invalid order status."
      );
    } catch (error) {
      console.log(
        "ERROR UPDATING ORDER STATUS:",
        error
      );

      throw error;
    }
  };
