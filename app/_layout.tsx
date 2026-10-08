import { CartProvider } from "@/context/CartContext";
import { Stack } from "expo-router";
import "./global.css";
import { ToastProvider } from "@/context/ToastContext";
import { FarmerAlertProvider } from "@/context/FarmerAlertContext";

export default function RootLayout() {
  return (
    <ToastProvider>
      <FarmerAlertProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register"/>
            <Stack.Screen name="buyer/(tabs)" />
            <Stack.Screen name="farmer/(tabs)" />
            <Stack.Screen name="farmer/products/[id]" />
            <Stack.Screen name="farmer/products/top-selling" />
            <Stack.Screen name="products/[id]" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="buyer/cart/myCart" />
          </Stack>
        </CartProvider>
      </FarmerAlertProvider>
    </ToastProvider>
  );
}
