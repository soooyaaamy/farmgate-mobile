import React, { createContext, useContext, useState } from "react";

type CartItem = {
  id: string;
  name: string;
  image: any;
  price: number;
  quantity: number;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(
  undefined
);

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);

  /* ---------- ADD TO CART ---------- */
  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (p) => p.id === item.id
      );

      // If item already exists → increase quantity
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity:
            updated[existingIndex].quantity +
            item.quantity,
        };
        return updated;
      }

      // Otherwise add new item
      return [...prev, item];
    });
  };

  /* ---------- UPDATE QUANTITY ---------- */
  const updateQty = (id: string, qty: number) => {
    setCart((prev) => {
      // Remove item if quantity is 0 or less
      if (qty <= 0) {
        return prev.filter((p) => p.id !== id);
      }

      return prev.map((p) =>
        p.id === id ? { ...p, quantity: qty } : p
      );
    });
  };

  /* ---------- REMOVE ITEM ---------- */
  const removeItem = (id: string) => {
    setCart((prev) =>
      prev.filter((p) => p.id !== id)
    );
  };

  /* ---------- CLEAR CART ---------- */
  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQty,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/* ---------- CUSTOM HOOK ---------- */
export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used within a CartProvider"
    );
  }

  return context;
};