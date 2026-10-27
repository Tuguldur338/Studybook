import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const TASK_POINTS = {
  low: 10,
  medium: 20,
  high: 30,
} as const;

export type AwardTaskPointsResult = {
  ok: boolean;
  delta: number;
  total?: number;
  message?: string;
};

/**
 * Award (or reverse) leaderboard points for a task priority. The task list is
 * local, so the server can only validate the amount, not the task itself.
 */
export async function awardTaskPoints(
  priority: "low" | "medium" | "high",
  direction: 1 | -1,
): Promise<AwardTaskPointsResult> {
  const delta = TASK_POINTS[priority] * direction;

  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return {
        ok: false,
        delta,
        message: "Sign in to earn leaderboard points.",
      };
    }

    const { data, error } = await supabase.rpc("award_points", {
      amount: delta,
    });

    if (error) {
      const missingSetup =
        /award_points|schema cache|could not find|does not exist/i.test(
          error.message,
        );
      return {
        ok: false,
        delta,
        message: missingSetup
          ? "Leaderboard setup is missing — run supabase/migrations/leaderboard.sql."
          : "Could not save leaderboard points.",
      };
    }

    return {
      ok: true,
      delta,
      total: typeof data === "number" ? data : undefined,
    };
  } catch {
    return {
      ok: false,
      delta,
      message: "Could not save leaderboard points.",
    };
  }
}
