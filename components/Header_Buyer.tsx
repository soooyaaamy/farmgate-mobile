import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

interface Props {
  // Search ay optional na: lalabas lang kung may ipinasa na onSearchChange.
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  placeholder?: string;
  // Notification bell: lalabas lang kung may ipinasa na onNotificationPress.
  notificationCount?: number;
  onNotificationPress?: () => void;
}

export default function Header_Buyer({
  searchQuery = "",
  onSearchChange,
  placeholder = "Search vegetables, fruits…",
  notificationCount = 0,
  onNotificationPress,
}: Props) {
  const router = useRouter();

  return (
    <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl mb-1">
      <View className="flex-row items-center gap-2.5">
        {onSearchChange ? (
          <View className="flex-1 flex-row items-center bg-white rounded-xl px-3 py-1.5 gap-2">
            <MaterialCommunityIcons name="magnify" size={16} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              className="flex-1 text-gray-900 text-sm"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange("")}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Walang search: itulak pakanan ang mga icon.
          <View className="flex-1" />
        )}

        {onNotificationPress && (
          <TouchableOpacity
            onPress={onNotificationPress}
            activeOpacity={0.85}
            className="p-1.5"
          >
            <Ionicons name="notifications-outline" size={25} color="white" />
            {notificationCount > 0 && (
              <View className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center">
                <Text className="text-white text-[10px] font-bold">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.push("/buyer/cart")}
          activeOpacity={0.85}
          className="p-1.5"
        >
          <MaterialCommunityIcons name="cart-outline" size={25} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}