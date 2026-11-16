import type { SupabaseClient } from "@supabase/supabase-js";

export const TASK_COMPLETION_ACHIEVEMENT_ID = "task_completion_50";
export const TASK_COMPLETION_ACHIEVEMENT_TARGET = 50;

export type CompletionSource = "todo" | "routine" | "schedule";

export type AchievementSummary = {
  completedCount: number;
  achievements: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function achievementErrorMessage(cause: unknown) {
  const error = isRecord(cause) ? cause : null;
  const message =
    typeof error?.message === "string"
      ? error.message
      : cause instanceof Error
        ? cause.message
        : "Unexpected achievement error.";
  if (error?.code === "PGRST202" || error?.code === "42883") {
    return `${message} Apply supabase/migrations/task-completion-achievements.sql in Supabase, then retry.`;
  }
  return message;
}

export async function recordCompletionEvent(
  supabase: SupabaseClient,
  eventKey: string,
  source: CompletionSource,
) {
  const { data, error } = await supabase.rpc("record_completion_event", {
    p_event_key: eventKey,
    p_source: source,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (
    !isRecord(row) ||
    typeof row.completion_count !== "number" ||
    (row.achievement_unlocked !== null &&
      typeof row.achievement_unlocked !== "string")
  ) {
    throw new Error("The completion progress response was invalid.");
  }

  window.dispatchEvent(new Event("studybook:achievement-progress-updated"));
  return {
    completedCount: row.completion_count,
    unlockedAchievement: row.achievement_unlocked,
  };
}

export async function getAchievementSummary(
  supabase: SupabaseClient,
  profileId: string,
): Promise<AchievementSummary> {
  const { data, error } = await supabase.rpc(
    "get_profile_achievement_summary",
    { p_profile_id: profileId },
  );
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (
    !isRecord(row) ||
    typeof row.completion_count !== "number" ||
    !Array.isArray(row.achievements) ||
    !row.achievements.every((achievement) => typeof achievement === "string")
  ) {
    throw new Error("The profile achievement response was invalid.");
  }

  return {
    completedCount: row.completion_count,
    achievements: row.achievements,
  };
}
