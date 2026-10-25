"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  LuArrowLeft,
  LuCheck,
  LuMessageCircle,
  LuSend,
  LuUserPlus,
  LuX,
} from "react-icons/lu";
import type {
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

export default function MessagingPanel({
  api,
  onClose,
  user,
}: {
  api: MessagingApi;
  onClose: () => void;
  user: User | null;
}) {
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const activeFriend = activeFriendId ? api.person(activeFriendId) : null;
  const conversation = api.conversation(activeFriendId);
  const { markConversationRead } = api;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!activeFriendId) return;
    void markConversationRead(activeFriendId);
  }, [activeFriendId, markConversationRead]);

  useEffect(() => {
    if (!activeFriendId || !user) return;
    const hasUnread = api.messages.some(
      (message) =>
        message.recipient_id === user.id &&
        message.sender_id === activeFriendId &&
        !message.read_at,
    );
    if (hasUnread) void markConversationRead(activeFriendId);
  }, [activeFriendId, api.messages, markConversationRead, user]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [activeFriendId, conversation.length]);

  async function handleAddFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setBusy(true);
    try {
      const message = await api.sendFriendRequest(email);
      setNotice(message);
      setEmail("");
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

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeFriendId) return;
    const body = draft.trim();
    if (!body) return;

    setError("");
    setBusy(true);
    try {
      await api.sendMessage(activeFriendId, body);
      setDraft("");
      void api.markConversationRead(activeFriendId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not send the message.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="Messages"
        aria-modal="true"
        className="messenger"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="messenger-head">
          {activeFriend ? (
            <button
              aria-label="Back to friends"
              className="icon-button"
              onClick={() => setActiveFriendId(null)}
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
            <h2>{activeFriend ? activeFriend.name : "Messages"}</h2>
            <p>{activeFriend ? "Live chat" : "Friends and requests"}</p>
          </div>
          <button
            aria-label="Close messages"
            className="icon-button"
            onClick={onClose}
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
        ) : activeFriend && activeFriendId ? (
          <>
            <div className="messenger-thread" ref={threadRef}>
              {conversation.length ? (
                conversation.map((message) => {
                  const mine = message.sender_id === user.id;
                  return (
                    <div
                      className={`bubble${mine ? " mine" : ""}`}
                      key={message.id}
                    >
                      <p>{message.body}</p>
                      <time dateTime={message.created_at}>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  );
                })
              ) : (
                <p className="messenger-hint messenger-thread-empty">
                  No messages yet. Say hello.
                </p>
              )}
            </div>
            <form className="messenger-composer" onSubmit={handleSend}>
              <input
                aria-label={`Message ${activeFriend.name}`}
                className="input"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message..."
                value={draft}
              />
              <button
                className="primary-button"
                disabled={busy || !draft.trim()}
                type="submit"
              >
                <LuSend size={15} />
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="messenger-body">
            <form className="messenger-add" onSubmit={handleAddFriend}>
              <label htmlFor="friend-email">Add a friend by email</label>
              <div className="messenger-add-row">
                <input
                  className="input"
                  id="friend-email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="friend@example.com"
                  required
                  type="email"
                  value={email}
                />
                <button
                  className="primary-button"
                  disabled={busy}
                  type="submit"
                >
                  <LuUserPlus size={15} /> Request
                </button>
              </div>
            </form>

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
              <h3>Friends</h3>
              {api.loading && <p className="messenger-hint">Loading…</p>}
              {!api.loading && api.friends.length === 0 && (
                <p className="messenger-hint">
                  No friends yet. Send a request above.
                </p>
              )}
              {api.friends.map((friend) => {
                const unread = api.unreadByFriend[friend.id] ?? 0;
                return (
                  <button
                    className="messenger-row messenger-friend"
                    key={friend.id}
                    onClick={() => {
                      setActiveFriendId(friend.id);
                      setError("");
                    }}
                    type="button"
                  >
                    <PersonAvatar person={friend} />
                    <div className="messenger-row-main">
                      <strong>{friend.name}</strong>
                      <span>
                        {unread > 0
                          ? `${unread} new message${unread === 1 ? "" : "s"}`
                          : "Open chat"}
                      </span>
                    </div>
                    {unread > 0 && <span className="nav-badge">{unread}</span>}
                  </button>
                );
              })}
            </section>

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
      </section>
    </div>
  );
}
