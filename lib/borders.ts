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
  return month ? `champion-${month}` : "";
}

export function borderLabel(borderId: string) {
  const match = BORDER_PATTERN.exec(borderId);
  if (!match) return "Champion border";
  const month = Number(match[2]);
  const name = BORDER_MONTHS[month - 1] ?? "Champion";
  return `${name} ${match[1]} champion`;
}
