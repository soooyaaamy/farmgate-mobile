import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../FirebaseConfig";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { useToast } from "../../../context/ToastContext";
import { addToCart } from "@/src/services/cartService";
import {
  getProductById,
  getBatchesByProduct,
  getReviewsByProduct,
} from "@/src/services/productService";
import { ProductType, BatchType, ReviewType } from "@/src/types/product";

const DARK_GREEN = "#14532d";
const DESCRIPTION_PREVIEW_LENGTH = 180;

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function ProductDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { showToast } = useToast();

  const [product, setProduct] = useState<ProductType | null>(null);
  const [batches, setBatches] = useState<BatchType[]>([]);
  const [reviews, setReviews] = useState<ReviewType[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyerId, setBuyerId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"cart" | "buynow">("cart");
  const [farmerProfileImage, setFarmerProfileImage] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const videoPlayer = useVideoPlayer(product?.video ?? null, (player) => {
    player.loop = false;
  });
  const { isPlaying: isProductVideoPlaying } = useEvent(
    videoPlayer,
    "playingChange",
    { isPlaying: videoPlayer.playing }
  );

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProduct();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const data = await AsyncStorage.getItem("user");
      if (!data) return;
      const user = JSON.parse(data);
      setBuyerId(user.uid || user.userId || user.id || "");
      setBuyerName(user.fullName || user.name || "");
    } catch (e) {
      console.log(e);
    }
  };

  const loadProduct = async () => {
    try {
      if (!id) return;
      const data = await getProductById(String(id));
      setProduct(data);

      if (data) {
        const [batchData, reviewData, farmerDoc] = await Promise.all([
          getBatchesByProduct(data.docId),
          getReviewsByProduct(data.docId),
          getDoc(doc(db, "users", data.farmerId)),
        ]);
        setBatches(batchData);

        // Older reviews may use different identity/image field names. Resolve
        // their avatar from the matching user document as a display fallback.
        const profileImageByBuyerId = new Map<string, string>();
        const reviewsWithProfiles = await Promise.all(
          reviewData.map(async (review) => {
            const legacyReview = review as ReviewType & {
              profileImage?: string;
              uid?: string;
              userId?: string;
            };
            const buyerKey =
              legacyReview.buyerId ||
              legacyReview.userId ||
              legacyReview.uid ||
              "";
            const directImage =
              legacyReview.buyerProfileImage ||
              legacyReview.profileImage ||
              "";

            if (directImage || !buyerKey) return review;
            if (profileImageByBuyerId.has(buyerKey)) {
              return {
                ...review,
                buyerProfileImage: profileImageByBuyerId.get(buyerKey) || "",
              };
            }

            try {
              let buyerData: Record<string, any> | null = null;
              const buyerDoc = await getDoc(doc(db, "users", buyerKey));
              if (buyerDoc.exists()) {
                buyerData = buyerDoc.data();
              } else {
                const userSnapshot = await getDocs(
                  query(collection(db, "users"), where("uid", "==", buyerKey))
                );
                buyerData = userSnapshot.docs[0]?.data() || null;
              }

              if (!buyerData && legacyReview.buyerName) {
                const userSnapshot = await getDocs(
                  query(
                    collection(db, "users"),
                    where("fullName", "==", legacyReview.buyerName)
                  )
                );
                buyerData = userSnapshot.docs[0]?.data() || null;
              }

              const profileImage = buyerData?.profileImage || "";
              profileImageByBuyerId.set(buyerKey, profileImage);
              if (profileImage) {
                await updateDoc(doc(db, "reviews", review.docId), {
                  buyerProfileImage: profileImage,
                });
              }
              return { ...review, buyerProfileImage: profileImage };
            } catch {
              profileImageByBuyerId.set(buyerKey, "");
              return review;
            }
          })
        );

        setReviews(reviewsWithProfiles);
        if (farmerDoc.exists()) {
          setFarmerProfileImage(farmerDoc.data().profileImage || "");
        }
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  // ================= SELLABLE BATCHES (FIFO order) =================
  // Lahat ng batch na may stock pa at "Available" ang status, pagkakasunod-
  // sunod mula sa pinakamatanda (unang ibebenta) - ito rin ang eksaktong
  // pagkakasunod na sinusunod ng recordSale() sa checkout.
  const sellableBatches = useMemo(
    () =>
      batches
        .filter((b) => b.stock > 0 && b.status === "Available")
        .sort((a, b) => a.batchNumber - b.batchNumber),
    [batches]
  );

  // "currentBatch" = ang unang ibebenta (FIFO) - dito galing ang presyo at
  // freshness label na ipinapakita, dahil ito talaga ang unang mauubos.
  const currentBatch = sellableBatches[0] || null;

  // ================= AGGREGATE STOCK (para sa quantity limit) =================
  // MAHALAGA: ang totoong pwedeng i-order ay ang KABUUAN ng stock sa LAHAT
  // ng sellable batch, HINDI lang ang stock ng currentBatch - dahil kaya
  // namang kumuha ng recordSale() sa susunod na batch kapag naubos na ang
  // una (FIFO spillover). Kung ang increment (+) button ay naka-limit lang
  // sa currentBatch.stock, hindi makakapag-order ang buyer ng mas malaki
  // kahit sapat naman ang TOTAL na stock kasama ang susunod na batch.
  const totalAvailableStock = useMemo(
    () => sellableBatches.reduce((sum, b) => sum + b.stock, 0),
    [sellableBatches]
  );

  // ================= REVIEW FILTER (All / per-batch) =================
  // "all" = lahat ng review ng product. Kapag pinili ang isang specific
  // na batchNumber, puro reviews LANG ng batch na yun ang makikita -
  // ex. "Batch 002" ay ipapakita LANG ang mga reviews na naka-link sa
  // batchId ng Batch 002, hindi kasama ang sa ibang batch.
  const [reviewFilter, setReviewFilter] = useState<number | "all">("all");

  // Listahan ng mga batch number na may kahit isang review, pinaka-bago
  // muna (descending) - ginagamit para sa mga filter chip.
  const reviewedBatchNumbers = useMemo(() => {
    const unique = Array.from(new Set(reviews.map((r) => r.batchNumber)));
    return unique.sort((a, b) => b - a);
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (reviewFilter === "all") return reviews;
    return reviews.filter((r) => r.batchNumber === reviewFilter);
  }, [reviews, reviewFilter]);

  const avgRating = product?.rating || 0;
  const totalReviews = product?.totalReviews || 0;

  // ================= RATING BREAKDOWN (Play Store style bars) =================
  // Computed from the real reviews array (not filteredReviews) so it
  // stays consistent with avgRating/totalReviews above, which are also
  // unfiltered, product-level aggregates.
  const ratingDistribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1-star ... index 4 = 5-star
    reviews.forEach((r) => {
      const rounded = Math.round(r.rating);
      if (rounded >= 1 && rounded <= 5) counts[rounded - 1]++;
    });
    const total = reviews.length;
    return [5, 4, 3, 2, 1].map((star) => {
      const count = counts[star - 1];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { star, count, pct };
    });
  }, [reviews]);

  // ── LOADING ──
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color={DARK_GREEN} />
        <Text className="mt-3 text-green-900 font-semibold text-sm">Loading product…</Text>
      </View>
    );
  }

  // ── NOT FOUND ──
  if (!product) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-8">
        <Text className="text-5xl mb-4">🌿</Text>
        <Text className="text-gray-700 font-bold text-lg">Product not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-green-900 px-6 py-3 rounded-2xl">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const productImages = product.images?.length
    ? product.images
    : product.video
      ? []
      : product.image
        ? [product.image]
        : [];
  const productMedia = [
    ...productImages.map((uri) => ({ type: "image" as const, uri })),
    ...(product.video
      ? [{ type: "video" as const, uri: product.video }]
      : []),
  ];
  const selectedMedia = productMedia[selectedMediaIndex] || productMedia[0];

  const openModal = (mode: "cart" | "buynow") => {
    if (!currentBatch) {
      showToast("This product is currently unavailable.");
      return;
    }
    setModalMode(mode);
    setQuantity(1);
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setModalVisible(false));
  };

  const handleAddToCart = async () => {
    if (!product?.docId || !currentBatch) return;
    if (!buyerId) {
      showToast("Please log in to add items to your cart.");
      return;
    }
    try {
      await addToCart({
        productId: product.docId,
        // Ang batchId dito ay INFORMATIONAL/price-reference lang sa
        // add-to-cart time. Sa checkout, laging kukunin ng recordSale()
        // ang totoong FIFO batch(es) sa mismong oras ng pag-order - kaya
        // hindi problema kahit may pagitan ng oras.
        batchId: currentBatch.docId,
        batchNumber: currentBatch.batchNumber,
        buyerId,
        buyerName,
        farmerId: product.farmerId,
        farmName: product.farmName,
        name: product.name,
        image: product.image,
        price: currentBatch.price,
        quantity,
        unit: product.unit,
        createdAt: Date.now(),
      });
      showToast(`${product.name} added to cart!`);
      closeModal();
    } catch {
      showToast("Failed to add to cart. Please try again.");
    }
  };

  const handleBuyNow = () => {
    if (!product || !currentBatch) return;
    closeModal();
    router.push({
      pathname: "/buyer/checkout",
      params: {
        items: JSON.stringify([{
          farmName: product.farmName,
          farmerId: product.farmerId,
          products: [{
            productId: product.docId,
            batchId: currentBatch.docId,
            batchNumber: currentBatch.batchNumber,
            name: product.name,
            price: currentBatch.price,
            image: product.image,
            quantity,
            unit: product.unit,
          }],
        }]),
        buyerId,
      },
    });
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      {/* ── PRODUCT DETAILS AND REVIEWS ── */}
      <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── PRODUCT MEDIA ── */}
          <View
            className="w-full aspect-square bg-[#f0fdf4]"
            style={{ marginHorizontal: -20, marginTop: -20, marginBottom: 20, width: "auto" }}
          >
            {selectedMedia?.type === "video" ? (
              <>
                <VideoView
                  player={videoPlayer}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  nativeControls={false}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    isProductVideoPlaying
                      ? "Pause product video"
                      : "Play product video"
                  }
                  onPress={() =>
                    isProductVideoPlaying
                      ? videoPlayer.pause()
                      : videoPlayer.play()
                  }
                  className="absolute inset-0 items-center justify-center"
                >
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-black/50">
                    <Ionicons
                      name={isProductVideoPlaying ? "pause" : "play"}
                      size={28}
                      color="white"
                    />
                  </View>
                </TouchableOpacity>
              </>
            ) : selectedMedia?.uri ? (
              <Image
                source={{ uri: selectedMedia.uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="leaf-outline" size={64} color="#86efac" />
              </View>
            )}

            <LinearGradient
              colors={["rgba(0,0,0,0.35)", "transparent"]}
              className="absolute top-0 left-0 right-0 h-36"
            />

            <TouchableOpacity
              onPress={() => router.back()}
              className="absolute top-14 left-4 bg-white/90 p-2.5 rounded-[10px]"
              style={{ elevation: 3 }}
            >
              <Ionicons name="arrow-back" size={20} color={DARK_GREEN} />
            </TouchableOpacity>
          </View>

          {productMedia.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-5"
            >
              <View className="flex-row gap-2">
                {productMedia.map((media, index) => (
                  <TouchableOpacity
                    key={`${media.type}-${media.uri}`}
                    onPress={() => {
                      videoPlayer.pause();
                      setSelectedMediaIndex(index);
                    }}
                    className="h-16 w-16 overflow-hidden rounded-[10px]"
                    style={{
                      borderWidth: selectedMediaIndex === index ? 2 : 1,
                      borderColor:
                        selectedMediaIndex === index ? DARK_GREEN : "#e5e7eb",
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          media.type === "video"
                            ? product.image
                            : media.uri,
                      }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    {media.type === "video" && (
                      <View className="absolute inset-0 items-center justify-center bg-black/30">
                        <Ionicons name="play" size={22} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Name + price */}
          <View className="flex-row items-start justify-between">
            {/* Product name + rating */}
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-black text-gray-900 leading-tight">
                {product.name}
              </Text>

              {avgRating > 0 && (
                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons name="star" size={12} color="#f59e0b" />
                  <Text className="text-amber-600 font-bold text-xs">
                    {avgRating.toFixed(1)}
                  </Text>
                  <Text className="text-gray-400 text-[10px]">
                    ({totalReviews})
                  </Text>
                </View>
              )}
            </View>

            {/* Price */}
            <View className="items-end">
              {currentBatch ? (
                <>
                  <Text className="text-green-900 font-black text-2xl">
                    ₱{Number(currentBatch.price).toFixed(2)}
                    <Text className="text-gray-400 text-xs font-normal">
                      {" "}/{product.unit}
                    </Text>
                  </Text>
                  <Text className="text-green-900 font-bold text-xs mt-1">
                    {totalAvailableStock} {product.unit.replace(/^per\s+/i, "")} left
                  </Text>
                </>
              ) : (
                <Text className="text-gray-400 font-bold text-sm">
                  Unavailable
                </Text>
              )}
            </View>
          </View>

         {/* Farm location */}
          <View className="flex-row items-center justify-between mt-3">
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/buyer/farm/[farmerId]",
                  params: { farmerId: product.farmerId },
                })
              }
              className="flex-row items-center gap-1"
            >
              <Ionicons name="location-outline" size={13} color={DARK_GREEN} />
              <Text className="text-green-900 font-semibold text-sm">
                {product.farmName}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={DARK_GREEN} />
            </TouchableOpacity>

          </View>

          {/* Current batch */}
          {currentBatch && (
            <View className="mt-2 flex-row items-center py-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="layers-outline" size={16} color={DARK_GREEN} />
                <Text className="text-green-900 font-bold text-sm" numberOfLines={1}>
                  Current Batch: Batch {String(currentBatch.batchNumber).padStart(3, "0")}
                </Text>
              </View>
              <View style={{ flex: 1, height: 1, marginHorizontal: 10 }} />
            </View>
          )}

          {/* Description */}
          {product.description ? (
            <>
            {/* line separator */}
              <View style={{ height: 1, backgroundColor: "#e5e7eb", opacity: 0.6, marginTop: 10, marginBottom: 10 }} />
              <View>
                <Text className="text-gray-800 font-bold text-base mb-2">About this product</Text>
                <Text className="text-gray-600 leading-6 text-sm">
                  {descriptionExpanded || product.description.length <= DESCRIPTION_PREVIEW_LENGTH
                    ? product.description
                    : `${product.description.slice(0, DESCRIPTION_PREVIEW_LENGTH).trim()}...`}
                </Text>
                {product.description.length > DESCRIPTION_PREVIEW_LENGTH && (
                  <TouchableOpacity
                    onPress={() => setDescriptionExpanded((expanded) => !expanded)}
                    className="self-start mt-1"
                  >
                    <Text className="text-green-900 font-semibold text-sm">
                      {descriptionExpanded ? "See less" : "See more"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : null}

          {/* ── REVIEWS ── */}
          <View className="mt-5">
            <View style={{ height: 1, backgroundColor: "#e5e7eb", opacity: 0.6, marginBottom: 16 }} />
            <Text className="text-gray-800 font-bold text-base mb-4">Reviews</Text>
              <View className="flex-row items-center mb-4">
                <View className="items-center pr-5" style={{ width: 108 }}>
                  <Text
                    className="text-gray-900 font-black"
                    style={{ fontSize: 52, lineHeight: 56 }}
                  >
                    {avgRating.toFixed(1)}
                  </Text>
                  <View className="flex-row gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round(avgRating) ? "star" : "star-outline"}
                        size={14}
                        color="#f59e0b"
                      />
                    ))}
                  </View>
                  <Text className="text-gray-400 text-xs mt-1">
                    {totalReviews} reviews
                  </Text>
                </View>

                <View className="flex-1 gap-1.5">
                  {ratingDistribution.map(({ star, pct }) => (
                    <View key={star} className="flex-row items-center gap-2">
                      <Text className="text-gray-500 text-[11px]" style={{ width: 10 }}>
                        {star}
                      </Text>
                      <View className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                      <Text className="text-gray-400 text-[10px]" style={{ width: 30 }}>
                        {pct}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: "#e5e7eb", opacity: 0.6, marginBottom: 16 }} />

              {/* FILTER CHIPS - "All" + isang chip per batch na may review.
                  Kapag pinili ang isang specific na batch, puro reviews
                  LANG ng batch na yun ang lalabas sa listahan sa ibaba. */}
              {reviewedBatchNumbers.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                >
                  <TouchableOpacity
                    onPress={() => setReviewFilter("all")}
                    className={`px-4 py-2 rounded-full ${
                      reviewFilter === "all" ? "bg-green-900" : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        reviewFilter === "all" ? "text-white" : "text-gray-600"
                      }`}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  {reviewedBatchNumbers.map((num) => {
                    const isCurrent = currentBatch?.batchNumber === num;
                    return (
                      <TouchableOpacity
                        key={num}
                        onPress={() => setReviewFilter(num)}
                        className={`px-4 py-2 rounded-full ${
                          reviewFilter === num ? "bg-green-900" : "bg-gray-100"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            reviewFilter === num ? "text-white" : "text-gray-600"
                          }`}
                        >
                          Batch {String(num).padStart(3, "0")}
                          {isCurrent ? " (current)" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            {filteredReviews.length === 0 ? (
              <Text className="text-center text-gray-400 mt-6">
                {reviewFilter === "all"
                  ? "No reviews yet."
                  : `No reviews yet for Batch ${String(reviewFilter).padStart(3, "0")}.`}
              </Text>
            ) : (
              filteredReviews.map((item, index) => (
                <View key={item.docId} className="mb-1">
                  <Text className="text-gray-400 text-[10px] mb-1">
                    Batch {String(item.batchNumber).padStart(3, "0")}
                  </Text>
                  <ReviewCard item={item} />
                  {index < filteredReviews.length - 1 && (
                    <View style={{ height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 }} />
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>

      {/* ── BOTTOM ACTION BAR ── */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100"
        style={{ elevation: 12 }}
      >
        <View className="flex-row items-stretch">
          <TouchableOpacity
            onPress={() => {
              if (!product.farmName || !product.farmerId) {
                showToast("Farmer info not available.");
                return;
              }
              router.push({
                pathname: "/buyer/messages/ChatScreen",
                params: {
                  farmerName: product.farmName,
                  farmerId: product.farmerId,
                  farmerProfileImage: farmerProfileImage || "",
                },
              });
            }}
            className="px-5 items-center justify-center"
          >
            <AntDesign name="message" size={20} color={DARK_GREEN} />
          </TouchableOpacity>

          <View className="w-px bg-gray-100" />

          <TouchableOpacity
            onPress={() => openModal("cart")}
            disabled={!currentBatch}
            className="px-5 items-center justify-center flex-row gap-2"
          >
            <Ionicons name="cart-outline" size={20} color={currentBatch ? DARK_GREEN : "#9ca3af"} />
            <Text className={`font-bold text-sm ${currentBatch ? "text-green-900" : "text-gray-400"}`}>
              Cart
            </Text>
          </TouchableOpacity>

          <View className="w-px bg-gray-200" />

          <TouchableOpacity
            onPress={() => openModal("buynow")}
            disabled={!currentBatch}
            className={`flex-1 items-center justify-center py-5 ${
              currentBatch ? "bg-green-900" : "bg-gray-300"
            }`}
            style={currentBatch ? { elevation: 4, shadowColor: DARK_GREEN, shadowOpacity: 0.25, shadowRadius: 8 } : undefined}
          >
            <Text className="text-white font-black text-base">
              {currentBatch ? "Buy Now" : "Out of Stock"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MODAL ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <Animated.View
          className="flex-1 justify-end"
          style={{ opacity: fadeAnim }}
        >
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={closeModal}
          />
        </Animated.View>

        {currentBatch && (
          <Animated.View
            className="bg-white rounded-t-[32px] px-6 pt-3 pb-10 absolute bottom-0 w-full"
            style={{
              transform: [{ translateY: slideAnim }],
              borderTopWidth: 2,
              borderColor: DARK_GREEN,
              elevation: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.16,
              shadowRadius: 12,
            }}
          >
            <View className="flex-row gap-4 mb-5 mt-2">
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: "#f0fdf4",
                }}
              >
                {product.image ? (
                  <Image
                    source={{ uri: product.image }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons
                      name="leaf-outline"
                      size={28}
                      color="#86efac"
                    />
                  </View>
                )}
              </View>

              <View className="flex-1">
                <Text
                  className="font-black text-gray-900 text-base"
                  numberOfLines={2}
                >
                  {product.name}
                </Text>

                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons
                    name="location-outline"
                    size={11}
                    color={DARK_GREEN}
                  />
                  <Text className="text-green-900 text-xs font-semibold">
                    {product.farmName}
                  </Text>
                </View>

                <Text className="text-green-900 font-black text-xl mt-1.5">
                  ₱{Number(currentBatch.price).toFixed(2)}
                  <Text className="text-gray-400 text-xs font-normal">
                    {" / "}
                    {product.unit}
                  </Text>
                </Text>

                <Text className="text-gray-400 text-xs mt-0.5">
                  {totalAvailableStock} {product.unit} available
                </Text>
              </View>
            </View>

            <View className="h-px bg-gray-100 mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-700 font-semibold">
                Quantity
              </Text>

              <View className="flex-row items-center gap-4">
                <TouchableOpacity
                  onPress={() =>
                    setQuantity((q) => Math.max(1, q - 1))
                  }
                  className="bg-gray-100 w-10 h-10 rounded-[5px] items-center justify-center"
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={quantity <= 1 ? "#d1d5db" : "#374151"}
                  />
                </TouchableOpacity>

                <Text className="font-black text-lg w-7 text-center text-gray-900">
                  {quantity}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setQuantity((q) =>
                      Math.min(totalAvailableStock, q + 1)
                    )
                  }
                  className="bg-green-900 w-10 h-10 rounded-[5px] items-center justify-center"
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      quantity >= totalAvailableStock
                        ? "#86efac"
                        : "white"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>

            {quantity > currentBatch.stock && (
              <Text className="text-orange-600 text-[11px] mb-2 -mt-2">
                {currentBatch.stock} {product.unit} mula sa Batch{" "}
                {String(currentBatch.batchNumber).padStart(3, "0")}, at{" "}
                {quantity - currentBatch.stock} {product.unit} mula sa
                susunod na batch.
              </Text>
            )}

            {/* Total Price */}
            <View className="flex-row justify-between items-center px-1 py-3 mb-5">
              <Text className="text-gray-500 font-medium">
                Total
              </Text>

              <Text className="font-black text-green-900 text-xl">
                ₱{(Number(currentBatch.price) * quantity).toFixed(2)}
              </Text>
            </View>

            {/* Buy Now */}
            <TouchableOpacity
              onPress={
                modalMode === "cart"
                  ? handleAddToCart
                  : handleBuyNow
              }
              className="bg-green-900 py-4 rounded-[5px] items-center justify-center"
              style={{
                elevation: 4,
                shadowColor: DARK_GREEN,
                shadowOpacity: 0.3,
                shadowRadius: 8,
              }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-black text-base">
                {modalMode === "cart" ? "Add to Cart" : "Buy Now"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Modal>
    </View>
  );
}

// ── HELPER COMPONENTS ──
function InfoChip({
  icon,
  label,
  color = "gray",
}: {
  icon: string;
  label: string;
  color?: "gray" | "green";
}) {
  const isGreen = color === "green";
  return (
    <View className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${isGreen ? "bg-green-50" : "bg-gray-100"}`}>
      <Ionicons name={icon as any} size={12} color={isGreen ? DARK_GREEN : "#6b7280"} />
      <Text className={`text-xs font-semibold ${isGreen ? "text-green-900" : "text-gray-600"}`}>{label}</Text>
    </View>
  );
}

function ReviewCard({ item }: { item: ReviewType }) {
  return (
    <View className="flex-row items-center gap-3 bg-gray-50 rounded-2xl p-4">
      {/* PFP */}
      <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center overflow-hidden">
        {item.buyerProfileImage ? (
          <Image
            source={{ uri: item.buyerProfileImage }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Text className="text-green-900 font-bold text-sm">
            {item.buyerName?.charAt(0) || "?"}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-gray-800 text-sm">{item.buyerName}</Text>
          <Text className="text-gray-400 text-xs">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View className="flex-row gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= item.rating ? "star" : "star-outline"}
              size={12}
              color="#f59e0b"
            />
          ))}
        </View>

        <Text className="text-gray-600 text-sm mt-2 leading-5">{item.comment}</Text>
      </View>
    </View>
  );
}