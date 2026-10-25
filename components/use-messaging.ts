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

export type ConversationKind = "direct" | "group";

export type ConversationRow = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  created_by: string;
  created_at: string;
};

export type ConversationMember = {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: "image" | null;
  created_at: string;
};

export type PersonInfo = {
  id: string;
  name: string;
  avatar: string;
};

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  title: string;
  avatar: string;
  members: PersonInfo[];
  unread: number;
  lastMessage: ChatMessage | null;
  updatedAt: string;
};

export type MessagingApi = {
  configured: boolean;
  signedIn: boolean;
  loading: boolean;
  error: string;
  incomingRequests: Friendship[];
  outgoingRequests: Friendship[];
  friends: PersonInfo[];
  conversations: ConversationSummary[];
  totalUnread: number;
  person: (id: string) => PersonInfo;
  messagesFor: (conversationId: string | null) => ChatMessage[];
  refresh: () => Promise<void>;
  sendFriendRequest: (email: string) => Promise<string>;
  respondToRequest: (request: Friendship, accept: boolean) => Promise<void>;
  startDirectChat: (friendId: string) => Promise<string>;
  createGroup: (title: string, memberIds: string[]) => Promise<string>;
  sendMessage: (
    conversationId: string,
    body: string,
    image?: File | null,
  ) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
};

export function useMessaging(user: User | null): MessagingApi {
  const configured = isSupabaseConfigured();
  const userId = user?.id ?? "";

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
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
      const [friendResult, conversationResult, memberResult, messageResult] =
        await Promise.all([
          supabase
            .from("friendships")
            .select("id, requester_id, addressee_id, status, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("conversations")
            .select("id, kind, title, created_by, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("conversation_members")
            .select("conversation_id, user_id, joined_at, last_read_at"),
          supabase
            .from("messages")
            .select(
              "id, conversation_id, sender_id, body, attachment_url, attachment_type, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(500),
        ]);

      if (friendResult.error) throw friendResult.error;
      if (conversationResult.error) throw conversationResult.error;
      if (memberResult.error) throw memberResult.error;
      if (messageResult.error) throw messageResult.error;

      const nextFriendships = (friendResult.data ?? []) as Friendship[];
      const nextConversations = (conversationResult.data ??
        []) as ConversationRow[];
      const nextMembers = (memberResult.data ?? []) as ConversationMember[];
      const nextMessages = (
        (messageResult.data ?? []) as ChatMessage[]
      ).reverse();

      setFriendships(nextFriendships);
      setConversations(nextConversations);
      setMembers(nextMembers);
      setMessages(nextMessages);

      const ids = new Set<string>();
      for (const row of nextFriendships) {
        ids.add(row.requester_id);
        ids.add(row.addressee_id);
      }
      for (const row of nextMembers) ids.add(row.user_id);
      for (const row of nextMessages) ids.add(row.sender_id);
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
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: RealtimePostgresChangesPayload<ChatMessage>) => {
          const row = payload.new as ChatMessage;
          setMessages((current) =>
            current.some((message) => message.id === row.id)
              ? current
              : [...current, row],
          );
          if (row.sender_id !== userId && !knownPeople.current.has(row.sender_id)) {
            void loadPeople([row.sender_id]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friendships" },
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
      const other =
        row.requester_id === userId ? row.addressee_id : row.requester_id;
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

  const conversationsView = useMemo(() => {
    const result: ConversationSummary[] = conversations.map((conversation) => {
      const conversationMembers = members.filter(
        (member) => member.conversation_id === conversation.id,
      );
      const mine = conversationMembers.find(
        (member) => member.user_id === userId,
      );
      const others = conversationMembers
        .filter((member) => member.user_id !== userId)
        .map((member) => person(member.user_id));
      const conversationMessages = messages.filter(
        (message) => message.conversation_id === conversation.id,
      );
      const lastMessage =
        conversationMessages[conversationMessages.length - 1] ?? null;
      const unread = mine
        ? conversationMessages.filter(
            (message) =>
              message.sender_id !== userId &&
              (!mine.last_read_at ||
                new Date(message.created_at).getTime() >
                  new Date(mine.last_read_at).getTime()),
          ).length
        : 0;

      const title =
        conversation.kind === "group"
          ? conversation.title?.trim() || "Group chat"
          : others[0]?.name ?? "Direct chat";

      return {
        id: conversation.id,
        kind: conversation.kind,
        title,
        avatar: conversation.kind === "direct" ? others[0]?.avatar ?? "" : "",
        members: others,
        unread,
        lastMessage,
        updatedAt: lastMessage?.created_at ?? conversation.created_at,
      };
    });

    return result.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [conversations, members, messages, person, userId]);

  const totalUnread = useMemo(
    () =>
      userId
        ? conversationsView.reduce(
            (total, conversation) => total + conversation.unread,
            0,
          )
        : 0,
    [conversationsView, userId],
  );

  const messagesFor = useCallback(
    (conversationId: string | null) => {
      if (!conversationId) return [];
      return messages.filter(
        (message) => message.conversation_id === conversationId,
      );
    },
    [messages],
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

  const startDirectChat = useCallback(
    async (friendId: string) => {
      if (!configured || !userId) throw new Error("Sign in to message.");
      const supabase = getSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc(
        "start_direct_conversation",
        { other_user: friendId },
      );
      if (rpcError) throw rpcError;
      await refresh();
      return data as string;
    },
    [configured, refresh, userId],
  );

  const createGroup = useCallback(
    async (title: string, memberIds: string[]) => {
      if (!configured || !userId) throw new Error("Sign in to create a group.");
      const supabase = getSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc(
        "create_group_conversation",
        { group_title: title.trim(), member_ids: memberIds },
      );
      if (rpcError) throw rpcError;
      await refresh();
      return data as string;
    },
    [configured, refresh, userId],
  );

  const sendMessage = useCallback(
    async (conversationId: string, body: string, image?: File | null) => {
      if (!configured || !userId) throw new Error("Sign in to send messages.");
      const text = body.trim();
      if (!text && !image) return;
      if (text.length > 2000) throw new Error("Messages can be 2000 characters.");

      const supabase = getSupabaseBrowserClient();
      let attachmentUrl: string | null = null;
      let attachmentType: "image" | null = null;

      if (image) {
        const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const unique =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const path = `${conversationId}/${unique}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(path, image, {
            cacheControl: "3600",
            contentType: image.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        attachmentUrl = supabase.storage
          .from("chat-images")
          .getPublicUrl(path).data.publicUrl;
        attachmentType = "image";
      }

      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          body: text,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
        })
        .select(
          "id, conversation_id, sender_id, body, attachment_url, attachment_type, created_at",
        )
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
    async (conversationId: string) => {
      if (!configured || !userId) return;

      const readAt = new Date().toISOString();
      setMembers((current) => {
        let changed = false;
        const next = current.map((member) => {
          if (
            member.conversation_id === conversationId &&
            member.user_id === userId &&
            (!member.last_read_at ||
              new Date(member.last_read_at).getTime() <
                new Date(readAt).getTime())
          ) {
            changed = true;
            return { ...member, last_read_at: readAt };
          }
          return member;
        });
        return changed ? next : current;
      });

      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("conversation_members")
        .update({ last_read_at: readAt })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (updateError) setError(updateError.message);
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
    conversations: conversationsView,
    totalUnread,
    person,
    messagesFor,
    refresh,
    sendFriendRequest,
    respondToRequest,
    startDirectChat,
    createGroup,
    sendMessage,
    markConversationRead,
  };
}
