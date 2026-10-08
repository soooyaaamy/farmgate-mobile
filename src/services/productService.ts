// src/services/productService.ts

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  increment,
  limit,
  runTransaction,
} from "firebase/firestore";

import { db } from "../../FirebaseConfig";

import {
  CreateProductInput,
  ProductType,
  CreateBatchInput,
  BatchType,
  CreateHarvestRecordInput,
  HarvestRecordType,
  CreateReviewInput,
  ReviewType,
  SaleContribution,
} from "../types/product";

type HarvestRecordWithType = CreateHarvestRecordInput & {
  type?: "harvest" | "restock";
};

import { normalizeProductName } from "../../constants/productCatalog";

const productCollection = collection(db, "products");
const batchCollection = collection(db, "productBatches");
const harvestCollection = collection(db, "harvestRecords");
const reviewCollection = collection(db, "reviews");

// ============================================================
// GET PRODUCT BY ID
// ============================================================

export const getProductById = async (
  id: string
): Promise<ProductType | null> => {
  try {
    const snap = await getDoc(doc(db, "products", id));

    if (!snap.exists()) {
      return null;
    }

    return {
      docId: snap.id,
      ...(snap.data() as CreateProductInput),
    };
  } catch (error) {
    console.log("GET PRODUCT ERROR:", error);
    return null;
  }
};

// ============================================================
// GET FARMER EXISTING PRODUCTS
// ============================================================

export const getFarmerProductNames = async (
  farmerId: string,
  includeArchived: boolean = false
): Promise<ProductType[]> => {
  try {
    const q = query(
      productCollection,
      where("farmerId", "==", farmerId)
    );

    const snapshot = await getDocs(q);

    const products = snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as CreateProductInput),
    }));

    return includeArchived
      ? products
      : products.filter((p) => !p.archived);
  } catch (error) {
    console.log("GET FARMER PRODUCTS ERROR:", error);
    return [];
  }
};

export const getFarmerProducts = getFarmerProductNames;

// ============================================================
// GET ARCHIVED PRODUCTS
// ============================================================

export const getArchivedProducts = async (
  farmerId: string
): Promise<ProductType[]> => {
  const all = await getFarmerProductNames(
    farmerId,
    true
  );

  return all.filter((p) => p.archived);
};

// ============================================================
// FIND EXISTING ACTIVE PRODUCT
// ============================================================

const findExistingProduct = async (
  farmerId: string,
  name: string,
  category: string
): Promise<ProductType | null> => {
  const q = query(
    productCollection,
    where("farmerId", "==", farmerId),
    where("category", "==", category)
  );

  const snapshot = await getDocs(q);

  const target = normalizeProductName(name);

  const match = snapshot.docs.find((d) => {
    const data = d.data() as CreateProductInput;

    return (
      !data.archived &&
      normalizeProductName(data.name) === target
    );
  });

  if (!match) {
    return null;
  }

  return {
    docId: match.id,
    ...(match.data() as CreateProductInput),
  };
};

// ============================================================
// FIND ARCHIVED DUPLICATE
// ============================================================

export const findArchivedProduct = async (
  farmerId: string,
  name: string,
  category: string
): Promise<ProductType | null> => {
  const q = query(
    productCollection,
    where("farmerId", "==", farmerId),
    where("category", "==", category)
  );

  const snapshot = await getDocs(q);

  const target = normalizeProductName(name);

  const match = snapshot.docs.find((d) => {
    const data = d.data() as CreateProductInput;

    return (
      !!data.archived &&
      normalizeProductName(data.name) === target
    );
  });

  if (!match) {
    return null;
  }

  return {
    docId: match.id,
    ...(match.data() as CreateProductInput),
  };
};

// ============================================================
// GET LATEST BATCH
// ============================================================

export const getLatestBatch = async (
  productId: string
): Promise<BatchType | null> => {
  const batches = await getBatchesByProduct(productId);

  return batches[0] || null;
};

// ============================================================
// GET CURRENT BATCH FOR HARVEST
// ============================================================

export const getActiveBatchForHarvest = async (
  productId: string
): Promise<BatchType | null> => {
  return getLatestBatch(productId);
};

// ============================================================
// GET ALL BATCHES OF PRODUCT
// ============================================================

export const getBatchesByProduct = async (
  productId: string,
  includeArchived: boolean = false
): Promise<BatchType[]> => {
  try {
    const q = query(
      batchCollection,
      where("productId", "==", productId)
    );

    const snapshot = await getDocs(q);

    const batches = snapshot.docs
      .map((d) => ({
        docId: d.id,
        ...(d.data() as CreateBatchInput),
      }))
      .sort(
        (a, b) =>
          b.batchNumber - a.batchNumber
      );

    return includeArchived
      ? batches
      : batches.filter((b) => !b.archived);
  } catch (error) {
    console.log("GET BATCHES ERROR:", error);
    return [];
  }
};

// ============================================================
// GET HARVEST RECORDS OF BATCH
// ============================================================

export const getHarvestRecordsByBatch = async (
  batchId: string
): Promise<HarvestRecordType[]> => {
  try {
    const q = query(
      harvestCollection,
      where("batchId", "==", batchId)
    );

    const snapshot = await getDocs(q);

    const records = snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as HarvestRecordWithType),
    })) as HarvestRecordType[];

    return records.sort(
      (a, b) =>
        a.harvestDate - b.harvestDate
    );
  } catch (error) {
    console.log(
      "GET HARVEST RECORDS ERROR:",
      error
    );

    return [];
  }
};

// ============================================================
// RECALCULATE PRODUCT AGGREGATES
// ============================================================

const recalculateProductAggregates = async (
  productId: string
) => {
  const batches = await getBatchesByProduct(
    productId,
    true
  );

  const sellableBatches = batches.filter(
    (batch) =>
      batch.archived !== true &&
      Number(batch.stock) > 0 &&
      batch.status === "Available"
  );

  const totalStock = sellableBatches.reduce(
    (sum, batch) =>
      sum + Number(batch.stock || 0),
    0
  );

  const productRef = doc(
    db,
    "products",
    productId
  );

  // IMPORTANT:
  // Product price is the single source of truth.
  // Never replace it with batch.price here.
  await updateDoc(productRef, {
    stock: totalStock,
    status:
      totalStock > 0
        ? "Available"
        : "Out of Stock",
  });
};

// ============================================================
// SYNC ONE PRODUCT PRICE TO ALL BATCHES
// ============================================================

const syncProductPriceToAllBatches = async (
  productId: string,
  price: number
) => {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Invalid price.");
  }

  const productRef = doc(
    db,
    "products",
    productId
  );

  await updateDoc(productRef, {
    price,
  });

  const batches = await getBatchesByProduct(
    productId,
    true
  );

  await Promise.all(
    batches.map((batch) =>
      updateDoc(
        doc(
          db,
          "productBatches",
          batch.docId
        ),
        { price }
      )
    )
  );
};

// ============================================================
// ADD HARVEST
// ============================================================

export const addHarvest = async (
  input: CreateProductInput,
  quantity: number,
  price: number,
  forceNewBatch: boolean = false,
  harvestDate?: number
): Promise<{
  product: ProductType;
  batch: BatchType;
  harvestRecord: HarvestRecordType;
  createdNewBatch: boolean;
}> => {
  try {
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Invalid harvest quantity."
      );
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        "Invalid price."
      );
    }

    const existing =
      await findExistingProduct(
        input.farmerId,
        input.name,
        input.category
      );

    let product: ProductType;

    if (existing) {
      product = existing;
    } else {
      const archivedDuplicate =
        await findArchivedProduct(
          input.farmerId,
          input.name,
          input.category
        );

      if (archivedDuplicate) {
        throw new Error(
          `May naka-archive ka nang "${archivedDuplicate.name}". I-unarchive muna ito sa Archived tab bago ka makapag-dagdag ng bagong harvest.`
        );
      }

      const docRef = await addDoc(
        productCollection,
        input
      );

      product = {
        docId: docRef.id,
        ...input,
      };
    }

    const effectiveHarvestDate =
      harvestDate ?? Date.now();

    // One product = one price for every batch.
    const effectivePrice = Number(price);

    await syncProductPriceToAllBatches(
      product.docId,
      effectivePrice
    );

    const currentBatch =
      await getActiveBatchForHarvest(
        product.docId
      );

    let batch: BatchType;
    let createdNewBatch = false;

    // ========================================================
    // ADD TO EXISTING BATCH
    // ========================================================

    if (
      currentBatch &&
      !forceNewBatch
    ) {
      const batchRef = doc(
        db,
        "productBatches",
        currentBatch.docId
      );

      await updateDoc(batchRef, {
        stock: increment(quantity),
        totalHarvested:
          increment(quantity),
        price: effectivePrice,
        status: "Available",
      });

      const updatedSnap =
        await getDoc(batchRef);

      if (!updatedSnap.exists()) {
        throw new Error(
          "Updated batch not found."
        );
      }

      batch = {
        docId: currentBatch.docId,
        ...(updatedSnap.data() as CreateBatchInput),
      };
    }

    // ========================================================
    // CREATE NEW BATCH
    // ========================================================

    else {
      if (
        currentBatch &&
        forceNewBatch
      ) {
        await updateDoc(
          doc(
            db,
            "productBatches",
            currentBatch.docId
          ),
          {
            status: "Out of Stock",
          }
        );
      }

      const newBatchInput = {
        productId: product.docId,
        farmerId: input.farmerId,

        batchNumber: currentBatch
          ? currentBatch.batchNumber + 1
          : 1,

        price: effectivePrice,
        stock: quantity,
        totalHarvested: quantity,
        status: "Available",
        createdAt: Date.now(),
        archived: false,
        archivedViaProduct: false,
      } as CreateBatchInput;

      const batchRef = await addDoc(
        batchCollection,
        newBatchInput
      );

      batch = {
        docId: batchRef.id,
        ...newBatchInput,
      };

      createdNewBatch = true;
    }

    // ========================================================
    // CREATE NORMAL HARVEST RECORD
    // ========================================================

    const harvestRecordInput =
      {
        batchId: batch.docId,
        productId: product.docId,
        farmerId: input.farmerId,

        quantity,

        remainingQuantity:
          quantity,

        harvestDate:
          effectiveHarvestDate,

        createdAt: Date.now(),

        type: "harvest",
      } as HarvestRecordWithType;

    const harvestRef =
      await addDoc(
        harvestCollection,
        harvestRecordInput
      );

    const harvestRecord = {
      docId: harvestRef.id,
      ...harvestRecordInput,
    } as HarvestRecordType;

    await recalculateProductAggregates(
      product.docId
    );

    return {
      product,
      batch,
      harvestRecord,
      createdNewBatch,
    };
  } catch (error) {
    console.log(
      "ADD HARVEST ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// UPDATE MASTER PRODUCT INFO
// ============================================================

export const updateProductInfo = async (
  product: ProductType
) => {
  try {
    if (!product.docId) {
      return;
    }

    const ref = doc(
      db,
      "products",
      product.docId
    );

    await updateDoc(ref, {
      name: product.name,
      category: product.category,
      unit: product.unit,
      description: product.description,
      image: product.image,
      imagePublicId:
        product.imagePublicId,
      images: product.images || [product.image],
      imagePublicIds:
        product.imagePublicIds || [product.imagePublicId],
      video: product.video || "",
      videoPublicId: product.videoPublicId || "",
    });
  } catch (error) {
    console.log(
      "UPDATE PRODUCT INFO ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// UPDATE BATCH + RESTOCK
// ============================================================
//
// Kapag restockQuantity > 0:
//
// 1. Dagdagan ang stock.
// 2. Dagdagan ang totalHarvested.
// 3. Gumawa ng bagong harvestRecords document.
// 4. type = "restock".
// 5. remainingQuantity = restockQuantity.
//
// Ginamit ang Firestore transaction para sabay na mangyari
// ang batch update at paggawa ng restock record.

export const updateBatch = async (
  batchDocId: string,
  updates: {
    price?: number;
    status?: string;
    restockQuantity?: number;
  }
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    if (!snap.exists()) {
      throw new Error(
        "Batch not found."
      );
    }

    const batch =
      snap.data() as CreateBatchInput;

    const restockQuantity =
      Number(
        updates.restockQuantity || 0
      );

    // ========================================================
    // VALIDATE RESTOCK
    // ========================================================

    if (
      !Number.isFinite(
        restockQuantity
      ) ||
      restockQuantity < 0
    ) {
      throw new Error(
        "Invalid restock quantity."
      );
    }

    // ========================================================
    // VALIDATE PRICE
    // ========================================================

    if (
      updates.price !==
      undefined
    ) {
      if (
        !Number.isFinite(
          updates.price
        ) ||
        updates.price < 0
      ) {
        throw new Error(
          "Invalid price."
        );
      }
    }

    // ========================================================
    // TRANSACTION
    // ========================================================

    await runTransaction(
      db,
      async (transaction) => {
        const currentBatchSnap =
          await transaction.get(
            batchRef
          );

        if (
          !currentBatchSnap.exists()
        ) {
          throw new Error(
            "Batch not found."
          );
        }

        const batchUpdates: Record<
          string,
          any
        > = {};

        // ----------------------------------------------------
        // PRICE
        // ----------------------------------------------------
        // A batch cannot have an independent selling price.
        // The product price is applied to every batch.
        if (updates.price !== undefined) {
          batchUpdates.price = updates.price;
        }

        // ----------------------------------------------------
        // STATUS
        // ----------------------------------------------------

        if (
          updates.status !==
          undefined
        ) {
          batchUpdates.status =
            updates.status;
        }

        // ----------------------------------------------------
        // RESTOCK
        // ----------------------------------------------------

        if (
          restockQuantity > 0
        ) {
          batchUpdates.stock =
            increment(
              restockQuantity
            );

          batchUpdates.totalHarvested =
            increment(
              restockQuantity
            );

          // Kapag nag-restock at walang
          // specific status na pinili,
          // Available ang default.
          if (
            updates.status ===
              undefined ||
            updates.status ===
              "Available"
          ) {
            batchUpdates.status =
              "Available";
          }

          // --------------------------------------------------
          // CREATE RESTOCK HARVEST RECORD
          // --------------------------------------------------

          const restockRef =
            doc(harvestCollection);

          const now = Date.now();

          const restockRecord =
            {
              batchId:
                batchDocId,

              productId:
                batch.productId,

              farmerId:
                batch.farmerId,

              quantity:
                restockQuantity,

              remainingQuantity:
                restockQuantity,

              harvestDate:
                now,

              createdAt:
                now,

              type:
                "restock",
            } as HarvestRecordWithType;

          transaction.set(
            restockRef,
            restockRecord
          );
        }

        // ----------------------------------------------------
        // UPDATE BATCH
        // ----------------------------------------------------

        if (
          Object.keys(
            batchUpdates
          ).length > 0
        ) {
          transaction.update(
            batchRef,
            batchUpdates
          );
        }
      }
    );

    // ========================================================
    // REFRESH PRODUCT PRICE + STOCK
    // ========================================================

    if (updates.price !== undefined) {
      await syncProductPriceToAllBatches(
        batch.productId,
        updates.price
      );
    }

    await recalculateProductAggregates(
      batch.productId
    );
  } catch (error) {
    console.log(
      "UPDATE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// ARCHIVE BATCH
// ============================================================

export const archiveBatch = async (
  batchDocId: string
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    if (!snap.exists()) {
      return;
    }

    await updateDoc(
      batchRef,
      {
        archived: true,
        archivedViaProduct: false,
      }
    );

    const productId =
      (
        snap.data() as CreateBatchInput
      ).productId;

    await recalculateProductAggregates(
      productId
    );
  } catch (error) {
    console.log(
      "ARCHIVE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// UNARCHIVE BATCH
// ============================================================

export const unarchiveBatch = async (
  batchDocId: string
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    if (!snap.exists()) {
      return;
    }

    await updateDoc(
      batchRef,
      {
        archived: false,
        archivedViaProduct: false,
      }
    );

    const productId =
      (
        snap.data() as CreateBatchInput
      ).productId;

    await recalculateProductAggregates(
      productId
    );
  } catch (error) {
    console.log(
      "UNARCHIVE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// DELETE HARVEST RECORD
// ============================================================
//
// Gumagamit pa rin ng remainingQuantity para hindi mabura
// ang stock na naibenta na.
//
// Example:
//
// Harvest = 20
// Remaining = 8
//
// Kapag dinelete:
// Stock -8
// TotalHarvested -20

export const deleteHarvestRecord = async (
  harvestDocId: string
) => {
  try {
    const ref = doc(
      db,
      "harvestRecords",
      harvestDocId
    );

    const snap =
      await getDoc(ref);

    if (!snap.exists()) {
      return;
    }

    const record =
      snap.data() as HarvestRecordWithType;

    await deleteDoc(ref);

    const batchRef = doc(
      db,
      "productBatches",
      record.batchId
    );

    await updateDoc(
      batchRef,
      {
        stock: increment(
          -record.remainingQuantity
        ),

        totalHarvested:
          increment(
            -record.quantity
          ),
      }
    );

    const batchSnap =
      await getDoc(batchRef);

    if (batchSnap.exists()) {
      await recalculateProductAggregates(
        (
          batchSnap.data() as CreateBatchInput
        ).productId
      );
    }
  } catch (error) {
    console.log(
      "DELETE HARVEST RECORD ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// HARD DELETE BATCH
// ============================================================

export const deleteBatch = async (
  batchDocId: string
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    const productId =
      snap.exists()
        ? (
            snap.data() as CreateBatchInput
          ).productId
        : null;

    const records =
      await getHarvestRecordsByBatch(
        batchDocId
      );

    await Promise.all(
      records.map((r) =>
        deleteDoc(
          doc(
            db,
            "harvestRecords",
            r.docId
          )
        )
      )
    );

    await deleteDoc(batchRef);

    if (productId) {
      await recalculateProductAggregates(
        productId
      );
    }
  } catch (error) {
    console.log(
      "DELETE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// RECORD SALE
// ============================================================

export const recordSale = async (
  productId: string,
  quantity: number
): Promise<{
  contributions: SaleContribution[];
}> => {
  try {
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Invalid sale quantity."
      );
    }

    const productRef = doc(
      db,
      "products",
      productId
    );

    const productSnap = await getDoc(
      productRef
    );

    if (!productSnap.exists()) {
      throw new Error("Product not found.");
    }

    const product =
      productSnap.data() as CreateProductInput;

    const batches = (
      await getBatchesByProduct(
        productId,
        true
      )
    )
      .filter(
        (batch) =>
          batch.archived !== true &&
          batch.status === "Available" &&
          Number(batch.stock) > 0
      )
      .sort(
        (a, b) =>
          Number(a.batchNumber) -
          Number(b.batchNumber)
      );

    const totalAvailableStock =
      batches.reduce(
        (sum, batch) =>
          sum + Number(batch.stock || 0),
        0
      );

    if (totalAvailableStock < quantity) {
      throw new Error(
        `Kulang ang stock. Available: ${totalAvailableStock}.`
      );
    }

    const contributions: SaleContribution[] = [];
    let remaining = quantity;

    for (const batch of batches) {
      if (remaining <= 0) break;

      const currentStock = Number(
        batch.stock || 0
      );
      const takeFromBatch = Math.min(
        currentStock,
        remaining
      );

      if (takeFromBatch <= 0) continue;

      const harvestRecords = (
        await getHarvestRecordsByBatch(
          batch.docId
        )
      ).filter(
        (record) =>
          Number(record.remainingQuantity || 0) > 0
      );

      let remainingInBatch = takeFromBatch;

      for (const record of harvestRecords) {
        if (remainingInBatch <= 0) break;

        const available = Number(
          record.remainingQuantity || 0
        );
        const takeFromRecord = Math.min(
          available,
          remainingInBatch
        );

        await updateDoc(
          doc(
            db,
            "harvestRecords",
            record.docId
          ),
          {
            remainingQuantity: increment(
              -takeFromRecord
            ),
          }
        );

        contributions.push({
          batchId: batch.docId,
          batchNumber: batch.batchNumber,
          harvestRecordId: record.docId,
          quantity: takeFromRecord,
        });

        remainingInBatch -= takeFromRecord;
      }

      if (remainingInBatch > 0) {
        contributions.push({
          batchId: batch.docId,
          batchNumber: batch.batchNumber,
          harvestRecordId: null,
          quantity: remainingInBatch,
        });
      }

      const newStock = Number(
        (currentStock - takeFromBatch).toFixed(6)
      );

      await updateDoc(
        doc(
          db,
          "productBatches",
          batch.docId
        ),
        {
          stock: newStock,
          status:
            newStock > 0
              ? "Available"
              : "Out of Stock",
        }
      );

      remaining -= takeFromBatch;
    }

    if (remaining > 0) {
      throw new Error(
        "Unable to complete the sale from available batches."
      );
    }

    await updateDoc(productRef, {
      totalSales: increment(quantity),
      weeklySales: increment(quantity),
      monthlySales: increment(quantity),
    });

    await recalculateProductAggregates(
      productId
    );

    // Keep every batch on the same product price.
    const currentPrice = Number(
      product.price
    );

    if (Number.isFinite(currentPrice)) {
      await syncProductPriceToAllBatches(
        productId,
        currentPrice
      );
    }

    return { contributions };
  } catch (error) {
    console.log(
      "RECORD SALE ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// REVIEWS
// ============================================================

export const addReview = async (
  review: CreateReviewInput
) => {
  try {
    await addDoc(
      reviewCollection,
      review
    );

    const productRef = doc(
      db,
      "products",
      review.productId
    );

    const productSnap =
      await getDoc(productRef);

    if (productSnap.exists()) {
      const data =
        productSnap.data() as CreateProductInput;

      const newTotalReviews =
        (data.totalReviews || 0) +
        1;

      const newRating =
        (
          (
            data.rating || 0
          ) *
            (
              data.totalReviews ||
              0
            ) +
          review.rating
        ) /
        newTotalReviews;

      await updateDoc(
        productRef,
        {
          totalReviews:
            newTotalReviews,

          rating:
            newRating,
        }
      );
    }
  } catch (error) {
    console.log(
      "ADD REVIEW ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// GET ALL REVIEWS OF PRODUCT
// ============================================================

export const getReviewsByProduct = async (
  productId: string
): Promise<ReviewType[]> => {
  const q = query(
    reviewCollection,
    where(
      "productId",
      "==",
      productId
    )
  );

  const snapshot =
    await getDocs(q);

  const reviews =
    snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as CreateReviewInput),
    }));

  return reviews.sort(
    (a, b) =>
      b.createdAt -
      a.createdAt
  );
};

// ============================================================
// GET REVIEWS BY BATCH
// ============================================================

export const getReviewsByBatch = async (
  productId: string,
  batchId: string
): Promise<ReviewType[]> => {
  const q = query(
    reviewCollection,
    where(
      "batchId",
      "==",
      batchId
    )
  );

  const snapshot =
    await getDocs(q);

  const reviews =
    snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as CreateReviewInput),
    }));

  return reviews.sort(
    (a, b) =>
      b.createdAt -
      a.createdAt
  );
};

// ============================================================
// REALTIME PRODUCTS
// ============================================================

export const subscribeToProducts = (
  callback: (
    products: ProductType[]
  ) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    productCollection,
    orderBy(
      "createdAt",
      "desc"
    )
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const products =
        snapshot.docs
          .map((d) => ({
            docId: d.id,
            ...(d.data() as CreateProductInput),
          }))
          .filter(
            (p) => !p.archived
          );

      callback(products);
    },
    onError ||
      ((error) =>
        console.log(
          "REALTIME ERROR:",
          error
        ))
  );
};

// ============================================================
// ARCHIVE PRODUCT
// ============================================================

export const archiveProduct = async (
  productId: string
) => {
  try {
    await updateDoc(
      doc(
        db,
        "products",
        productId
      ),
      {
        archived: true,
      }
    );

    const batches =
      await getBatchesByProduct(
        productId,
        true
      );

    await Promise.all(
      batches
        .filter(
          (b) => !b.archived
        )
        .map((b) =>
          updateDoc(
            doc(
              db,
              "productBatches",
              b.docId
            ),
            {
              archived: true,
              archivedViaProduct:
                true,
            }
          )
        )
    );
  } catch (error) {
    console.log(
      "ARCHIVE PRODUCT ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// UNARCHIVE PRODUCT
// ============================================================

export const unarchiveProduct = async (
  productId: string
) => {
  try {
    await updateDoc(
      doc(
        db,
        "products",
        productId
      ),
      {
        archived: false,
      }
    );

    const batches =
      await getBatchesByProduct(
        productId,
        true
      );

    await Promise.all(
      batches
        .filter(
          (b) =>
            b.archived &&
            b.archivedViaProduct
        )
        .map((b) =>
          updateDoc(
            doc(
              db,
              "productBatches",
              b.docId
            ),
            {
              archived: false,
              archivedViaProduct:
                false,
            }
          )
        )
    );

    await recalculateProductAggregates(
      productId
    );
  } catch (error) {
    console.log(
      "UNARCHIVE PRODUCT ERROR:",
      error
    );

    throw error;
  }
};

// ============================================================
// HARD DELETE PRODUCT
// ============================================================

export const deleteProduct = async (
  docId: string
) => {
  try {
    await deleteDoc(
      doc(
        db,
        "products",
        docId
      )
    );

    const batches =
      await getBatchesByProduct(
        docId,
        true
      );

    await Promise.all(
      batches.map((b) =>
        deleteBatch(b.docId)
      )
    );
  } catch (error) {
    console.log(
      "DELETE ERROR:",
      error
    );

    throw error;
  }
};