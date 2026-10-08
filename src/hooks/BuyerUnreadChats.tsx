import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { listenChats, markChatRead } from "../services/chatService";

type BuyerUnreadChatsContextValue = {
  unreadChatIds: Set<string>;
  markRead: (chatId: string) => Promise<void>;
};

const BuyerUnreadChatsContext =
  createContext<BuyerUnreadChatsContextValue | null>(null);

export function BuyerUnreadChatsProvider({
  children,
}: PropsWithChildren) {
  const [buyerId, setBuyerId] = useState("");
  const [chats, setChats] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    const loadBuyerChats = async () => {
      try {
        const userString = await AsyncStorage.getItem("user");
        const user = userString ? JSON.parse(userString) : null;
        const uid = user?.uid;

        if (!uid) {
          if (active) setChats([]);
          return;
        }

        if (!active) return;
        setBuyerId(uid);
        unsubscribe = listenChats(
          uid,
          setChats,
          (error) => console.error("LISTEN BUYER CHATS ERROR:", error)
        );
      } catch (error) {
        console.error("LOAD BUYER CHATS ERROR:", error);
      }
    };

    void loadBuyerChats();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const unreadChatIds = useMemo(() => {
    const unreadIds = new Set<string>();
    if (!buyerId) return unreadIds;

    for (const chat of chats) {
      if (!chat.lastSenderId || chat.lastSenderId === buyerId) continue;

      const lastMessageMillis = chat.lastMessageTime?.toMillis?.() ?? 0;
      const lastReadMillis =
        chat.lastReadAt?.[buyerId]?.toMillis?.() ?? 0;
      if (lastMessageMillis > lastReadMillis) unreadIds.add(chat.id);
    }

    return unreadIds;
  }, [buyerId, chats]);

  const markRead = useCallback(
    async (chatId: string) => {
      if (!buyerId) return;
      await markChatRead(chatId, buyerId);
    },
    [buyerId]
  );

  const value = useMemo(
    () => ({ unreadChatIds, markRead }),
    [unreadChatIds, markRead]
  );

  return (
    <BuyerUnreadChatsContext.Provider value={value}>
      {children}
    </BuyerUnreadChatsContext.Provider>
  );
}

export function useBuyerUnreadChats() {
  const context = useContext(BuyerUnreadChatsContext);
  if (!context) {
    throw new Error(
      "useBuyerUnreadChats must be used within BuyerUnreadChatsProvider"
    );
  }
  return context;
}
