// src/types/notification.ts

export type NotificationKind = "order" | "message" | "payment" | "system";

export type NotificationType = {
  id: string;
  farmerId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  orderId?: string | null;
  chatId?: string | null;
  amount?: number | null;
  read: boolean;
  createdAt: any;
};

export type NotificationSettings = {
  email: boolean;
  inApp: boolean;
  updates: boolean;
};
