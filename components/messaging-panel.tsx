"use client";

/* eslint-disable @next/next/no-img-element -- chat images come from Supabase Storage */

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  LuArrowLeft,
  LuCheck,
  LuExternalLink,
  LuImagePlus,
  LuLogOut,
  LuMessageCircle,
  LuMinus,
  LuPencil,
  LuSend,
  LuSettings2,
  LuSmile,
  LuUserPlus,
  LuUsers,
  LuX,
} from "react-icons/lu";
import type {
  ChatMessage,
  ConversationSummary,
  Friendship,
  MessagingApi,
  PersonInfo,
} from "@/components/use-messaging";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "S"
  );
}

function PersonAvatar({ person }: { person: PersonInfo }) {
  return (
    <span
      aria-hidden="true"
      className={`messenger-avatar${person.avatar ? " has-image" : ""}`}
      style={
        person.avatar
          ? { backgroundImage: `url("${person.avatar}")` }
          : undefined
      }
    >
      {!person.avatar && initials(person.name)}
    </span>
  );
}

function GroupAvatar({ title }: { title: string }) {
  return (
    <span aria-hidden="true" className="messenger-avatar group-avatar">
      {initials(title)}
    </span>
  );
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

const CHAT_COLORS = [
  {
    id: "sage",
    label: "Sage",
    bg: "var(--note-sage-bg)",
    fg: "var(--note-sage-accent)",
  },
  {
    id: "sky",
    label: "Sky",
    bg: "var(--note-sky-bg)",
    fg: "var(--note-sky-accent)",
  },
  {
    id: "rose",
    label: "Rose",
    bg: "var(--note-rose-bg)",
    fg: "var(--note-rose-accent)",
  },
  {
    id: "amber",
    label: "Amber",
    bg: "var(--note-amber-bg)",
    fg: "var(--note-amber-accent)",
  },
  {
    id: "violet",
    label: "Violet",
    bg: "var(--note-violet-bg)",
    fg: "var(--note-violet-accent)",
  },
] as const;

type ChatColorId = (typeof CHAT_COLORS)[number]["id"];

const CHAT_COLORS_KEY = "studybook-chat-colors-v1";

const CHAT_EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😎",
  "🤔",
  "😭",
  "🔥",
  "✨",
  "🎉",
  "💀",
  "👻",
  "🎃",
  "❤️",
  "👍",
  "🙏",
  "💯",
  "😅",
  "🫶",
  "🌙",
  "☕",
  "📚",
  "✅",
];

function linkLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("tiktok")) return "TikTok";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("youtu")) return "YouTube";
    if (host === "x.com" || host.includes("twitter")) return "X / Twitter";
    if (host.includes("spotify")) return "Spotify";
    if (host.includes("github")) return "GitHub";
    if (host.includes("pinterest")) return "Pinterest";
    if (host.includes("snapchat")) return "Snapchat";
    return host;
  } catch {
    return url;
  }
}

function MessageBody({ body }: { body: string }) {
  if (!body) return null;
  const parts = body.split(URL_PATTERN);

  return (
    <p>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            className="chat-link"
            href={part}
            key={`${part}-${index}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            <LuExternalLink aria-hidden="true" size={12} />
            <span>{linkLabel(part)}</span>
          </a>
        ) : (
          <span key={`text-${index}`}>{part}</span>
        ),
      )}
    </p>
  );
}

function conversationPreview(conversation: ConversationSummary) {
  if (!conversation.lastMessage) return "No messages yet";
  if (conversation.lastMessage.body) return conversation.lastMessage.body;
  return conversation.lastMessage.attachment_type === "image"
    ? "Sent a picture"
    : "New message";
}

export default function MessagingPanel({
  api,
  minimized,
  onClose,
  onMinimize,
  user,
}: {
  api: MessagingApi;
  minimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  user: User | null;
}) {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [login, setLogin] = useState("");
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsMemberIds, setSettingsMemberIds] = useState<string[]>([]);
  const [chatColor, setChatColor] = useState<ChatColorId>("sage");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConversation = activeConversationId
    ? (api.conversations.find((item) => item.id === activeConversationId) ??
      null)
    : null;
  const thread = api.messagesFor(activeConversationId);
  const { markConversationRead } = api;
  const activeColor =
    CHAT_COLORS.find((color) => color.id === chatColor) ?? CHAT_COLORS[0];
  const addableFriends =
    activeConversation?.kind === "group"
      ? api.friends.filter(
          (friend) =>
            !activeConversation.members.some(
              (member) => member.id === friend.id,
            ),
        )
      : [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettingsOpen(false);
      setEmojiOpen(false);
      setSettingsMemberIds([]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(
          `${CHAT_COLORS_KEY}:${user?.id ?? "guest"}`,
        );
        const saved = raw
          ? (JSON.parse(raw) as Record<string, ChatColorId>)[
              activeConversationId
            ]
          : undefined;
        setChatColor(
          CHAT_COLORS.some((color) => color.id === saved) ? saved! : "sage",
        );
      } catch {
        setChatColor("sage");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeConversationId, user?.id]);

  useEffect(() => {
    if (minimized) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onMinimize();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [minimized, onMinimize]);

  useEffect(() => {
    if (minimized || !activeConversationId) return;
    void markConversationRead(activeConversationId);
  }, [activeConversationId, markConversationRead, minimized]);

  useEffect(() => {
    if (minimized || !activeConversationId) return;
    const hasUnread = thread.some(
      (message) =>
        user &&
        message.sender_id !== user.id &&
        activeConversation?.unread !== 0,
    );
    if (hasUnread) void markConversationRead(activeConversationId);
  }, [
    activeConversation?.unread,
    activeConversationId,
    markConversationRead,
    minimized,
    thread,
    user,
  ]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [activeConversationId, thread.length]);

  async function handleAddFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setBusy(true);
    try {
      const message = await api.sendFriendRequest(login);
      setNotice(message);
      setLogin("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not send the request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(request: Friendship, accept: boolean) {
    setError("");
    try {
      await api.respondToRequest(request, accept);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the request.",
      );
    }
  }

  async function handleOpenFriend(friendId: string) {
    setError("");
    setBusy(true);
    try {
      const conversationId = await api.startDirectChat(friendId);
      setActiveConversationId(conversationId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not open the chat.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (groupMemberIds.length < 2) {
      setError("Pick at least two friends for a group chat.");
      return;
    }

    setBusy(true);
    try {
      const conversationId = await api.createGroup(groupTitle, groupMemberIds);
      setCreatingGroup(false);
      setGroupTitle("");
      setGroupMemberIds([]);
      setActiveConversationId(conversationId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create the group.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setImage(file);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversationId) return;
    if (!draft.trim() && !image) return;

    setError("");
    setBusy(true);
    try {
      await api.sendMessage(activeConversationId, draft, image);
      setDraft("");
      setImage(null);
      setEmojiOpen(false);
      if (fileRef.current) fileRef.current.value = "";
      void api.markConversationRead(activeConversationId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not send the message.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleGroupMember(friendId: string) {
    setGroupMemberIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId],
    );
  }

  function toggleSettingsMember(friendId: string) {
    setSettingsMemberIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId],
    );
  }

  function chooseChatColor(id: ChatColorId) {
    setChatColor(id);
    if (!activeConversationId) return;
    try {
      const key = `${CHAT_COLORS_KEY}:${user?.id ?? "guest"}`;
      const raw = window.localStorage.getItem(key);
      const map = raw ? (JSON.parse(raw) as Record<string, ChatColorId>) : {};
      map[activeConversationId] = id;
      window.localStorage.setItem(key, JSON.stringify(map));
    } catch {
      // Device-local preference only; ignore storage failures.
    }
  }

  function insertEmoji(emoji: string) {
    setDraft((current) => `${current}${emoji}`);
    setEmojiOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function openSettings() {
    if (!activeConversation) return;
    setSettingsOpen(true);
    setSettingsTitle(activeConversation.title);
    setSettingsMemberIds([]);
    setNotice("");
    setError("");
    setEmojiOpen(false);
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversationId) return;
    const nextTitle = settingsTitle.trim();
    if (!nextTitle) {
      setError("Give the group a name first.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.renameGroup(activeConversationId, nextTitle);
      setNotice("Group name updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not rename the group.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMembers() {
    if (!activeConversationId || settingsMemberIds.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.addGroupMembers(activeConversationId, settingsMemberIds);
      setSettingsMemberIds([]);
      setNotice("Friends added to the group.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not add those friends.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!activeConversationId) return;
    if (
      !window.confirm(
        activeConversation?.kind === "group"
          ? "Leave this group? You will stop receiving its messages."
          : "Leave this chat? Messaging the person again will reopen it.",
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api.leaveConversation(activeConversationId);
      setActiveConversationId(null);
      setSettingsOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not leave the chat.",
      );
    } finally {
      setBusy(false);
    }
  }

  const title = creatingGroup
    ? "New group"
    : activeConversation
      ? settingsOpen
        ? "Chat settings"
        : activeConversation.title
      : "Messages";

  return (
    <aside
      aria-label="Messages"
      className={`messenger messenger-docked${minimized ? " is-minimized" : ""}`}
      style={
        {
          "--chat-bubble-bg": activeColor.bg,
          "--chat-bubble-fg": activeColor.fg,
        } as CSSProperties
      }
    >
      <header className="messenger-head">
        {creatingGroup || activeConversation ? (
          <button
            aria-label="Back"
            className="icon-button"
            onClick={() => {
              if (settingsOpen) {
                setSettingsOpen(false);
              } else if (creatingGroup) {
                setCreatingGroup(false);
                setGroupTitle("");
                setGroupMemberIds([]);
              } else {
                setActiveConversationId(null);
              }
              setError("");
            }}
            type="button"
          >
            <LuArrowLeft size={17} />
          </button>
        ) : (
          <span className="messenger-mark">
            <LuMessageCircle size={18} />
          </span>
        )}
        <div className="messenger-title">
          <h2>{title}</h2>
          <p>
            {creatingGroup
              ? "Choose friends to add"
              : activeConversation
                ? settingsOpen
                  ? "Colours, members and more"
                  : activeConversation.kind === "group"
                    ? `${activeConversation.members.length + 1} members`
                    : "Direct message"
                : "Chats, friends and requests"}
          </p>
        </div>
        {activeConversation && !creatingGroup && (
          <button
            aria-label="Chat settings"
            aria-pressed={settingsOpen}
            className="icon-button"
            onClick={() => {
              if (settingsOpen) {
                setSettingsOpen(false);
              } else {
                openSettings();
              }
            }}
            type="button"
          >
            <LuSettings2 size={16} />
          </button>
        )}
        <button
          aria-label="Minimize messages"
          className="icon-button"
          onClick={onMinimize}
          title="Minimize"
          type="button"
        >
          <LuMinus size={17} />
        </button>
        <button
          aria-label="Close messages"
          className="icon-button"
          onClick={onClose}
          title="Close"
          type="button"
        >
          <LuX size={17} />
        </button>
      </header>

      {!api.configured ? (
        <div className="messenger-empty">
          <LuMessageCircle size={28} />
          <p>Messaging needs Supabase credentials.</p>
          <p className="messenger-hint">
            Add NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.
          </p>
        </div>
      ) : !user ? (
        <div className="messenger-empty">
          <LuMessageCircle size={28} />
          <p>Sign in to send friend requests and messages.</p>
          <p className="messenger-hint">
            Use the Register or Sign in button in the top bar.
          </p>
        </div>
      ) : creatingGroup ? (
        <form className="messenger-body" onSubmit={handleCreateGroup}>
          <div className="field">
            <label htmlFor="group-title">Group name</label>
            <input
              autoFocus
              className="input"
              id="group-title"
              maxLength={80}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="e.g. Biology study group"
              required
              value={groupTitle}
            />
          </div>

          <section className="messenger-section">
            <h3>Add friends</h3>
            {api.friends.length === 0 && (
              <p className="messenger-hint">
                You need friends first — add someone by email below.
              </p>
            )}
            {api.friends.map((friend) => (
              <label className="group-member" key={friend.id}>
                <input
                  checked={groupMemberIds.includes(friend.id)}
                  onChange={() => toggleGroupMember(friend.id)}
                  type="checkbox"
                />
                <PersonAvatar person={friend} />
                <span>{friend.name}</span>
              </label>
            ))}
          </section>

          {error && <p className="notice">{error}</p>}

          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setCreatingGroup(false);
                setGroupMemberIds([]);
                setGroupTitle("");
                setError("");
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={busy || !groupTitle.trim()}
              type="submit"
            >
              <LuUsers size={15} /> Create group
            </button>
          </div>
        </form>
      ) : activeConversation && activeConversationId ? (
        settingsOpen ? (
          <div className="messenger-body messenger-settings">
            <section className="messenger-section">
              <div className="messenger-section-head">
                <h3>Chat colour</h3>
                <span className="messenger-hint">Saved on this device</span>
              </div>
              <div className="chat-color-choices">
                {CHAT_COLORS.map((color) => (
                  <button
                    aria-pressed={chatColor === color.id}
                    className={`chat-color${chatColor === color.id ? " selected" : ""}`}
                    key={color.id}
                    onClick={() => chooseChatColor(color.id)}
                    style={{ background: color.bg, color: color.fg }}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="chat-color-dot"
                      style={{ background: color.fg }}
                    />
                    {color.label}
                  </button>
                ))}
              </div>
            </section>

            {activeConversation.kind === "group" && (
              <>
                <section className="messenger-section">
                  <h3>Group name</h3>
                  <form
                    className="messenger-inline-form"
                    onSubmit={handleRename}
                  >
                    <input
                      className="input"
                      maxLength={80}
                      onChange={(event) => setSettingsTitle(event.target.value)}
                      value={settingsTitle}
                    />
                    <button
                      className="secondary-button"
                      disabled={busy || !settingsTitle.trim()}
                      type="submit"
                    >
                      <LuPencil size={14} /> Rename
                    </button>
                  </form>
                </section>

                <section className="messenger-section">
                  <h3>Add friends</h3>
                  {addableFriends.length === 0 ? (
                    <p className="messenger-hint">
                      Everyone you can add is already in this group.
                    </p>
                  ) : (
                    <>
                      {addableFriends.map((friend) => (
                        <label className="group-member" key={friend.id}>
                          <input
                            checked={settingsMemberIds.includes(friend.id)}
                            onChange={() => toggleSettingsMember(friend.id)}
                            type="checkbox"
                          />
                          <PersonAvatar person={friend} />
                          <span>{friend.name}</span>
                        </label>
                      ))}
                      <button
                        className="secondary-button"
                        disabled={busy || settingsMemberIds.length === 0}
                        onClick={handleAddMembers}
                        type="button"
                      >
                        <LuUserPlus size={14} /> Add selected
                      </button>
                    </>
                  )}
                </section>
              </>
            )}

            <section className="messenger-section">
              <h3>Leave chat</h3>
              <p className="messenger-hint">
                {activeConversation.kind === "group"
                  ? "You will stop receiving this group's messages. A friend can add you back."
                  : "This removes the chat from your list. Messaging the person again reopens it."}
              </p>
              <button
                className="danger-button"
                disabled={busy}
                onClick={handleLeave}
                type="button"
              >
                <LuLogOut size={14} /> Leave{" "}
                {activeConversation.kind === "group" ? "group" : "chat"}
              </button>
            </section>

            {notice && <p className="notice success-notice">{notice}</p>}
            {error && <p className="notice">{error}</p>}
          </div>
        ) : (
          <>
            <div className="messenger-thread" ref={threadRef}>
              {thread.length === 0 && (
                <p className="messenger-hint messenger-thread-empty">
                  No messages yet. Say hello.
                </p>
              )}
              {thread.map((message: ChatMessage) => {
                const mine = message.sender_id === user.id;
                return (
                  <div
                    className={`bubble${mine ? " mine" : ""}`}
                    key={message.id}
                  >
                    {activeConversation.kind === "group" && !mine && (
                      <span className="bubble-sender">
                        {api.person(message.sender_id).name}
                      </span>
                    )}
                    {message.attachment_type === "image" &&
                      message.attachment_url && (
                        <a
                          className="bubble-image-link"
                          href={message.attachment_url}
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          <img
                            alt="Shared attachment"
                            className="bubble-image"
                            loading="lazy"
                            src={message.attachment_url}
                          />
                        </a>
                      )}
                    <MessageBody body={message.body} />
                    <time dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                );
              })}
            </div>

            {error && <p className="notice messenger-notice">{error}</p>}

            <form className="messenger-composer" onSubmit={handleSend}>
              <label className="composer-attach" title="Attach a picture">
                <LuImagePlus size={18} />
                <input
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageChange}
                  ref={fileRef}
                  type="file"
                />
              </label>
              <div className="composer-emoji">
                <button
                  aria-expanded={emojiOpen}
                  aria-label="Add an emoji"
                  className="composer-emoji-button"
                  onClick={() => setEmojiOpen((current) => !current)}
                  type="button"
                >
                  <LuSmile size={18} />
                </button>
                {emojiOpen && (
                  <div aria-label="Emoji picker" className="emoji-popover">
                    {CHAT_EMOJIS.map((emoji) => (
                      <button
                        aria-label={`Insert ${emoji}`}
                        className="emoji-choice"
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="composer-input">
                <input
                  aria-label={`Message ${activeConversation.title}`}
                  className="input"
                  maxLength={2000}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message or paste a link..."
                  ref={inputRef}
                  value={draft}
                />
                {image && (
                  <span className="attachment-chip">
                    {image.name}
                    <button
                      aria-label="Remove picture"
                      onClick={() => {
                        setImage(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      type="button"
                    >
                      <LuX size={12} />
                    </button>
                  </span>
                )}
              </div>
              <button
                className="primary-button"
                disabled={busy || (!draft.trim() && !image)}
                type="submit"
              >
                <LuSend size={15} />
                Send
              </button>
            </form>
          </>
        )
      ) : (
        <div className="messenger-body">
          {notice && <p className="notice success-notice">{notice}</p>}
          {error && <p className="notice">{error}</p>}
          {api.error && <p className="notice">{api.error}</p>}

          {api.incomingRequests.length > 0 && (
            <section className="messenger-section">
              <h3>Friend requests</h3>
              {api.incomingRequests.map((request) => {
                const person = api.person(request.requester_id);
                return (
                  <div className="messenger-row" key={request.id}>
                    <PersonAvatar person={person} />
                    <div className="messenger-row-main">
                      <strong>{person.name}</strong>
                      <span>wants to be friends</span>
                    </div>
                    <div className="messenger-row-actions">
                      <button
                        aria-label={`Accept ${person.name}`}
                        className="icon-button messenger-accept"
                        onClick={() => handleRespond(request, true)}
                        type="button"
                      >
                        <LuCheck size={16} />
                      </button>
                      <button
                        aria-label={`Decline ${person.name}`}
                        className="icon-button messenger-decline"
                        onClick={() => handleRespond(request, false)}
                        type="button"
                      >
                        <LuX size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <section className="messenger-section">
            <div className="messenger-section-head">
              <h3>Chats</h3>
              <button
                className="text-button"
                onClick={() => {
                  setCreatingGroup(true);
                  setError("");
                }}
                type="button"
              >
                + New group
              </button>
            </div>
            {api.loading && <p className="messenger-hint">Loading…</p>}
            {!api.loading && api.conversations.length === 0 && (
              <p className="messenger-hint">
                No chats yet. Start one from your friends below.
              </p>
            )}
            {api.conversations.map((conversation) => (
              <button
                className="messenger-row"
                key={conversation.id}
                onClick={() => {
                  setActiveConversationId(conversation.id);
                  setError("");
                }}
                type="button"
              >
                {conversation.kind === "group" ? (
                  <GroupAvatar title={conversation.title} />
                ) : (
                  <PersonAvatar
                    person={
                      conversation.members[0] ?? {
                        id: conversation.id,
                        name: conversation.title,
                        avatar: conversation.avatar,
                      }
                    }
                  />
                )}
                <div className="messenger-row-main">
                  <strong>{conversation.title}</strong>
                  <span>{conversationPreview(conversation)}</span>
                </div>
                {conversation.unread > 0 && (
                  <span className="nav-badge">{conversation.unread}</span>
                )}
              </button>
            ))}
          </section>

          <section className="messenger-section">
            <h3>Friends</h3>
            {api.friends.length === 0 && (
              <p className="messenger-hint">
                No friends yet. Send a request below.
              </p>
            )}
            {api.friends.map((friend) => (
              <button
                className="messenger-row"
                disabled={busy}
                key={friend.id}
                onClick={() => handleOpenFriend(friend.id)}
                type="button"
              >
                <PersonAvatar person={friend} />
                <div className="messenger-row-main">
                  <strong>{friend.name}</strong>
                  <span>Message</span>
                </div>
              </button>
            ))}
          </section>

          <form className="messenger-add" onSubmit={handleAddFriend}>
            <label htmlFor="friend-login">
              Add a friend by email or username
            </label>
            <div className="messenger-add-row">
              <input
                className="input"
                id="friend-login"
                onChange={(event) => setLogin(event.target.value)}
                placeholder="friend@example.com or alex_student"
                required
                type="text"
                value={login}
              />
              <button className="primary-button" disabled={busy} type="submit">
                <LuUserPlus size={15} /> Request
              </button>
            </div>
          </form>

          {api.outgoingRequests.length > 0 && (
            <section className="messenger-section">
              <h3>Sent requests</h3>
              {api.outgoingRequests.map((request) => {
                const person = api.person(request.addressee_id);
                return (
                  <div className="messenger-row" key={request.id}>
                    <PersonAvatar person={person} />
                    <div className="messenger-row-main">
                      <strong>{person.name}</strong>
                      <span>Waiting for a reply</span>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
