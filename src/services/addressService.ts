import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db }
  from "../../FirebaseConfig";

// ================= ADD ADDRESS =================
export const addAddress =
  async (
    address: any
  ) => {

    try {

      // ================= REMOVE OLD DEFAULT =================
      if (
        address.isDefault
      ) {

        const q =
          query(
            collection(
              db,
              "addresses"
            ),
            where(
              "userId",
              "==",
              address.userId
            ),
            where(
              "isDefault",
              "==",
              true
            )
          );

        const snapshot =
          await getDocs(q);

        for (const item of snapshot.docs) {

          await updateDoc(
            doc(
              db,
              "addresses",
              item.id
            ),
            {
              isDefault: false,
            }
          );
        }
      }

      // ================= ADD NEW =================
      await addDoc(
        collection(
          db,
          "addresses"
        ),
        {
          ...address,
          createdAt:
            new Date(),
        }
      );

    } catch (error) {

      console.log(error);

      throw error;
    }
  };

// ================= GET USER ADDRESSES =================
export const getUserAddresses =
  async (
    userId: string
  ) => {

    try {

      const q =
        query(
          collection(
            db,
            "addresses"
          ),
          where(
            "userId",
            "==",
            userId
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

    } catch (error) {

      console.log(error);

      return [];
    }
  };

// ================= SET DEFAULT =================
export const setDefaultAddress =
  async (
    userId: string,
    addressId: string
  ) => {

    try {

      // REMOVE CURRENT DEFAULT
      const q =
        query(
          collection(
            db,
            "addresses"
          ),
          where(
            "userId",
            "==",
            userId
          ),
          where(
            "isDefault",
            "==",
            true
          )
        );

      const snapshot =
        await getDocs(q);

      for (const item of snapshot.docs) {

        await updateDoc(
          doc(
            db,
            "addresses",
            item.id
          ),
          {
            isDefault: false,
          }
        );
      }

      // SET NEW DEFAULT
      await updateDoc(
        doc(
          db,
          "addresses",
          addressId
        ),
        {
          isDefault: true,
        }
      );

    } catch (error) {

      console.log(error);

      throw error;
    }
  };

// ================= DELETE ADDRESS =================
export const deleteAddress =
  async (
    addressId: string
  ) => {

    try {

      await deleteDoc(
        doc(
          db,
          "addresses",
          addressId
        )
      );

    } catch (error) {

      console.log(error);

      throw error;
    }
  };