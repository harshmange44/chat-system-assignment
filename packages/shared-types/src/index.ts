/** Default channel shown to everyone (no per-user membership row). */
export const GENERAL_CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";

export type ChatMessage = {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
};

export type TypingEvent = {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
};

export type OnlineStatusEvent = {
  userId: string;
  isOnline: boolean;
};

export type ClientUser = {
  userId: string;
  userName: string;
};

/** Searchable public profile (API returns this shape). */
export type ProfilePublic = {
  id: string;
  displayName: string;
  email: string | null;
  createdAt?: string;
  updatedAt?: string;
  isOnline?: boolean;
};

export type ConversationKind = "dm" | "group" | "channel";

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  /** For DMs: the other participant’s profile id and display name. */
  peer?: { id: string; displayName: string; isOnline?: boolean; email?: string | null } | null;
  lastMessageAt: string | null;
};
