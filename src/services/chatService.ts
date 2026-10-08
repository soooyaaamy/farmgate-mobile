import {
  addDoc,
  collection,
  doc,
  FieldPath,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../FirebaseConfig";

// ================= CREATE CHAT ID =================
export const createChatId = (
  uid1: string,
  uid2: string
) => {
  return [uid1, uid2].sort().join("_");
};

// ================= SEND MESSAGE =================
export const sendMessage = async ({
  chatId,
  senderId,
  receiverId,
  text,
}: {
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
}) => {
  if (!text.trim()) return;

  await setDoc(
    doc(db, "chats", chatId),
    {
      users: [senderId, receiverId],
      lastMessage: text,
      lastSenderId: senderId,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await addDoc(
    collection(db, "chats", chatId, "messages"),
    {
      text,
      senderId,
      receiverId,
      createdAt: serverTimestamp(),
    }
  );
};

// ================= REALTIME MESSAGES =================
export const listenMessages = (
  chatId: string,
  callback: (messages: any[]) => void
) => {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(messages);
  });
};

// ================= REALTIME CHAT LIST =================
// ✅ FIX: query sa server, hindi client-side filter
export const listenChats = (
  uid: string,
  callback: (chats: any[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, "chats"),
    where("users", "array-contains", uid),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(chats);
    },
    onError
  );
};

export const markChatRead = async (chatId: string, uid: string) => {
  await updateDoc(
    doc(db, "chats", chatId),
    new FieldPath("lastReadAt", uid),
    serverTimestamp()
  );
};