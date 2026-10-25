"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  User,
} from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type PersonInfo = {
  id: string;
  name: string;
  avatar: string;
};

export type MessagingApi = {
  configured: boolean;
  signedIn: boolean;
  loading: boolean;
  error: string;
  incomingRequests: Friendship[];
  outgoingRequests: Friendship[];
  friends: PersonInfo[];
  messages: ChatMessage[];
  totalUnread: number;
  unreadByFriend: Record<string, number>;
  person: (id: string) => PersonInfo;
  conversation: (friendId: string | null) => ChatMessage[];
  refresh: () => Promise<void>;
  sendFriendRequest: (email: string) => Promise<string>;
  respondToRequest: (request: Friendship, accept: boolean) => Promise<void>;
  sendMessage: (recipientId: string, body: string) => Promise<void>;
  markConversationRead: (friendId: string) => Promise<void>;
};

export function useMessaging(user: User | null): MessagingApi {
  const configured = isSupabaseConfigured();
  const userId = user?.id ?? "";

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [people, setPeople] = useState<Record<string, PersonInfo>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const knownPeople = useRef<Set<string>>(new Set());

  const loadPeople = useCallback(
    async (ids: string[]) => {
      if (!configured || ids.length === 0) return;
      const supabase = getSupabaseBrowserClient();
      const { data, error: peopleError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      if (peopleError || !data) return;

      for (const id of ids) knownPeople.current.add(id);

      setPeople((current) => {
        const next = { ...current };
        for (const row of data as Array<{
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        }>) {
          next[row.id] = {
            id: row.id,
            name: row.display_name?.trim() || "Studybook student",
            avatar: row.avatar_url ?? "",
          };
        }
        return next;
      });
    },
    [configured],
  );

  const refresh = useCallback(async () => {
    if (!configured || !userId) return;

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const [friendshipResult, messageResult] = await Promise.all([
        supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("messages")
          .select("id, sender_id, recipient_id, body, created_at, read_at")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (friendshipResult.error) throw friendshipResult.error;
      if (messageResult.error) throw messageResult.error;

      const nextFriendships = (friendshipResult.data ?? []) as Friendship[];
      const nextMessages = (
        (messageResult.data ?? []) as ChatMessage[]
      ).reverse();

      setFriendships(nextFriendships);
      setMessages(nextMessages);

      const ids = new Set<string>();
      for (const row of nextFriendships) {
        ids.add(row.requester_id);
        ids.add(row.addressee_id);
      }
      for (const row of nextMessages) {
        ids.add(row.sender_id);
        ids.add(row.recipient_id);
      }
      ids.delete(userId);
      await loadPeople([...ids]);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load your messages.",
      );
    } finally {
      setLoading(false);
    }
  }, [configured, loadPeople, userId]);

  useEffect(() => {
    if (!configured || !userId) return;

    const initialLoad = window.setTimeout(() => {
      void refresh();
    }, 0);

    const supabase = getSupabaseBrowserClient();
    const channel: RealtimeChannel = supabase
      .channel(`studybook-messaging-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<ChatMessage>) => {
          const row = payload.new as ChatMessage;
          setMessages((current) =>
            current.some((message) => message.id === row.id)
              ? current
              : [...current, row],
          );
          if (!knownPeople.current.has(row.sender_id)) {
            void loadPeople([row.sender_id]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `requester_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [configured, loadPeople, refresh, userId]);

  const person = useCallback(
    (id: string): PersonInfo =>
      people[id] ?? { id, name: "Studybook student", avatar: "" },
    [people],
  );

  const friends = useMemo(() => {
    const result: PersonInfo[] = [];
    const seen = new Set<string>();
    for (const row of friendships) {
      if (row.status !== "accepted") continue;
      const other = row.requester_id === userId ? row.addressee_id : row.requester_id;
      if (seen.has(other)) continue;
      seen.add(other);
      result.push(person(other));
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [friendships, person, userId]);

  const incomingRequests = useMemo(
    () =>
      friendships.filter(
        (row) => row.status === "pending" && row.addressee_id === userId,
      ),
    [friendships, userId],
  );

  const outgoingRequests = useMemo(
    () =>
      friendships.filter(
        (row) => row.status === "pending" && row.requester_id === userId,
      ),
    [friendships, userId],
  );

  const unreadByFriend = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const message of messages) {
      if (message.recipient_id !== userId || message.read_at) continue;
      counts[message.sender_id] = (counts[message.sender_id] ?? 0) + 1;
    }
    return counts;
  }, [messages, userId]);

  const totalUnread = useMemo(
    () =>
      userId
        ? Object.values(unreadByFriend).reduce(
            (total, count) => total + count,
            0,
          )
        : 0,
    [unreadByFriend, userId],
  );

  const conversation = useCallback(
    (friendId: string | null) => {
      if (!friendId) return [];
      return messages.filter(
        (message) =>
          (message.sender_id === userId && message.recipient_id === friendId) ||
          (message.sender_id === friendId && message.recipient_id === userId),
      );
    },
    [messages, userId],
  );

  const sendFriendRequest = useCallback(
    async (email: string) => {
      if (!configured || !userId) throw new Error("Sign in to add friends.");
      const target = email.trim();
      if (!target) throw new Error("Enter the email they used to sign up.");

      const supabase = getSupabaseBrowserClient();
      const { data, error: lookupError } = await supabase.rpc(
        "find_user_by_email",
        { target_email: target },
      );
      if (lookupError) throw lookupError;

      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const found = rows[0] as
        | { id: string; display_name: string | null }
        | undefined;
      if (!found?.id) throw new Error("No Studybook account uses that email.");
      if (found.id === userId) throw new Error("That is your own account.");

      const { error: insertError } = await supabase.from("friendships").insert({
        requester_id: userId,
        addressee_id: found.id,
        status: "pending",
      });
      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error("You already have a request or friendship with them.");
        }
        throw insertError;
      }

      await refresh();
      return `Request sent to ${found.display_name?.trim() || target}.`;
    },
    [configured, refresh, userId],
  );

  const respondToRequest = useCallback(
    async (request: Friendship, accept: boolean) => {
      if (!configured || !userId) return;
      const supabase = getSupabaseBrowserClient();

      if (accept) {
        const { error: updateError } = await supabase
          .from("friendships")
          .update({
            status: "accepted",
            responded_at: new Date().toISOString(),
          })
          .eq("id", request.id);
        if (updateError) throw updateError;
      } else {
        // Removing the row lets either side send a fresh request later.
        const { error: deleteError } = await supabase
          .from("friendships")
          .delete()
          .eq("id", request.id);
        if (deleteError) throw deleteError;
      }

      await refresh();
    },
    [configured, refresh, userId],
  );

  const sendMessage = useCallback(
    async (recipientId: string, body: string) => {
      if (!configured || !userId) throw new Error("Sign in to send messages.");
      const text = body.trim();
      if (!text) return;

      const supabase = getSupabaseBrowserClient();
      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({ sender_id: userId, recipient_id: recipientId, body: text })
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .single();
      if (insertError) throw insertError;

      if (data) {
        const row = data as ChatMessage;
        setMessages((current) =>
          current.some((message) => message.id === row.id)
            ? current
            : [...current, row],
        );
      }
    },
    [configured, userId],
  );

  const markConversationRead = useCallback(
    async (friendId: string) => {
      if (!configured || !userId) return;

      const readAt = new Date().toISOString();
      setMessages((current) => {
        let changed = false;
        const next = current.map((message) => {
          if (
            message.recipient_id === userId &&
            message.sender_id === friendId &&
            !message.read_at
          ) {
            changed = true;
            return { ...message, read_at: readAt };
          }
          return message;
        });
        return changed ? next : current;
      });

      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("messages")
        .update({ read_at: readAt })
        .eq("recipient_id", userId)
        .eq("sender_id", friendId)
        .is("read_at", null);
      if (updateError) {
        setError(updateError.message);
      }
    },
    [configured, userId],
  );

  return {
    configured,
    signedIn: Boolean(userId),
    loading,
    error,
    incomingRequests,
    outgoingRequests,
    friends,
    messages,
    totalUnread,
    unreadByFriend,
    person,
    conversation,
    refresh,
    sendFriendRequest,
    respondToRequest,
    sendMessage,
    markConversationRead,
  };
}
