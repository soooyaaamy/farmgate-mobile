import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

// "label" = Tagalog, shown to the buyer.
// "value" = English, MUST match constants/productCatalog.ts's CATEGORIES
// exactly, since that's what actually gets written to Firestore's
// product.category field via the farmer's Add Product form.
export const CATEGORIES = [
  { label: "All", value: "All", icon: "view-grid-outline" },
  { label: "Gulay", value: "Vegetables", icon: "carrot" },
  { label: "Prutas", value: "Fruits", icon: "fruit-cherries" },
  { label: "Itlog", value: "Egg & Poultry", icon: "egg-outline" },
  { label: "Bigas", value: "Rice & Grains", icon: "rice" },
];

interface Props {
  activeCategory: string;
  onSelectCategory: (value: string) => void;
}

export default function Category_Buyer({ activeCategory, onSelectCategory }: Props) {
  return (
    <FlatList
      data={CATEGORIES}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.value}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 16 }}
      renderItem={({ item: cat }) => {
        const active = activeCategory === cat.value;
        return (
          <TouchableOpacity
            onPress={() => onSelectCategory(cat.value)}
            className="items-center gap-1"
            style={{ width: 68 }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? "#14532d" : "transparent",
                borderWidth: 1,
                borderColor: active ? "#14532d" : "transparent",
              }}
            >
              <MaterialCommunityIcons
                name={cat.icon as any}
                size={19}
                color={active ? "white" : "#6b7280"}
              />
            </View>
            <Text
              className={`text-[10px] text-center ${
                active ? "text-green-900 font-bold" : "text-gray-500 font-medium"
              }`}
              numberOfLines={1}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}