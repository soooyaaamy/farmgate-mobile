import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../FirebaseConfig";
import { checkSavedFarm, saveFarm, unsaveFarm } from "@/src/services/savedFarmService";
import { getFarmerProductNames } from "@/src/services/productService";
import ProductCard from "@/components/ProductCard";
import { ProductType } from "@/src/types/product";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STATUS_BAR = Constants.statusBarHeight ?? 44;
const DARK_GREEN = "#14532d";

// NOTE: icon names below use Ionicons (matching the old version's icon
// set) instead of MaterialCommunityIcons.
const SORT_OPTIONS = [
  { label: "Relevance", icon: "options-outline" },
  { label: "Highest Rated", icon: "star-outline" },
  { label: "Best Selling", icon: "flame-outline" },
];

const CATEGORY_OPTIONS = ["All", "Vegetables", "Fruits", "Egg & Poultry", "Rice & Grains"];

const FarmProfile = () => {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId: string }>();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [farmerUser, setFarmerUser] = useState<any>(null);
  const [buyerId, setBuyerId] = useState("");
  const [isFavorited, setIsFavorited] = useState(false);

  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Relevance");
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const sortButtonRef = useRef<View>(null);

  // Measures the trigger button's actual on-screen position so the
  // dropdown (rendered in a Modal, outside the FlatList entirely) can
  // be placed right under it — this sidesteps zIndex/elevation fights
  // with the product grid below.
  const openSortDropdown = () => {
    sortButtonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      setDropdownPos({
        top: y + height + 6,
        right: screenWidth - (x + width),
      });
      setSortDropdownVisible(true);
    });
  };

  // Derived from the farmer's own products (source of truth per ProductType)
  const farmName = products[0]?.farmName || "Farm";
  const farmerName = products[0]?.farmerName || farmerUser?.fullName || "";

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (!farmerId) return;

        const items = await getFarmerProductNames(farmerId, false);
        setProducts(items);

        // profileImage confirmed elsewhere in the app (users collection)
        const farmerDoc = await getDoc(doc(db, "users", farmerId));
        if (farmerDoc.exists()) {
          setFarmerUser(farmerDoc.data());
        }

        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          const uid = user.uid || user.userId || user.id;
          setBuyerId(uid);
          const saved = await checkSavedFarm(uid, farmerId);
          setIsFavorited(saved);
        }
      } catch (e) {
        console.log("LOAD FARM PROFILE ERROR:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [farmerId]);

  const toggleFavorite = async () => {
    if (!buyerId || !farmerId) return;
    try {
      if (isFavorited) {
        await unsaveFarm(buyerId, farmerId);
        setIsFavorited(false);
      } else {
        // Field names confirmed via savedFarmService.ts + home.tsx's
        // "Saved Farms" display: farmName, coverPhoto, municipality, province
        await saveFarm({
          buyerId,
          farmerId,
          farmName: farmName,
          coverPhoto: farmerUser?.coverPhoto || "",
          municipality: farmerUser?.municipality || "",
          province: farmerUser?.province || "",
        });
        setIsFavorited(true);
      }
    } catch (e) {
      console.log("TOGGLE FAVORITE ERROR:", e);
    }
  };

  const filteredProducts = products
    .filter((p) => activeCategory === "All" || p.category === activeCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case "Highest Rated":
          return (b.rating || 0) - (a.rating || 0);
        case "Best Selling":
          return (b.totalSales || 0) - (a.totalSales || 0);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color={DARK_GREEN} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item, index) => item.docId ?? index.toString()}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 14 }}
        ListHeaderComponent={
          <>
            {/* Cover Photo */}
            <View style={{ height: 200, position: "relative" }}>
              {farmerUser?.coverPhoto ? (
                <Image source={{ uri: farmerUser.coverPhoto }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <View style={{ width: "100%", height: "100%", backgroundColor: "#f0fdf4" }} />
              )}
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.15)" }} />

              {/* Back button */}
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  position: "absolute", top: STATUS_BAR + 8, left: 16,
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: "rgba(255,255,255,0.88)",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Ionicons name="arrow-back" size={20} color={DARK_GREEN} />
              </TouchableOpacity>
            </View>

            {/* White Body */}
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, padding: 18 }}>

              {/* Farm name + actions */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827", lineHeight: 24 }}>
                    {farmName}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Ionicons name="location" size={13} color={DARK_GREEN} />
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>
                      {[
                        farmerUser?.street,
                        farmerUser?.barangay,
                        farmerUser?.municipality,
                        farmerUser?.province,
                      ].filter(Boolean).join(", ") || "Location not set"}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/buyer/messages/ChatScreen",
                        params: {
                          farmerId,
                          farmerName: farmerName,
                          farmerProfileImage: farmerUser?.profileImage || "",
                        },
                      })
                    }
                    style={{
                      width: 38, height: 38, borderRadius: 20,
                      backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#dcfce7",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={17} color="#15803d" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={toggleFavorite}
                    style={{
                      width: 38, height: 38, borderRadius: 20,
                      backgroundColor: isFavorited ? "#fff1f2" : "#f9fafb",
                      borderWidth: 1, borderColor: isFavorited ? "#ffe4e6" : "#f3f4f6",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={isFavorited ? "heart" : "heart-outline"}
                      size={17}
                      color={isFavorited ? "#ef4444" : "#9ca3af"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: "#f3f4f6", marginBottom: 14 }} />

              {/* About Farm — shown only when the farmer has set a description */}
              {farmerUser?.about ? (
                <>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 6 }}>
                    About Farm
                  </Text>
                  <Text style={{ fontSize: 13, color: "#6b7280", lineHeight: 20, marginBottom: 14 }}>
                    {farmerUser.about}
                  </Text>
                </>
              ) : null}

              {/* Farmer card */}
              <View style={{
                backgroundColor: "#f9fafb", borderRadius: 5, padding: 12,
                flexDirection: "row", alignItems: "center",
                justifyContent: "space-between", marginBottom: 16,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: "#f0fdf4" }}>
                    {farmerUser?.profileImage ? (
                      <Image source={{ uri: farmerUser.profileImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="person" size={20} color={DARK_GREEN} />
                      </View>
                    )}
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: "#9ca3af", fontWeight: "600" }}>Farmer</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
                      {farmerName || "—"}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 11, fontWeight: "700", color: DARK_GREEN }}>Owner</Text>
              </View>
              
              <View style={{ height: 1, backgroundColor: "#f3f4f6", marginBottom: 14 }} />

              {/* "Our Products" + Sort By, same row */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
                  Our Products
                </Text>

                <TouchableOpacity
                  ref={sortButtonRef}
                  onPress={() => (sortDropdownVisible ? setSortDropdownVisible(false) : openSortDropdown())}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                  }}
                >
                  <Ionicons name="swap-vertical" size={14} color="#6b7280" />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#6b7280", marginLeft: 4 }}>
                    Sort: {sortBy}
                  </Text>
                  <Ionicons
                    name={sortDropdownVisible ? "chevron-up" : "chevron-down"}
                    size={12}
                    color="#6b7280"
                    style={{ marginLeft: 2 }}
                  />
                </TouchableOpacity>
              </View>

              {/* CATEGORY FILTER */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = activeCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setActiveCategory(cat)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                        backgroundColor: active ? DARK_GREEN : "#f3f4f6",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "white" : "#6b7280" }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🌿</Text>
            <Text style={{ color: "#6b7280", fontWeight: "600" }}>No products yet</Text>
          </View>
        }
        renderItem={({ item }) => <ProductCard item={item} />}
      />

      {/* SORT DROPDOWN — rendered in a Modal so it always sits above
          everything (including the product grid) regardless of
          FlatList stacking/zIndex quirks, and gets tap-outside-to-close
          for free. */}
      <Modal
        visible={sortDropdownVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSortDropdownVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1 }}
          onPress={() => setSortDropdownVisible(false)}
        >
          <View
            style={{
              position: "absolute",
              top: dropdownPos.top,
              right: dropdownPos.right,
              width: 180,
              backgroundColor: "white", borderRadius: 14, paddingVertical: 6,
              borderWidth: 1, borderColor: DARK_GREEN,
              shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12, shadowRadius: 10, elevation: 8,
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.label;
              return (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => {
                    setSortBy(opt.label);
                    setSortDropdownVisible(false);
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingVertical: 10, paddingHorizontal: 14,
                    backgroundColor: active ? "#f0fdf4" : "transparent",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name={opt.icon as any} size={16} color={active ? DARK_GREEN : "#6b7280"} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: active ? DARK_GREEN : "#374151" }}>
                      {opt.label}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={16} color={DARK_GREEN} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default FarmProfile;