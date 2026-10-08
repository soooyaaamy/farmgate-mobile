import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../../../FirebaseConfig";

import {
  getBuyerOrders,
} from "@/src/services/orderService";

import {
  OrderType,
} from "@/src/types/order";

// Dark green used across the app
const DARK_GREEN = "#14532d";

const filters = [
  "All",
  "pending",
  "accepted",
  "processing",
  "to_receive",
  "delivered",
  "claimed",
  "cancelled",
];

export default function BuyerOrders() {

  const router =
    useRouter();

  const [orders, setOrders] =
    useState<OrderType[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [activeFilter, setActiveFilter] =
    useState("All");

  // Larawan ng bawat farm (keyed by farmerId) - ginagamit sa avatar
  // circle sa halip na paulit-ulit na unang letra lang.
  const [farmImages, setFarmImages] =
    useState<Record<string, string>>({});

  // ================= FORMAT DATE =================
  const formatOrderDate = (
    createdAt: any
  ) => {

    if (!createdAt) {
      return "Date unavailable";
    }

    try {

      let date: Date;

      if (
        typeof createdAt?.toDate ===
        "function"
      ) {

        date =
          createdAt.toDate();

      } else if (
        typeof createdAt?.seconds ===
        "number"
      ) {

        date =
          new Date(
            createdAt.seconds *
              1000
          );

      } else {

        date =
          new Date(createdAt);
      }

      if (
        isNaN(
          date.getTime()
        )
      ) {

        return "Date unavailable";
      }

      return date.toLocaleString(
        "en-PH",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }
      );

    } catch {

      return "Date unavailable";
    }
  };

  // ================= FETCH =================
  const fetchOrders =
    async () => {

      try {

        setLoading(true);

        const userStr =
          await AsyncStorage.getItem(
            "user"
          );

        const user =
          userStr
            ? JSON.parse(
                userStr
              )
            : null;

        if (!user) {

          setOrders([]);

          return;
        }

        const buyerId =
          user.uid ||
          user.userId ||
          user.id;

        if (!buyerId) {

          setOrders([]);

          return;
        }

        const data =
          await getBuyerOrders(
            buyerId
          );

        setOrders(data);

        // ================= FARM PROFILE IMAGES =================
        // Kunin ang profile image ng bawat natatanging farmer sa
        // listahan ng orders - ginagamit sa avatar circle sa halip
        // na paulit-ulit na unang letra lang.
        const uniqueFarmerIds =
          Array.from(
            new Set(
              data
                .map((o: any) => o.farmerId)
                .filter(Boolean)
            )
          );

        const imageEntries =
          await Promise.all(
            uniqueFarmerIds.map(
              async (farmerId: any) => {
                try {
                  const farmerDoc =
                    await getDoc(
                      doc(db, "users", farmerId)
                    );
                  return [
                    farmerId,
                    farmerDoc.exists()
                      ? farmerDoc.data().profileImage || ""
                      : "",
                  ] as const;
                } catch {
                  return [farmerId, ""] as const;
                }
              }
            )
          );

        setFarmImages(
          Object.fromEntries(imageEntries)
        );

      } catch (error) {

        console.log(
          "FETCH BUYER ORDERS ERROR:",
          error
        );

      } finally {

        setLoading(false);

      }
    };

  useEffect(() => {

    fetchOrders();

  }, []);

  useFocusEffect(
    useCallback(() => {

      fetchOrders();

    }, [])
  );

  // ================= FILTER =================
  const filteredOrders =
    activeFilter ===
      "All"
      ? orders
      : orders.filter(
          (o) =>
            o.status ===
            activeFilter
        );

  // ================= REVIEW COUNT =================
  const getUnreviewedCount = (
    order: OrderType
  ) => {

    if (
      order.status !==
        "delivered" &&
      order.status !==
        "claimed"
    ) {

      return 0;
    }

    return (
      order.products || []
    ).filter(
      (product) =>
        !product.reviewed
    ).length;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pending";
      case "accepted": return "Accepted";
      case "processing": return "Processing";
      case "to_receive": return "To Receive";
      case "delivered": return "Delivered";
      case "claimed": return "Claimed";
      case "cancelled": return "Cancelled";
      case "All": return "All";
      default: return status;
    }
  };

  // ================= STATUS COLOR =================
  const getStatusColor = (
    status: string
  ) => {

    switch (status) {

      case "pending":
        return {
          text: "#D97706",
          bg: "#FEF3C7",
        };

      case "accepted":
        return {
          text: "#1D4ED8",
          border: "#60A5FA",
          bg: "#DBEAFE",
        };

      case "processing":
        return {
          text: DARK_GREEN,
          border: DARK_GREEN,
          bg: "#DCFCE7",
        };

      case "to_receive":
        return {
          text: "#7C3AED",
          border: "#8B5CF6",
          bg: "#EDE9FE",
        };

      case "delivered":
        return {
          text: "#1D4ED8",
          border: "#2563EB",
          bg: "#DBEAFE",
        };

      case "claimed":
        return {
          text: "#14532d",
          border: "#86EFAC",
          bg: "#DCFCE7",
        };

      default:
        return {
          text: "#374151",
          border: "#9CA3AF",
          bg: "#F3F4F6",
        };
    }
  };

  // ================= LOADING =================
  if (loading) {

    return (
      <View className="flex-1 justify-center items-center bg-white">

        <ActivityIndicator
          size="large"
          color={DARK_GREEN}
        />

        <Text className="text-green-900 mt-3 font-semibold">
          Loading orders...
        </Text>

      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#fafafa" }}>

      {/* ================= HEADER ================= */}
      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          className="mr-4"
        >

          <Ionicons
            name="arrow-back"
            size={24}
            color="white"
          />

        </TouchableOpacity>

        <Text className="text-white font-bold text-lg">
          My Orders
        </Text>

      </View>

      {/* ================= BODY ================= */}
      <View className="flex-1 px-4">

        {/* ================= LIST (filters scroll away with it) ================= */}
        <FlatList
          data={
            filteredOrders
          }

          keyExtractor={(
            item,
            index
          ) =>
            item.id ||
            `order-${index}`
          }

          showsVerticalScrollIndicator={
            false
          }

          contentContainerStyle={{
            paddingBottom: 20,
            flexGrow:
              filteredOrders.length ===
              0
                ? 1
                : 0,
          }}

          ListHeaderComponent={
            <View className="mb-3 mt-4">

              <FlatList
                data={filters}
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                keyExtractor={(item) =>
                  item
                }
                contentContainerStyle={{
                  paddingRight: 20,
                  gap: 8,
                }}
                renderItem={({
                  item,
                }) => {

                  const isActive =
                    activeFilter ===
                    item;

                  return (
                    <TouchableOpacity
                      onPress={() =>
                        setActiveFilter(
                          item
                        )
                      }
                      className={`px-4 py-2 rounded-full ${
                        isActive
                          ? "bg-green-900"
                          : "bg-gray-100"
                      }`}
                    >

                      <Text
                        className={`font-semibold text-xs capitalize ${
                          isActive
                            ? "text-white"
                            : "text-gray-600"
                        }`}
                      >
                        {getStatusLabel(item)}
                      </Text>

                    </TouchableOpacity>
                  );
                }}
              />

            </View>
          }

          ListEmptyComponent={
            <View className="mt-24 items-center">

              <Ionicons
                name="receipt-outline"
                size={70}
                color="#D1D5DB"
              />

              <Text className="text-gray-500 mt-4 text-base">
                No orders found
              </Text>

            </View>
          }

          renderItem={({
            item,
          }) => {

            const statusColors =
              getStatusColor(
                item.status
              );

            const unreviewedCount =
              getUnreviewedCount(
                item
              );

            const farmImage =
              (item as any).farmerId
                ? farmImages[(item as any).farmerId]
                : "";

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (item.status === "pending") {
                    router.push({
                      pathname: "/buyer/checkout/orderreceipt",
                      params: {
                        orderIds: JSON.stringify([item.id || ""]),
                        from: "orders",
                      },
                    });
                    return;
                  }

                  router.push({
                    pathname: "/buyer/profile/order-details",
                    params: {
                      orderId: item.id || "",
                    },
                  });
                }}
                className="bg-white p-4 rounded-[10px] mb-3 border border-gray-100"
              >

                <View className="flex-row items-center">

                  {/* ================= FARM PFP ================= */}
                  <View className="w-14 h-14 rounded-full bg-green-900 justify-center items-center mr-4 overflow-hidden">

                    {farmImage ? (

                      <Image
                        source={{ uri: farmImage }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />

                    ) : (

                      <Text className="text-white font-bold text-lg">

                        {item.farmName
                          ?.charAt(0)
                          ?.toUpperCase() ||
                          "F"}

                      </Text>
                    )}

                  </View>

                  {/* ================= INFO ================= */}
                  <View className="flex-1">

                    {/* FARM NAME */}
                    <Text className="font-bold text-base text-gray-900">
                      {item.farmName ||
                        "Farm"}
                    </Text>

                    {/* DATE */}
                    <View className="flex-row items-center mt-1.5">

                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color="#6B7280"
                      />

                      <Text className="text-gray-500 text-xs ml-1">
                        {formatOrderDate(
                          item.createdAt
                        )}
                      </Text>

                    </View>

                    {/* TOTAL */}
                    <Text className="text-green-900 font-semibold text-sm mt-1.5">
                      ₱
                      {Number(
                        item.total
                      ).toFixed(2)}
                    </Text>

                    {item.status === "accepted" &&
                      item.payment === "gcash" &&
                      item.paymentStatus !== "paid" && (
                      <Text className="text-amber-600 text-xs font-semibold mt-1">
                        Awaiting GCash payment
                      </Text>
                    )}

                  </View>

                  {/* ================= RIGHT ================= */}
                  <View className="items-end ml-2">

                    {/* STATUS */}
                    <View className="px-3 py-1">

                      <Text
                        style={{
                          color:
                            statusColors.text,
                        }}
                        className="font-bold text-[11px]"
                      >
                        {getStatusLabel(item.status)}
                      </Text>

                    </View>

                    {/* RATE INDICATOR */}
                    {(item.status === "delivered" ||
                      item.status === "claimed") && (

                      <View className="mt-2">

                        {unreviewedCount >
                        0 ? (

                          <View className="bg-amber-500 px-3 py-1.5 rounded-[5px] flex-row items-center">

                            <Text className="text-white font-bold text-[10px]">
                              Rate Now
                            </Text>

                          </View>

                        ) : (

                          <View className="px-3 py-1.5 rounded-[5px] flex-row items-center">

                            <Ionicons
                              name="checkmark-circle"
                              size={15}
                              color={DARK_GREEN}
                            />

                            <Text className="text-green-900 font-semibold text-xs ml-1">
                              Reviewed
                            </Text>

                          </View>

                        )}

                      </View>
                    )}

                  </View>

                </View>

              </TouchableOpacity>
            );
          }}
        />

      </View>

    </View>
  );
}