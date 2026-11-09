import type { SupabaseClient } from "@supabase/supabase-js";
import { HOLIDAYS } from "@/lib/holidays";

export const BORDER_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const BORDER_PATTERN = /^champion-(\d{4})-(\d{2})$/;
const BORDER_STYLE_PATTERN = /^champion-style-(\d{2})$/;

export const EXCLUSIVE_BORDERS = [
  { id: "exclusive-blackhole", label: "Black Hole" },
  { id: "exclusive-sea", label: "Sea" },
  { id: "exclusive-animal", label: "Animal" },
  { id: "exclusive-war", label: "War" },
  { id: "exclusive-gun", label: "Gun" },
] as const;

export const CELEBRATION_BORDERS = Object.values(HOLIDAYS).map((holiday) => ({
  id: `celebration-${holiday.key}`,
  label: `${holiday.name} celebration`,
  holidayKey: holiday.key,
}));

export const CHAMPION_STYLE_BORDERS = BORDER_MONTHS.map((month, index) => ({
  id: `champion-style-${String(index + 1).padStart(2, "0")}`,
  label: `${month} champion`,
}));

const BORDER_LABELS = new Map(
  [
    ...EXCLUSIVE_BORDERS,
    ...CELEBRATION_BORDERS,
    ...CHAMPION_STYLE_BORDERS,
  ].map(({ id, label }) => [id, label]),
);

export type BorderDropSource = "daily" | "task" | "celebration";

export function borderIdFromMonth(month: string) {
  return `champion-${month}`;
}

export function borderMonthNumber(borderId: string | null | undefined) {
  const match = borderId ? BORDER_PATTERN.exec(borderId) : null;
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? month : null;
}

export function borderClass(borderId: string | null | undefined) {
  const month = borderMonthNumber(borderId);
  if (month) return `champion-${month}`;

  const styleMatch = borderId ? BORDER_STYLE_PATTERN.exec(borderId) : null;
  if (styleMatch) {
    const styleMonth = Number(styleMatch[1]);
    return styleMonth >= 1 && styleMonth <= 12
      ? `champion-${styleMonth}`
      : "";
  }

  return borderId && BORDER_LABELS.has(borderId) ? borderId : "";
}

export function borderLabel(borderId: string) {
  const match = BORDER_PATTERN.exec(borderId);
  if (match) {
    const month = Number(match[2]);
    const name = BORDER_MONTHS[month - 1] ?? "Champion";
    return `${name} ${match[1]} champion`;
  }
  return BORDER_LABELS.get(borderId) ?? "Champion border";
}

export async function rollBorderDrop(
  supabase: SupabaseClient,
  source: BorderDropSource,
  reference: string | null = null,
) {
  const { data, error } = await supabase.rpc("roll_border_drop", {
    p_source: source,
    p_reference: reference,
  });
  if (error) throw error;
  return Array.isArray(data)
    ? data.filter((borderId): borderId is string => typeof borderId === "string")
    : [];
}
