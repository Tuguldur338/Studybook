"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

/**
 * Reads the current Supabase session. The shell has its own subscription for
 * the top bar; this hook lets individual views (like the account page) react
 * to sign-in state without pulling auth through the studybook context.
 */
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        if (!active) return;
        setUser(data.user ?? null);
        setReady(true);
      })
      .catch(() => {
        // Offline or the auth endpoint is unreachable; let local data load.
        if (active) setReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
        setReady(true);
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured()) {
    return { user: null, ready: true };
  }

  return { user, ready };
}
