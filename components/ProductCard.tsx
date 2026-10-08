import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ProductType } from "@/src/types/product";

const IMG_HEIGHT = 140;

type Props = {
  item: ProductType;
  salesCount?: number;
  salesLabel?: string;
};

// ================= PRODUCT CARD (shared) =================
// Used by Home's Top-selling section and Shop's browse grid - one
// card design so both screens stay visually consistent.
//
// Layout structure follows the reference: image on top, info row below
// split into a left column (name / farm / rating+sold) and a right
// column (price + unit). No "Fresh" badge - see the note in Home.tsx
// about why that was dropped app-wide.
//
// Tap-through only: opens Product Details, where quantity selection and
// Add to Cart already live (see buyer/products/[id].tsx).
export default function ProductCard({
  item,
  salesCount,
  salesLabel = "sold",
}: Props) {
  const router = useRouter();

  const stock = item.stock || 0;
  const outOfStock = stock <= 0;
  const hasRating = (item.totalReviews || 0) > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() =>
        router.push({ pathname: "/buyer/products/[id]", params: { id: item.docId } })
      }
      className="w-[48%] bg-white rounded-2xl mb-3 overflow-hidden border border-gray-100"
    >
      <View style={{ height: IMG_HEIGHT }}>
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 bg-green-50 items-center justify-center">
            <Ionicons name="leaf-outline" size={30} color="#86efac" />
          </View>
        )}

        {/* Out of stock reads as an image overlay rather than an extra
            text row, so the info block below always has the same shape. */}
        {outOfStock && (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <Text className="text-white font-bold text-xs">Out of stock</Text>
          </View>
        )}
      </View>

      <View className="flex-row px-2.5 py-2" style={{ minHeight: 72 }}>
        <View className="flex-1 pr-1.5">
          <Text
            className="text-gray-900 font-bold text-xs"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          <Text
            className="text-gray-400 text-[10px] mt-0.5"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.farmName}
          </Text>

          {/* Fixed-height row so cards line up whether or not a product
              has reviews yet. */}
          <View style={{ height: 14, marginTop: 3 }} className="flex-row items-center">
            {hasRating && (
              <>
                <Ionicons name="star" size={9} color="#f59e0b" />
                <Text className="text-[9px] text-gray-600 font-semibold ml-0.5">
                  {item.rating.toFixed(1)}
                </Text>
                <Text className="text-[9px] text-gray-300 mx-1">·</Text>
              </>
            )}
            <Text className="text-[9px] text-gray-400">
              {salesCount ?? item.totalSales ?? 0} {salesLabel}
            </Text>
          </View>
        </View>

        <View className="items-end justify-start pt-0.5">
          <Text className="text-green-900 font-black text-xs">
            ₱{Number(item.price).toFixed(2)}
          </Text>
          <Text className="text-gray-400 text-[9px] mt-0.5">/{item.unit}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}