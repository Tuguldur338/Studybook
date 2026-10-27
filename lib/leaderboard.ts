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
        /could not find the function|schema cache/i.test(error.message) &&
        /award_points/i.test(error.message);
      console.warn("Leaderboard points RPC failed:", error.message);
      return {
        ok: false,
        delta,
        message: missingSetup
          ? "Leaderboard setup is missing in the project this app uses. Run leaderboard.sql in the same Supabase project as the app."
          : `Leaderboard error: ${error.message}`,
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
