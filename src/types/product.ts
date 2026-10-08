// src/types/product.ts

export type ProductCategory =
  | "Fruits"
  | "Egg & Poultry"
  | "Vegetables"
  | "Rice & Grains";

export type ProductUnit = "per kg" | "per pcs";

export type ProductStatus = "Available" | "Out of Stock";

// ================= MASTER PRODUCT =================

export type CreateProductInput = {
  name: string;
  category: string;
  unit: string;
  description: string;
  image: string;
  imagePublicId: string;
  images?: string[];
  imagePublicIds?: string[];
  video?: string;
  videoPublicId?: string;

  farmerId: string;
  farmerName: string;
  farmName: string;

  rating: number;
  totalReviews: number;
  totalSales: number;
  weeklySales: number;
  monthlySales: number;
  createdAt: number;

  // Denormalized display fields.
  // Actual inventory comes from productBatches.
  price: number;
  stock: number;
  status: string;

  // Soft-delete/archive flag.
  archived: boolean;
};

export type ProductType = CreateProductInput & {
  docId: string;
};

// ================= BATCH =================
//
// A batch is an optional inventory group for a product.
// There is NO automatic weekly/new-batch rule.
// The farmer decides whether a new harvest is added to
// the latest active batch or starts a new batch.

export type CreateBatchInput = {
  productId: string;
  farmerId: string;

  batchNumber: number;

  price: number;
  stock: number;
  totalHarvested: number;

  // "Available" | "Out of Stock"
  status: string;

  createdAt: number;

  // Soft-delete/archive flag.
  archived: boolean;

  // true when archived because the whole product was archived.
  // false when the farmer archived this batch directly.
  archivedViaProduct: boolean;
};

export type BatchType = CreateBatchInput & {
  docId: string;
};

// ================= HARVEST RECORD =================

export type CreateHarvestRecordInput = {
  batchId: string;
  productId: string;
  farmerId: string;

  quantity: number;
  remainingQuantity: number;
  harvestDate: number;
  createdAt: number;

  type: "harvest" | "restock";
};

export type HarvestRecordType = CreateHarvestRecordInput & {
  docId: string;
};

// ================= REVIEW =================

export type CreateReviewInput = {
  productId: string;
  batchId: string;
  batchNumber: number;
  harvestRecordId?: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  buyerProfileImage?: string;
  rating: number;
  comment: string;
  createdAt: number;
};

export type ReviewType = CreateReviewInput & {
  docId: string;
};

// ================= SALE CONTRIBUTION =================

export type SaleContribution = {
  batchId: string;
  batchNumber: number;
  harvestRecordId: string | null;
  quantity: number;
};
