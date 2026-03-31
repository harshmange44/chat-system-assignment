import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ChatMessage,
  ConversationSummary,
  ProfilePublic,
  TypingEvent,
  OnlineStatusEvent,
} from "@chat-system/shared-types";
import { GENERAL_CONVERSATION_ID } from "@chat-system/shared-types";
import type { AuthSession } from "./lib/auth-session";
import { clearSession, loadStoredSession, saveSession } from "./lib/auth-session";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [meProfile, setMeProfile] = useState<ProfilePublic | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>(GENERAL_CONVERSATION_ID);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  /** TCP connected + server finished async auth (`handleConnection`). */
  const [socketReady, setSocketReady] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProfilePublic[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const currentUserId = session?.user.id ?? "";

  useEffect(() => {
    const stored = loadStoredSession();
    if (!stored) {
      setSessionRestored(true);
      return;
    }
    void fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored.accessToken}` },
    }).then(async (res) => {
      if (!res.ok) {
        clearSession();
        setSessionRestored(true);
        return;
      }
      const data = (await res.json()) as { id: string; email: string | null };
      setSession({
        accessToken: stored.accessToken,
        user: { id: data.id, email: data.email ?? "" },
      });
      setSessionRestored(true);
    });
  }, []);

  useEffect(() => {
    if (!session) {
      setMeProfile(null);
      return;
    }
    void fetch(`${API_URL}/profiles/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).then(async (res) => {
      if (!res.ok) return;
      setMeProfile((await res.json()) as ProfilePublic);
    });
  }, [session]);

  const loadConversations = useCallback(async () => {
    if (!session) return;
    const res = await fetch(`${API_URL}/conversations`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as ConversationSummary[];
    setConversations(data);
  }, [session]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!session) return;
    const socket = io(API_URL, {
      transports: ["websocket"],
      auth: { accessToken: session.accessToken },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSocketReady(false);
    });
    socket.on("session:ready", () => setSocketReady(true));
    socket.on("auth:error", () => setSocketReady(false));
    socket.on("disconnect", () => {
      setConnected(false);
      setSocketReady(false);
      setOnlineUserIds(new Set());
    });
    socket.on("online:sync", ({ userIds }: { userIds: string[] }) => {
      setOnlineUserIds(new Set(userIds));
    });
    socket.on("user:online", ({ userId }: OnlineStatusEvent) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    });
    socket.on("user:offline", ({ userId }: OnlineStatusEvent) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });
    socket.on("room:history", (payload: { conversationId: string; messages: ChatMessage[] }) => {
      if (payload.conversationId !== selectedIdRef.current) return;
      setMessages(payload.messages);
    });
    socket.on("message:new", (msg: ChatMessage) => {
      if (msg.conversationId !== selectedIdRef.current) return;
      setMessages((prev) => [...prev, msg]);
    });
    socket.on("typing:update", (evt: TypingEvent) => {
      if (evt.conversationId !== selectedIdRef.current) return;
      setTypingUsers((prev) => {
        const copy = { ...prev };
        if (!evt.isTyping || evt.userId === currentUserId) delete copy[evt.userId];
        else copy[evt.userId] = evt.userName;
        return copy;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, session]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socketReady) return;
    setMessages([]);
    setTypingUsers({});
    socket.emit("room:join", { conversationId: selectedId });
  }, [socketReady, selectedId]);

  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return "";
    if (names.length === 1) return `${names[0]} is typing...`;
    return `${names.length} people are typing...`;
  }, [typingUsers]);

  function sendTyping(isTyping: boolean) {
    socketRef.current?.emit("typing:set", { conversationId: selectedId, isTyping });
  }

  function onDraftChange(value: string) {
    setDraft(value);
    sendTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(false), 1000);
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    socketRef.current?.emit("message:send", { conversationId: selectedId, content });
    setDraft("");
    sendTyping(false);
    void loadConversations();
  }

  async function signIn() {
    setAuthError("");
    setAuthLoading(true);
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
    });
    setAuthLoading(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      const msg = err?.message;
      setAuthError(Array.isArray(msg) ? msg.join(", ") : msg ?? "Sign in failed");
      return;
    }
    const data = (await res.json()) as AuthSession;
    saveSession(data);
    setSession(data);
  }

  async function signUp() {
    const name = fullName.trim();
    if (!name) {
      setAuthError("Please enter your full name.");
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: authEmail.trim(),
        password: authPassword,
        displayName: name,
      }),
    });
    setAuthLoading(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      const msg = err?.message;
      setAuthError(Array.isArray(msg) ? msg.join(", ") : msg ?? "Sign up failed");
      return;
    }
    const data = (await res.json()) as AuthSession;
    saveSession(data);
    setSession(data);
  }

  function signOut() {
    clearSession();
    setSession(null);
    setMessages([]);
    setTypingUsers({});
    setOnlineUserIds(new Set());
    setConversations([]);
    setMeProfile(null);
  }

  useEffect(() => {
    if (!newChatOpen || !session || searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const res = await fetch(
        `${API_URL}/profiles/search?q=${encodeURIComponent(searchQ.trim())}&limit=15`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      if (!res.ok) return;
      const rows = (await res.json()) as ProfilePublic[];
      setSearchResults(rows.filter((p) => p.id !== session.user.id));
    }, 250);
    return () => window.clearTimeout(t);
  }, [newChatOpen, searchQ, session]);

  async function startDm(peer: ProfilePublic) {
    if (!session) return;
    const res = await fetch(`${API_URL}/conversations/dm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ peerUserId: peer.id }),
    });
    if (!res.ok) return;
    const summary = (await res.json()) as ConversationSummary;
    setNewChatOpen(false);
    setSearchQ("");
    await loadConversations();
    setSelectedId(summary.id);
  }

  const selectedTitle = useMemo(() => {
    const c = conversations.find((x) => x.id === selectedId);
    if (!c) return "Chat";
    if (c.kind === "channel") return c.title ?? "General";
    return c.peer?.displayName ?? "Direct message";
  }, [conversations, selectedId]);

  if (!sessionRestored) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-xl backdrop-blur">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mb-6 text-sm text-zinc-400">
            Account is managed by this app (no email provider rate limits). Use a strong password.
          </p>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              placeholder="Password (min 8 characters)"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              autoComplete="current-password"
            />
            <input
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              placeholder="Full name (required for sign up)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            {authError ? <p className="text-sm text-rose-400">{authError}</p> : null}
            <div className="flex gap-2 pt-2">
              <button
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                onClick={() => void signIn()}
                disabled={authLoading}
                type="button"
              >
                Sign in
              </button>
              <button
                className="flex-1 rounded-xl border border-zinc-600 py-2.5 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                onClick={() => void signUp()}
                disabled={authLoading}
                type="button"
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 bg-zinc-950 text-zinc-100">
      <aside className="flex w-full max-w-[340px] flex-col border-r border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Chats</h1>
            <p className="text-xs text-zinc-500">
              {connected && socketReady ? "Connected" : "Connecting…"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium hover:bg-emerald-600"
            onClick={() => setNewChatOpen((v) => !v)}
          >
            New chat
          </button>
        </div>

        {newChatOpen ? (
          <div className="border-b border-zinc-800 p-3">
            <input
              className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="Search people by name…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <ul className="max-h-40 overflow-auto text-sm">
              {searchResults.map((p) => {
                const isOnline = onlineUserIds.has(p.id);
                return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-zinc-800 transition"
                    onClick={() => void startDm(p)}
                  >
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                      {p.displayName.slice(0, 1).toUpperCase()}
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-emerald-500" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{p.displayName}</span>
                      {p.email ? <span className="truncate text-xs text-zinc-500">{p.email}</span> : null}
                    </div>
                  </button>
                </li>
              )})}
            </ul>
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto py-2">
          {conversations.map((c) => {
            const label =
              c.kind === "channel" ? (c.title ?? "General") : (c.peer?.displayName ?? "Message");
            const active = c.id === selectedId;
            const isPeerOnline = c.kind === "dm" && c.peer && onlineUserIds.has(c.peer.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                  active ? "bg-zinc-800/80" : "hover:bg-zinc-800/40"
                }`}
              >
                <div className="relative">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-900/60 text-sm font-semibold text-emerald-200">
                    {label.slice(0, 1).toUpperCase()}
                  </span>
                  {isPeerOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-900 bg-emerald-500"></span>
                  )}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{label}</span>
                  {c.kind === "dm" && c.peer?.displayName ? (
                    <span className="block truncate text-xs text-zinc-500">Direct message</span>
                  ) : (
                    <span className="block truncate text-xs text-zinc-500">Everyone</span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
          <div className="mb-2 truncate text-zinc-300">
            {meProfile?.displayName ?? session.user.email}
          </div>
          <button
            type="button"
            className="text-zinc-400 underline hover:text-zinc-200"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-zinc-950">
        <header className="border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold">{selectedTitle}</h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {messages.map((msg) => {
              const mine = msg.userId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      mine
                        ? "rounded-br-md bg-emerald-700 text-white"
                        : "rounded-bl-md bg-zinc-800 text-zinc-100"
                    }`}
                  >
                    <div
                      className={`mb-1 text-xs font-semibold ${
                        mine ? "text-emerald-200/90" : "text-emerald-400"
                      }`}
                    >
                      {msg.userName}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <div className={`mt-1 text-[10px] ${mine ? "text-emerald-200/80" : "text-zinc-500"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="mx-auto max-w-3xl min-h-5 text-sm text-emerald-400/90">{typingLabel}</div>
          <form className="mx-auto flex max-w-3xl gap-2" onSubmit={onSend}>
            <input
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-600 disabled:opacity-50"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Message"
              disabled={!socketReady}
            />
            <button
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              type="submit"
              disabled={!socketReady}
            >
              Send
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
