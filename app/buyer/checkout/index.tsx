import {
  router,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/FirebaseConfig";
import { formatPhilippinePhoneNumber } from "@/utils/validators";
import { useAppAlert } from "@/context/FarmerAlertContext";

import {
  createOrder,
} from "@/src/services/orderService";

import {
  removeCartItem,
} from "@/src/services/cartService";

// ========================================================
// CONSTANTS
// ========================================================

const DARK_GREEN =
  "#14532d";

// ========================================================
// COMPONENT
// ========================================================

export default function Checkout() {
  const Alert = useAppAlert();
  const {
    buyerId,
    items,
  } =
    useLocalSearchParams();

  const [
    cart,
    setCart,
  ] =
    useState<any[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    buyerName,
    setBuyerName,
  ] =
    useState<
      string | null
    >(null);

  // ======================================================
  // ADDRESS
  // ======================================================

  const [
    address,
    setAddress,
  ] =
    useState<any>(
      null
    );

  // ======================================================
  // DELIVERY
  // ======================================================

  const [
    delivery,
    setDelivery,
  ] =
    useState<
      "pickup" | "delivery"
    >("pickup");

  // ======================================================
  // PAYMENT
  // ======================================================

  const [
    payment,
    setPayment,
  ] =
    useState<
      "gcash" | "cod"
    >("gcash");

  // ======================================================
  // PICKUP
  // ======================================================

  const [
    pickupDate,
    setPickupDate,
  ] =
    useState<
      string | null
    >(null);

  const [
    pickupTime,
    setPickupTime,
  ] =
    useState<
      string | null
    >(null);

  const [
    showDatePicker,
    setShowDatePicker,
  ] =
    useState(
      false
    );

  const [
    showTimePicker,
    setShowTimePicker,
  ] =
    useState(
      false
    );

  const [
    dateObj,
    setDateObj,
  ] =
    useState(
      new Date()
    );

  const [
    timeObj,
    setTimeObj,
  ] =
    useState(
      new Date()
    );

  // ======================================================
  // LOAD CART
  // ======================================================

  useEffect(
    () => {
      if (!items) {
        return;
      }

      try {
        const parsed =
          JSON.parse(
            items as string
          );

        if (
          Array.isArray(
            parsed
          )
        ) {
          setCart(
            parsed
          );
        } else {
          setCart(
            []
          );
        }
      } catch (
        error
      ) {
        console.log(
          "CART PARSE ERROR:",
          error
        );

        setCart(
          []
        );
      }
    },
    [items]
  );

  // ======================================================
  // LOAD USER + ADDRESS
  // ======================================================

  useFocusEffect(
    useCallback(
      () => {
        const loadUserAndAddress =
          async () => {
            try {
              const userString =
                await AsyncStorage.getItem(
                  "user"
                );

              if (
                !userString
              ) {
                return;
              }

              const user =
                JSON.parse(
                  userString
                );

              const uid =
                user.uid ||
                user.userId ||
                user.id;

              setBuyerName(
                user.fullName ||
                  user.name ||
                  ""
              );

              const q =
                query(
                  collection(
                    db,
                    "addresses"
                  ),

                  where(
                    "userId",
                    "==",
                    uid
                  ),

                  where(
                    "isDefault",
                    "==",
                    true
                  )
                );

              const snap =
                await getDocs(
                  q
                );

              if (
                !snap.empty
              ) {
                setAddress({
                  id:
                    snap
                      .docs[0]
                      .id,

                  ...snap
                    .docs[0]
                    .data(),
                });
              } else {
                setAddress(
                  null
                );
              }
            } catch (
              error
            ) {
              console.log(
                "LOAD USER ADDRESS ERROR:",
                error
              );
            }
          };

        loadUserAndAddress();
      },
      []
    )
  );

  // ======================================================
  // DATE
  // ======================================================

  const onDateChange =
    (
      event: any,
      selectedDate: any
    ) => {
      setShowDatePicker(
        false
      );

      if (
        selectedDate
      ) {
        setDateObj(
          selectedDate
        );

        setPickupDate(
          selectedDate.toLocaleDateString()
        );
      }
    };

  // ======================================================
  // TIME
  // ======================================================

  const onTimeChange =
    (
      event: any,
      selectedTime: any
    ) => {
      setShowTimePicker(
        false
      );

      if (
        selectedTime
      ) {
        setTimeObj(
          selectedTime
        );

        setPickupTime(
          selectedTime.toLocaleTimeString(
            [],
            {
              hour:
                "2-digit",

              minute:
                "2-digit",
            }
          )
        );
      }
    };

  // ======================================================
  // TOTAL
  // ======================================================

  const subTotal =
    cart.reduce(
      (
        sum,
        farm
      ) => {
        return (
          sum +
          farm.products.reduce(
            (
              pSum: number,
              p: any
            ) =>
              pSum +
              Number(
                p.price
              ) *
                Number(
                  p.quantity
                ),
            0
          )
        );
      },
      0
    );

  const activeFarmCount =
    cart.filter(
      (farm) =>
        Array.isArray(farm?.products) &&
        farm.products.length > 0
    ).length;

  const deliveryFee =
    delivery === "delivery"
      ? activeFarmCount * 35
      : 0;

  const total =
    subTotal +
    deliveryFee;

  // ======================================================
  // PLACE ORDER
  // ======================================================

  const placeOrder =
    async () => {
      if (!buyerId) {
        return Alert.alert(
          "Error",
          "Buyer not found."
        );
      }

      if (!buyerName) {
        return Alert.alert(
          "Error",
          "Buyer information is missing."
        );
      }

      if (delivery === "delivery" && !address) {
        return Alert.alert(
          "Error",
          "No delivery address selected."
        );
      }

      if (
        delivery === "pickup" &&
        (!pickupDate ||
          !pickupTime)
      ) {
        return Alert.alert(
          "Error",
          "Select pickup date and time."
        );
      }

      if (
        cart.length ===
        0
      ) {
        return Alert.alert(
          "Error",
          "No items to checkout."
        );
      }

      setLoading(true);

      const createdOrderIds:
        string[] = [];

      try {
        /*
         * IMPORTANT:
         * Checkout ONLY creates the order.
         *
         * No stock is deducted here.
         * No GCash payment is opened here.
         *
         * The farmer must accept first.
         */

        for (
          let farmIndex = 0;
          farmIndex <
          cart.length;
          farmIndex++
        ) {
          const farm =
            cart[
              farmIndex
            ];

          if (
            !farm?.products ||
            !Array.isArray(
              farm.products
            ) ||
            farm.products.length ===
              0
          ) {
            continue;
          }

          const farmTotal =
            farm.products.reduce(
              (
                sum: number,
                p: any
              ) =>
                sum +
                Number(
                  p.price || 0
                ) *
                  Number(
                    p.quantity || 0
                  ),
              0
            );

          const farmDeliveryFee =
            delivery ===
            "delivery"
              ? 35
              : 0;

          const farmOrderTotal =
            farmTotal +
            farmDeliveryFee;

          const products =
            farm.products.map(
              (p: any) => ({
                productId:
                  String(
                    p.productId ||
                    p.docId ||
                    ""
                  ),

                batchId:
                  null,

                batchNumber:
                  null,

                harvestRecordId:
                  null,

                contributions:
                  [],

                name:
                  p.name ||
                  "",

                image:
                  p.image ||
                  "",

                price:
                  Number(
                    p.price ||
                    0
                  ),

                quantity:
                  Number(
                    p.quantity ||
                    0
                  ),

                unit:
                  p.unit ||
                  "",

                reviewed:
                  false,
              })
            );

          const orderResult =
            await createOrder({
              buyerId:
                buyerId as string,

              buyerName:
                buyerName ||
                "",

              farmerId:
                farm.farmerId,

              farmName:
                farm.farmName,

              products,

              delivery,

              payment,

              paymentStatus:
                "pending",

              inventoryFulfilled:
                false,

              fulfillmentStatus:
                "pending",

              address:
                delivery === "delivery"
                  ? address
                  : null,

              pickupDate:
                delivery ===
                "pickup"
                  ? pickupDate
                  : null,

              pickupTime:
                delivery ===
                "pickup"
                  ? pickupTime
                  : null,

              subTotal:
                farmTotal,

              deliveryFee:
                farmDeliveryFee,

              total:
                farmOrderTotal,

              status:
                "pending",
            });

          createdOrderIds.push(
            orderResult.id
          );
        }

        if (
          createdOrderIds.length ===
          0
        ) {
          throw new Error(
            "No orders were created."
          );
        }

        // ==================================================
        // REMOVE CHECKED-OUT ITEMS FROM CART
        // ==================================================
        // Cart items are removed after all orders are created.
        // GCash is still pending at this point; the buyer will pay
        // only after the farmer accepts the order.
        const cartItemIds = cart
          .flatMap((farm: any) => farm.products || [])
          .map((product: any) => product.docId)
          .filter(Boolean) as string[];

        await Promise.all(
          cartItemIds.map((docId) =>
            removeCartItem(docId)
          )
        );

        // ==================================================
        // GO TO THANK YOU PAGE
        // ==================================================
        const goToThankYou = () => {
          router.replace({
            pathname: "/buyer/checkout/orderreceipt",
            params: {
              delivery,
              payment,
              subTotal: String(subTotal),
              deliveryFee: String(deliveryFee),
              total: String(total),
              pickupDate: pickupDate || "",
              pickupTime: pickupTime || "",
              orderIds: JSON.stringify(createdOrderIds),
              items: JSON.stringify(cart),
              address: JSON.stringify(
                delivery === "delivery" ? address : null
              ),
              orderStatus: "pending",
              paymentStatus: "pending",
            },
          });
        };

        if (payment === "gcash") {
          Alert.alert(
            "Order Submitted",
            "Your order has been sent to the farmer for approval. You do not need to pay yet. Once the farmer accepts the order, go to Orders and tap Pay with GCash to complete your payment.",
            [
              {
                text: "OK",
                onPress: goToThankYou,
              },
            ],
            { cancelable: false }
          );
        } else {
          goToThankYou();
        }
      } catch (
        error: any
      ) {
        console.log(
          "PLACE ORDER ERROR:",
          error
        );

        Alert.alert(
          "Order Error",
          error?.message ||
            "Something went wrong while creating your order."
        );
      } finally {
        setLoading(false);
      }
    };

  // ======================================================
  // EMPTY CART
  // ======================================================

  if (
    cart.length ===
    0
  ) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-8">
        <Ionicons
          name="cart-outline"
          size={48}
          color="#d1d5db"
        />

        <Text className="text-gray-400 font-semibold mt-3">
          No items to checkout
        </Text>
      </View>
    );
  }

  // ======================================================
  // UI
  // ======================================================

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor:
          "#fafafa",
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingBottom:
            140,
        }}
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}

        <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
          <TouchableOpacity
            onPress={() =>
              router.back()
            }
            disabled={
              loading
            }
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="white"
            />
          </TouchableOpacity>

          <Text className="text-white font-bold text-lg ml-4">
            Checkout
          </Text>
        </View>

        <View className="px-4">
          {/* DELIVERY / PICKUP DETAILS */}

          {delivery === "delivery" ? (
            <>
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-5 mb-2 mx-1">
                Delivery Address
              </Text>

              <View className="bg-white p-4 rounded-[10px]">
                {address ? (
                  <>
                    <Text className="font-bold text-base text-gray-900">
                      {address.fullName}
                    </Text>

                    <Text className="text-gray-600 text-sm mt-1">
                      {address.street}, {address.barangay}
                    </Text>

                    <Text className="text-gray-600 text-sm">
                      {address.city}, {address.province}
                    </Text>

                    <Text className="text-gray-600 text-sm mt-1">
                      {formatPhilippinePhoneNumber(address.phone)}
                    </Text>
                  </>
                ) : (
                  <Text className="text-red-500 text-sm">
                    No default address
                  </Text>
                )}

                <TouchableOpacity
                  onPress={() =>
                    router.push(
                      "/buyer/profile/address"
                    )
                  }
                  disabled={loading}
                  className="mt-3 bg-green-900 py-2.5 rounded-[5px] items-center"
                >
                  <Text className="text-white font-semibold text-sm">
                    Change Address
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-5 mb-2 mx-1">
                Pickup Details
              </Text>

              <View className="bg-blue-50 border border-blue-100 p-4 rounded-[10px]">
                <Text className="text-blue-900 font-bold text-base">
                  Pickup from the farmer's farm
                </Text>

                <Text className="text-gray-500 text-sm mt-3">
                  Pickup Date
                </Text>
                <Text className="text-gray-900 font-semibold mt-1">
                  {pickupDate || "Not set"}
                </Text>

                <Text className="text-gray-500 text-sm mt-3">
                  Pickup Time
                </Text>
                <Text className="text-gray-900 font-semibold mt-1">
                  {pickupTime || "Not set"}
                </Text>
              </View>
            </>
          )}

          {/* ITEMS */}

          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-8 mb-2 mx-1">
            Items
          </Text>

          {cart.map(
            (
              farm: any,
              farmIndex: number
            ) => (
              <View
                key={`farm-${farmIndex}-${farm.farmerId || farm.farmName}`}
                className="bg-white rounded-[10px] p-4 mb-3"
              >
                <Text className="font-bold text-base text-gray-900 mb-3">
                  {
                    farm.farmName
                  }
                </Text>

                {farm.products.map(
                  (
                    p: any,
                    productIndex: number
                  ) => (
                    <View
                      key={`${farmIndex}-${productIndex}-${p.productId || p.docId || "product"}`}
                      className={`flex-row items-center ${
                        productIndex <
                        farm.products.length -
                          1
                          ? "pb-3 mb-3 border-b border-gray-100"
                          : ""
                      }`}
                    >
                      <Image
                        source={{
                          uri:
                            p.image,
                        }}
                        className="w-16 h-16 rounded-lg"
                        resizeMode="cover"
                      />

                      <View className="flex-1 ml-3">
                        <Text
                          className="font-semibold text-sm text-gray-900"
                          numberOfLines={
                            1
                          }
                        >
                          {p.name}
                        </Text>

                        <Text className="text-green-900 font-bold mt-1">
                          ₱
                          {Number(
                            p.price
                          ).toFixed(
                            2
                          )}
                        </Text>

                        <Text className="text-gray-500 text-xs mt-0.5">
                          Qty:{" "}
                          {
                            p.quantity
                          }
                        </Text>
                      </View>

                      <Text className="font-bold text-gray-800">
                        ₱
                        {(
                          Number(
                            p.price
                          ) *
                          Number(
                            p.quantity
                          )
                        ).toFixed(
                          2
                        )}
                      </Text>
                    </View>
                  )
                )}
              </View>
            )
          )}

          {/* DELIVERY */}

          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-2 mb-2 mx-1">
            Delivery
          </Text>

          <TouchableOpacity
            onPress={() =>
              setDelivery(
                "pickup"
              )
            }
            disabled={
              loading
            }
            className={`flex-row items-center justify-between bg-white p-4 rounded-[5px] border ${
              delivery ===
              "pickup"
                ? "border-green-900"
                : "border-gray-200"
            }`}
          >
            <Text className="font-semibold text-sm text-gray-800">
              Farm Pickup
            </Text>

            <Ionicons
              name={
                delivery ===
                "pickup"
                  ? "radio-button-on"
                  : "radio-button-off"
              }
              size={20}
              color={
                delivery ===
                "pickup"
                  ? DARK_GREEN
                  : "#9ca3af"
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              setDelivery(
                "delivery"
              )
            }
            disabled={
              loading
            }
            className={`flex-row items-center justify-between bg-white p-4 mt-2 rounded-[5px] border ${
              delivery ===
              "delivery"
                ? "border-green-900"
                : "border-gray-200"
            }`}
          >
            <Text className="font-semibold text-sm text-gray-800">
              Delivery (+₱35)
            </Text>

            <Ionicons
              name={
                delivery ===
                "delivery"
                  ? "radio-button-on"
                  : "radio-button-off"
              }
              size={20}
              color={
                delivery ===
                "delivery"
                  ? DARK_GREEN
                  : "#9ca3af"
              }
            />
          </TouchableOpacity>

          {/* PICKUP */}

          {delivery ===
            "pickup" && (
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() =>
                  setShowDatePicker(
                    true
                  )
                }
                disabled={
                  loading
                }
                className="flex-1 bg-white rounded-[5px] p-4 border border-gray-200"
              >
                <View className="w-9 h-9 rounded-full bg-green-50 items-center justify-center mb-2">
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={
                      DARK_GREEN
                    }
                  />
                </View>

                <Text className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">
                  Date
                </Text>

                <Text
                  className={`text-sm font-semibold mt-0.5 ${
                    pickupDate
                      ? "text-gray-900"
                      : "text-gray-400"
                  }`}
                >
                  {pickupDate ||
                    "Select date"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setShowTimePicker(
                    true
                  )
                }
                disabled={
                  loading
                }
                className="flex-1 bg-white rounded-[5px] p-4 border border-gray-200"
              >
                <View className="w-9 h-9 rounded-full bg-green-50 items-center justify-center mb-2">
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={
                      DARK_GREEN
                    }
                  />
                </View>

                <Text className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">
                  Time
                </Text>

                <Text
                  className={`text-sm font-semibold mt-0.5 ${
                    pickupTime
                      ? "text-gray-900"
                      : "text-gray-400"
                  }`}
                >
                  {pickupTime ||
                    "Select time"}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={
                    dateObj
                  }
                  mode="date"
                  onChange={
                    onDateChange
                  }
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={
                    timeObj
                  }
                  mode="time"
                  onChange={
                    onTimeChange
                  }
                />
              )}
            </View>
          )}

          {/* PAYMENT */}

          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-5 mb-2 mx-1">
            Payment
          </Text>

          <View className="bg-white rounded-[5px] p-2">
            {/* GCASH */}

            <TouchableOpacity
              onPress={() =>
                setPayment(
                  "gcash"
                )
              }
              disabled={
                loading
              }
              className={`flex-row items-center justify-between p-3 rounded-[5px] ${
                payment ===
                "gcash"
                  ? "bg-green-50"
                  : ""
              }`}
            >
              <Text className="font-semibold text-sm text-gray-800">
                GCash
              </Text>

              <Ionicons
                name={
                  payment ===
                  "gcash"
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={20}
                color={
                  payment ===
                  "gcash"
                    ? DARK_GREEN
                    : "#9ca3af"
                }
              />
            </TouchableOpacity>

            <View className="h-px bg-gray-100 mx-1" />

            {/* COD */}

            <TouchableOpacity
              onPress={() =>
                setPayment(
                  "cod"
                )
              }
              disabled={
                loading
              }
              className={`flex-row items-center justify-between p-3 rounded-[5px] ${
                payment ===
                "cod"
                  ? "bg-green-50"
                  : ""
              }`}
            >
              <Text className="font-semibold text-sm text-gray-800">
                Cash on Delivery
              </Text>

              <Ionicons
                name={
                  payment ===
                  "cod"
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={20}
                color={
                  payment ===
                  "cod"
                    ? DARK_GREEN
                    : "#9ca3af"
                }
              />
            </TouchableOpacity>
          </View>

          {/* SUMMARY */}

          <View className="bg-green-50 rounded-[5px] p-4 mt-5">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-gray-600 text-sm">
                Subtotal
              </Text>

              <Text className="text-gray-800 text-sm">
                ₱
                {subTotal.toFixed(
                  2
                )}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-600 text-sm">
                Delivery Fee
              </Text>

              <Text className="text-gray-800 text-sm">
                ₱
                {deliveryFee.toFixed(
                  2
                )}
              </Text>
            </View>

            <View className="h-px bg-green-100 mb-3" />

            <View className="flex-row justify-between">
              <Text className="font-bold text-base text-gray-900">
                Total
              </Text>

              <Text className="font-black text-green-900 text-lg">
                ₱
                {total.toFixed(
                  2
                )}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* PLACE ORDER */}

      <View className="bg-white border-t border-gray-200 p-4">
        <TouchableOpacity
          onPress={
            placeOrder
          }
          disabled={
            loading
          }
          className={`bg-green-900 py-4 rounded-[5px] items-center justify-center ${
            loading
              ? "opacity-70"
              : ""
          }`}
        >
          {loading ? (
            <View className="flex-row items-center">
              <ActivityIndicator
                color="#fff"
              />

              <Text className="text-white font-bold ml-2">
                Processing...
              </Text>
            </View>
          ) : (
            <Text className="text-white text-center font-bold">
              {payment ===
              "gcash"
                ? "Place Order"
                : "Place Order"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}