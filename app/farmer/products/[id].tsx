import { useLocalSearchParams } from "expo-router";

import { ProductScreen } from "../(tabs)/product";

export default function FarmerProductBatches() {
  const { id, mode } = useLocalSearchParams<{
    id: string;
    mode?: string;
  }>();

  return (
    <ProductScreen
      detailProductId={id}
      initialViewMode={mode === "archived" ? "archived" : "active"}
    />
  );
}
