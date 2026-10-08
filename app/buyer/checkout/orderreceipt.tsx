import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  collection,
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "@/FirebaseConfig";
import { formatPhilippinePhoneNumber } from "@/utils/validators";
import { OrderType } from "@/src/types/order";

const DARK_GREEN = "#14532d";

const firstParam = (
  value: string | string[] | undefined
) =>
  Array.isArray(value)
    ? value[0] || ""
    : value || "";

const parseJSON = <T,>(
  value: string | string[] | undefined,
  fallback: T
): T => {
  if (!value || Array.isArray(value)) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export default function OrderReceipt() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const showBackButton = firstParam(params.from) === "orders";

  const orderIds = parseJSON<string[]>(
    params.orderIds,
    []
  );

  const [orders, setOrders] =
    useState<OrderType[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const loadOrders = async () => {
      if (orderIds.length === 0) {
        if (mounted) {
          setLoading(false);
        }

        return;
      }

      try {
        const result =
          await Promise.all(
            orderIds.map(
              async (orderId) => {
                try {
                  const snap =
                    await getDoc(
                      doc(
                        db,
                        "orders",
                        orderId
                      )
                    );

                  if (!snap.exists()) {
                    return null;
                  }

                  return {
                    id: snap.id,
                    ...snap.data(),
                  } as OrderType;
                } catch (error) {
                  console.log(
                    "LOAD THANK YOU ORDER ERROR:",
                    error
                  );

                  return null;
                }
              }
            )
          );

        const validOrders =
          result.filter(
            Boolean
          ) as OrderType[];

        if (mounted) {
          setOrders(validOrders);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      mounted = false;
    };
  }, [orderIds.join(",")]);

  const overallSubTotal = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.subTotal || 0
          ),
        0
      ),
    [orders]
  );

  const overallDeliveryFee = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.deliveryFee || 0
          ),
        0
      ),
    [orders]
  );

  const overallTotal = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.total || 0
          ),
        0
      ),
    [orders]
  );

  const payment =
    orders[0]?.payment ||
    (firstParam(params.payment) ===
    "cod"
      ? "cod"
      : "gcash");

  const delivery =
    orders[0]?.delivery ||
    (firstParam(params.delivery) ===
    "delivery"
      ? "delivery"
      : "pickup");

  const paymentLabel =
    payment === "gcash"
      ? "GCash"
      : "Cash on Delivery";

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingBottom: 40,
        }}
      >
        {/* ================= HEADER ================= */}

        <View
          className="pt-16 pb-8 px-6 items-center rounded-b-[30px] relative"
          style={{ backgroundColor: DARK_GREEN }}
        >
          {showBackButton && (
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to orders"
              className="absolute left-5 top-14 w-10 h-10 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          )}
          <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-4">
            <Text className="text-4xl font-black" style={{ color: DARK_GREEN }}>
              ✓
            </Text>
          </View>

          <Text className="text-white text-2xl font-black text-center">
            Order Submitted!
          </Text>

          <Text
            className="text-sm text-center mt-2 leading-5"
            style={{ color: "#dcfce7" }}
          >
            Your order has been sent to the farmer for approval.
          </Text>
        </View>

        {/* ================= PAYMENT NOTICE ================= */}

        {payment === "gcash" && (
          <View className="mx-4 mt-5 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <Text className="text-yellow-900 font-bold text-base mb-1">
              GCash Payment
            </Text>

            <Text className="text-yellow-800 text-sm leading-5">
              No payment is required yet.
              Wait for the farmer to accept
              your order. Once accepted, go to
              Orders and tap Pay with GCash.
            </Text>
          </View>
        )}

        {payment === "cod" && (
          <View
            className="mx-4 mt-5 rounded-2xl border p-4"
            style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}
          >
            <Text className="font-bold text-base mb-1" style={{ color: DARK_GREEN }}>
              Cash on Delivery
            </Text>

            <Text className="text-sm leading-5" style={{ color: DARK_GREEN }}>
              Your order has been sent to the
              farmer. Payment will be made
              through Cash on Delivery{" "}
              {delivery === "pickup"
                ? "when you claim your farm pickup."
                : "after the order is delivered."}
            </Text>
          </View>
        )}

        {/* ================= ORDERS ================= */}

        <View className="mx-4 mt-4">
          <Text className="text-gray-900 text-lg font-black mb-3">
            Order Details
          </Text>

          {loading ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <ActivityIndicator
                size="large"
                color={DARK_GREEN}
              />

              <Text className="text-gray-500 mt-3">
                Loading order details...
              </Text>
            </View>
          ) : orders.length === 0 ? (
            <View className="bg-white rounded-2xl p-5">
              <Text className="text-gray-500 text-center">
                Order details could not be loaded.
              </Text>
            </View>
          ) : (
            orders.map(
              (
                order,
                index
              ) => (
                <View
                  key={
                    order.id ||
                    `order-${index}`
                  }
                  className="bg-white rounded-2xl p-4 mb-4"
                >
                  {/* FARM */}

                  <Text className="text-gray-500 text-xs uppercase font-bold">
                    Farm
                  </Text>

                  <Text className="text-lg font-black mt-1" style={{ color: DARK_GREEN }}>
                    {order.farmName ||
                      "Farm"}
                  </Text>

                  {/* ORDER NUMBER */}

                  <Text className="text-gray-500 text-xs mt-3">
                    Order ID
                  </Text>

                  <Text className="text-gray-800 font-bold mt-1">
                    {order.orderNumber ||
                      order.id ||
                      "Pending"}
                  </Text>

                  <View className="h-px bg-gray-100 my-4" />

                  {/* PRODUCTS */}

                  {(
                    order.products ||
                    []
                  ).map(
                    (
                      product,
                      productIndex
                    ) => (
                      <View
                        key={`${product.productId}-${productIndex}`}
                        className="flex-row items-center mb-4"
                      >
                        {product.image ? (
                          <Image
                            source={{
                              uri:
                                product.image,
                            }}
                            className="w-14 h-14 rounded-xl"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-14 h-14 rounded-xl bg-gray-100 items-center justify-center">
                            <Text className="text-gray-400 text-[10px]">
                              No image
                            </Text>
                          </View>
                        )}

                        <View className="flex-1 ml-3">
                          <Text
                            className="text-gray-900 font-bold"
                            numberOfLines={
                              1
                            }
                          >
                            {product.name}
                          </Text>

                          <Text className="text-gray-500 text-xs mt-1">
                            Qty:{" "}
                            {Number(
                              product.quantity ||
                                0
                            )}{" "}
                            {product.unit ||
                              ""}
                          </Text>

                          <Text className="text-gray-500 text-xs mt-1">
                            ₱
                            {Number(
                              product.price ||
                                0
                            ).toFixed(2)}{" "}
                            / unit
                          </Text>
                        </View>

                        <Text className="font-bold" style={{ color: DARK_GREEN }}>
                          ₱
                          {(
                            Number(
                              product.price ||
                                0
                            ) *
                            Number(
                              product.quantity ||
                                0
                            )
                          ).toFixed(2)}
                        </Text>
                      </View>
                    )
                  )}

                  {/* ORDER SUBTOTAL */}

                  <View className="h-px bg-gray-100 my-2" />

                  <View className="flex-row justify-between mt-2">
                    <Text className="text-gray-500">
                      Subtotal
                    </Text>

                    <Text className="text-gray-900 font-semibold">
                      ₱
                      {Number(
                        order.subTotal ||
                          0
                      ).toFixed(2)}
                    </Text>
                  </View>

                  <View className="flex-row justify-between mt-2">
                    <Text className="text-gray-500">
                      Delivery Fee
                    </Text>

                    <Text className="text-gray-900 font-semibold">
                      ₱
                      {Number(
                        order.deliveryFee ||
                          0
                      ).toFixed(2)}
                    </Text>
                  </View>

                  <View className="flex-row justify-between mt-3">
                    <Text className="text-gray-900 font-black">
                      Order Total
                    </Text>

                    <Text className="text-lg font-black" style={{ color: DARK_GREEN }}>
                      ₱
                      {Number(
                        order.total || 0
                      ).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )
            )
          )}
        </View>

        {/* ================= DELIVERY / PICKUP ================= */}

        {orders.length > 0 && (
          <View className="mx-4 mt-1 bg-white rounded-2xl p-4">
            <Text className="text-gray-900 text-lg font-black mb-4">
              {delivery ===
              "delivery"
                ? "Delivery Information"
                : "Pickup Information"}
            </Text>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-500">
                Type
              </Text>

              <Text className="text-gray-900 font-bold capitalize">
                {delivery}
              </Text>
            </View>

            {delivery ===
            "delivery" ? (
              <View className="bg-gray-50 rounded-xl p-4">
                <Text className="text-gray-500 text-xs uppercase font-bold">
                  Delivery Address
                </Text>

                <Text className="text-gray-900 font-bold mt-2">
                  {
                    orders[0]
                      ?.address
                      ?.fullName
                  }
                </Text>

                <Text className="text-gray-700 text-sm mt-1">
                  {
                    orders[0]
                      ?.address
                      ?.street
                  }
                </Text>

                <Text className="text-gray-700 text-sm">
                  {[
                    orders[0]
                      ?.address
                      ?.barangay,
                    orders[0]
                      ?.address
                      ?.city,
                    orders[0]
                      ?.address
                      ?.province,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>

                {orders[0]
                  ?.address
                  ?.phone && (
                  <Text className="text-gray-700 text-sm mt-2">
                    {formatPhilippinePhoneNumber(orders[0].address.phone)}
                  </Text>
                )}
              </View>
            ) : (
              <View className="rounded-xl p-4" style={{ backgroundColor: "#f0fdf4" }}>
                <Text className="font-bold" style={{ color: DARK_GREEN }}>
                  Pickup from the farmer's farm
                </Text>

                <Text className="text-gray-600 text-sm mt-3">
                  Pickup Date
                </Text>

                <Text className="text-gray-900 font-semibold mt-1">
                  {orders[0]
                    ?.pickupDate ||
                    "Not set"}
                </Text>

                <Text className="text-gray-600 text-sm mt-3">
                  Pickup Time
                </Text>

                <Text className="text-gray-900 font-semibold mt-1">
                  {orders[0]
                    ?.pickupTime ||
                    "Not set"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ================= PAYMENT + GRAND TOTAL ================= */}

        {orders.length > 0 && (
          <View className="mx-4 mt-4 bg-white rounded-2xl p-4">
            <Text className="text-gray-900 text-lg font-black mb-4">
              Payment & Total
            </Text>

            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">
                Payment Method
              </Text>

              <Text className="text-gray-900 font-bold">
                {paymentLabel}
              </Text>
            </View>

            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">
                Subtotal
              </Text>

              <Text className="text-gray-900">
                ₱
                {overallSubTotal.toFixed(
                  2
                )}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-500">
                Delivery Fee
              </Text>

              <Text className="text-gray-900">
                ₱
                {overallDeliveryFee.toFixed(
                  2
                )}
              </Text>
            </View>

            <View className="h-px bg-gray-200 mb-3" />

            <View className="flex-row justify-between">
              <Text className="text-gray-900 text-base font-black">
                Total
              </Text>

              <Text className="text-xl font-black" style={{ color: DARK_GREEN }}>
                ₱
                {overallTotal.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* ================= BUTTONS ================= */}

        <View className="mx-4 mt-6">
          <TouchableOpacity
            onPress={() =>
              router.replace(
                "/buyer/profile/orders"
              )
            }
            className="py-4 rounded-[5px] items-center"
            style={{ backgroundColor: DARK_GREEN }}
          >
            <Text className="text-white font-bold text-base">
              View My Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              router.replace(
                "/buyer/(tabs)/home"
              )
            }
            className="bg-white py-4 rounded-[5px] items-center mt-3"
            style={{ borderWidth: 1, borderColor: DARK_GREEN }}
          >
            <Text className="font-bold text-base" style={{ color: DARK_GREEN }}>
              Continue Shopping
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}