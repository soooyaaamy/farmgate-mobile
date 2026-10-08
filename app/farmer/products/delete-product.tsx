// farmer/products/delete-product.tsx
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { ProductType } from "../../../src/types/product";

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  product?: ProductType | null;
};

// ================= ARCHIVE PRODUCT CONFIRMATION =================
// Dating "Delete Product" - "Archive" na ito ngayon: hindi na tunay na
// binubura ang produkto, image, o harvest/order history nito. Naka-hide
// lang ito sa listing/homepage/FIFO selling, at puwede pa itong
// ma-unarchive sa hinaharap kung kinakailangan.
const DeleteProductModal = ({ visible, onCancel, onConfirm, loading, product }: Props) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full max-w-[360px] rounded-[10px] bg-white p-5">
          <View className="mb-3 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-[10px] bg-amber-50">
              <Ionicons name="archive-outline" size={20} color="#b45309" />
            </View>
            <Text className="flex-1 text-lg font-bold text-gray-900">
              Archive product?
            </Text>
          </View>

          <Text className="mb-2 text-sm font-semibold text-gray-800">
            {product?.name || "This product"}
          </Text>

          <Text className="mb-6 text-sm leading-5 text-gray-600">
            I-a-archive ang{" "}
            <Text className="font-bold text-gray-700">
              {product?.name}
            </Text>
            . Hindi ito makikita sa iyong listing at sa mga buyer, pero
            mananatili ang lahat ng datos nito (harvest history, orders,
            reviews). Puwede mo pa itong ma-unarchive sa hinaharap.
          </Text>

          {/* BUTTONS */}
          <View className="flex-row">
            <TouchableOpacity
              onPress={onCancel}
              className="mr-2 flex-1 items-center rounded-[10px] border border-gray-300 py-3"
            >
              <Text className="font-semibold text-gray-700">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              className="ml-2 flex-1 items-center rounded-[10px] py-3"
              style={{ backgroundColor: "#dc2626" }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-bold text-white">Archive</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DeleteProductModal;