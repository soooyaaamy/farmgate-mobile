import { doc, setDoc } from "firebase/firestore";

import { db } from "../../FirebaseConfig";

export const saveUserToFirestore = async (
  uid: string,
  data: any
) => {
  await setDoc(doc(db, "users", uid), data);
};