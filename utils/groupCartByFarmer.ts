import { CartItem } from "../src/types/cart";

export type FarmerCart = {
  farmerId: string;
  farmName: string;
  products: CartItem[];
};

export const groupCartByFarmer = (items: CartItem[]): FarmerCart[] => {
  const grouped: FarmerCart[] = [];

  items.forEach((item) => {
    const existing = grouped.find(
      (f) => f.farmerId === item.farmerId
    );

    if (existing) {
      existing.products.push(item);
    } else {
      grouped.push({
        farmerId: item.farmerId || "",
        farmName: item.farmName || "",
        products: [item],
      });
    }
  });

  return grouped;
};