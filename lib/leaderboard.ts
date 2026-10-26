import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const TASK_POINTS = {
  low: 10,
  medium: 20,
  high: 30,
} as const;

/**
 * Award (or reverse) leaderboard points for a task priority. Points are
 * intentionally best-effort: the task list is local, so a signed-out user can
 * still use Studybook without errors.
 */
export async function awardTaskPoints(
  priority: "low" | "medium" | "high",
  direction: 1 | -1,
) {
  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const amount = TASK_POINTS[priority] * direction;
    const { error } = await supabase.rpc("award_points", { amount });
    if (error) {
      console.warn("Leaderboard points were not saved:", error.message);
    }
  } catch (error) {
    console.warn("Leaderboard points were not saved:", error);
  }
}
