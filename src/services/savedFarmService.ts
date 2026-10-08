import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db }
  from "../../FirebaseConfig";

// ================= SAVE FARM =================
export const saveFarm =
  async (data: any) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        data.buyerId
      ),
      where(
        "farmerId",
        "==",
        data.farmerId
      )
    );

    const snapshot =
      await getDocs(q);

    if (!snapshot.empty) {
      return;
    }

    await addDoc(
      collection(
        db,
        "savedFarms"
      ),
      {
        ...data,
        createdAt:
          Date.now(),
      }
    );
  };

// ================= UNSAVE =================
export const unsaveFarm =
  async (
    buyerId: string,
    farmerId: string
  ) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        buyerId
      ),
      where(
        "farmerId",
        "==",
        farmerId
      )
    );

    const snapshot =
      await getDocs(q);

    for (const item of snapshot.docs) {

      await deleteDoc(
        doc(
          db,
          "savedFarms",
          item.id
        )
      );
    }
  };

// ================= CHECK =================
export const checkSavedFarm =
  async (
    buyerId: string,
    farmerId: string
  ) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        buyerId
      ),
      where(
        "farmerId",
        "==",
        farmerId
      )
    );

    const snapshot =
      await getDocs(q);

    return !snapshot.empty;
  };

// ================= GET SAVED =================
export const getSavedFarms =
  async (
    buyerId: string
  ) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        buyerId
      )
    );

    const snapshot =
      await getDocs(q);

    return snapshot.docs.map(
      (doc) => ({
        id: doc.id,
        ...doc.data(),
      })
    );
  };