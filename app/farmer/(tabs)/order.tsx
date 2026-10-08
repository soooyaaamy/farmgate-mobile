import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useFocusEffect,
  useLocalSearchParams,
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
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  getFarmerOrders,
} from "@/src/services/orderService";

import {
  OrderType,
} from "@/src/types/order";

const filters = [
  "All",
  "to_pay",
  "pending",
  "accepted",
  "processing",
  "to_receive",
  "delivered",
  "claimed",
  "cancelled",
];

export default function Orders() {

  const router =
    useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();

  const [orders, setOrders] =
    useState<OrderType[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [activeFilter, setActiveFilter] =
    useState("All");

  useEffect(() => {
    if (filter && filters.includes(filter)) {
      setActiveFilter(filter);
    }
  }, [filter]);

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

        const farmerId =
          user.uid ||
          user.userId ||
          user.id;

        if (!farmerId) {

          setOrders([]);

          return;
        }

        const data =
          await getFarmerOrders(
            farmerId
          );

        setOrders(data);

      } catch (error) {

        console.log(
          "FETCH FARMER ORDERS ERROR:",
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
          (o) => activeFilter === "to_pay"
            ? o.payment === "gcash" && o.paymentStatus === "pending"
            : o.status === activeFilter
        );

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
      case "to_pay": return "To pay";
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
          border: "#FACC15",
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
          text: "#14532d",
          border: "#bbf7d0",
          bg: "#f0fdf4",
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

      case "cancelled":
        return {
          text: "#374151",
          border: "#6B7280",
          bg: "#E5E7EB",
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
      <View className="flex-1 items-center justify-center bg-[#f5f5f5]">

        <ActivityIndicator
          size="large"
          color="#14532d"
        />

        <Text className="mt-3 font-semibold text-gray-600">
          Loading orders...
        </Text>

      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f5f5f5]">

      {/* ================= HEADER ================= */}
      <View className="bg-[#14532d] px-5 pb-5 pt-14">

        <Text className="text-2xl font-bold text-white">
          Orders
        </Text>

      </View>

      {/* ================= BODY ================= */}
      <View className="flex-1 px-4 pt-4">

        {/* ================= FILTERS ================= */}
        <View className="mb-3">

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
                  className={`mr-2 items-center justify-center rounded-full border px-4 py-2.5 ${
                    isActive
                      ? "border-[#14532d] bg-[#14532d]"
                      : "border-gray-200 bg-white"
                  }`}
                  style={{
                    minWidth: 82,
                  }}
                >

                  <Text
                    className={`text-sm font-semibold ${
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

        {/* ================= LIST ================= */}
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
            paddingTop: 4,
            paddingBottom: 112,
            flexGrow:
              filteredOrders.length ===
              0
                ? 1
                : 0,
          }}

          ListEmptyComponent={
            <View className="mt-24 items-center">

              <Ionicons
                name="receipt-outline"
                size={54}
                color="#D1D5DB"
              />

              <Text className="mt-4 text-sm text-gray-500">
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

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname:
                      "/farmer/orders/[id]",
                    params: {
                      id:
                        item.id ||
                        "",
                    },
                  })
                }
                className="mb-3 rounded-[10px] border border-gray-100 bg-white p-4"
              >

                <View className="flex-row items-center justify-between">
                  <View className="mr-3 flex-1">
                    <Text
                      className="text-base font-bold text-gray-900"
                      numberOfLines={1}
                    >
                      {item.buyerName || "Buyer"}
                    </Text>
                    <Text
                      className="mt-1 text-xs font-semibold text-gray-500"
                      numberOfLines={1}
                    >
                      {item.products
                        ?.map((product) => product.name)
                        .filter(Boolean)
                        .join(", ") || "No items"}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: statusColors.bg,
                      borderColor: statusColors.border,
                    }}
                    className="items-center rounded-full border px-3 py-1"
                  >
                    <Text
                      style={{ color: statusColors.text }}
                      className="text-xs font-semibold"
                    >
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <Text className="mt-2 text-right text-sm font-semibold text-[#14532d]">
                  ₱{Number(item.total).toFixed(2)}
                </Text>

              </TouchableOpacity>
            );
          }}
        />

      </View>

    </View>
  );
}