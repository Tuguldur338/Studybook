export type Holiday = {
  key: string;
  name: string;
  emoji: string;
};

export const HOLIDAYS: Record<string, Holiday> = {
  newyear: { key: "newyear", name: "New Year", emoji: "🎆" },
  constitution: {
    key: "constitution",
    name: "Constitution Day",
    emoji: "📜",
  },
  tsagaansar: { key: "tsagaansar", name: "Tsagaan Sar", emoji: "🌙" },
  womensday: {
    key: "womensday",
    name: "International Women's Day",
    emoji: "🌷",
  },
  soldiersday: { key: "soldiersday", name: "Soldiers' Day", emoji: "🎖️" },
  childrensday: { key: "childrensday", name: "Children's Day", emoji: "🎈" },
  naadam: { key: "naadam", name: "Naadam", emoji: "🏹" },
  halloween: { key: "halloween", name: "Halloween", emoji: "🎃" },
  genghis: {
    key: "genghis",
    name: "Genghis Khan's Birthday",
    emoji: "🐎",
  },
  republic: { key: "republic", name: "Republic Day", emoji: "🇲🇳" },
  christmas: { key: "christmas", name: "Christmas", emoji: "🎄" },
  independence: {
    key: "independence",
    name: "Independence Day",
    emoji: "🇲🇳",
  },
  newyearseve: { key: "newyearseve", name: "New Year's Eve", emoji: "🥂" },
};

// Tsagaan Sar follows the lunar calendar. Dates through 2027; add more years
// here as they are announced.
const TSAGAAN_SAR_DATES: Record<string, true> = {
  "2025-03-01": true,
  "2026-02-17": true,
  "2027-02-06": true,
};

export function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getHoliday(date = new Date()): Holiday | null {
  const key = toDayKey(date);
  if (TSAGAAN_SAR_DATES[key]) return HOLIDAYS.tsagaansar;

  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 1 && day === 1) return HOLIDAYS.newyear;
  if (month === 1 && day === 13) return HOLIDAYS.constitution;
  if (month === 3 && day === 8) return HOLIDAYS.womensday;
  if (month === 3 && day === 18) return HOLIDAYS.soldiersday;
  if (month === 6 && day === 1) return HOLIDAYS.childrensday;
  if (month === 7 && day >= 11 && day <= 15) return HOLIDAYS.naadam;
  if (month === 10 && day === 31) return HOLIDAYS.halloween;
  if (month === 11 && day === 14) return HOLIDAYS.genghis;
  if (month === 11 && day === 26) return HOLIDAYS.republic;
  if (month === 12 && day === 25) return HOLIDAYS.christmas;
  if (month === 12 && day === 29) return HOLIDAYS.independence;
  if (month === 12 && day === 31) return HOLIDAYS.newyearseve;

  return null;
}

export function getUpcomingHoliday(from = new Date()) {
  for (let offset = 0; offset < 367; offset += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    const holiday = getHoliday(date);
    if (holiday) {
      return { holiday, date, days: offset };
    }
  }
  return null;
}

export type Melody = {
  tempo: number;
  /** [MIDI note, beats]; MIDI 0 is a rest. */
  notes: Array<[number, number]>;
};

// Short, original loops built on traditional public-domain motifs. They are
// intentionally simple so they can sit quietly in the background.
export const MELODIES: Record<string, Melody> = {
  halloween: {
    tempo: 88,
    notes: [
      [57, 0.5],
      [60, 0.5],
      [56, 0.5],
      [59, 1],
      [0, 0.5],
      [57, 0.5],
      [60, 0.5],
      [63, 1],
      [0, 0.5],
      [62, 0.5],
      [59, 0.5],
      [56, 1.5],
    ],
  },
  christmas: {
    tempo: 120,
    notes: [
      [64, 1],
      [64, 1],
      [64, 2],
      [64, 1],
      [64, 1],
      [64, 2],
      [64, 1],
      [67, 1],
      [60, 1],
      [62, 1],
      [64, 4],
    ],
  },
  newyear: {
    tempo: 96,
    notes: [
      [67, 1],
      [67, 1],
      [67, 1],
      [64, 1],
      [67, 1],
      [69, 1],
      [67, 2],
      [64, 1],
      [62, 1],
      [60, 2],
    ],
  },
  newyearseve: {
    tempo: 96,
    notes: [
      [67, 1],
      [67, 1],
      [67, 1],
      [64, 1],
      [67, 1],
      [69, 1],
      [67, 2],
      [64, 1],
      [62, 1],
      [60, 2],
    ],
  },
  tsagaansar: {
    tempo: 100,
    notes: [
      [60, 1],
      [62, 1],
      [64, 1],
      [67, 2],
      [64, 1],
      [62, 1],
      [60, 2],
      [55, 1],
      [60, 1],
      [62, 1],
      [64, 3],
    ],
  },
  naadam: {
    tempo: 112,
    notes: [
      [60, 0.5],
      [60, 0.5],
      [67, 1],
      [67, 0.5],
      [69, 0.5],
      [67, 1],
      [64, 0.5],
      [62, 0.5],
      [60, 1],
      [55, 1],
      [60, 2],
    ],
  },
  womensday: {
    tempo: 92,
    notes: [
      [64, 1],
      [67, 1],
      [69, 2],
      [67, 1],
      [64, 1],
      [62, 2],
      [60, 1],
      [62, 1],
      [64, 3],
    ],
  },
  childrensday: {
    tempo: 128,
    notes: [
      [72, 0.5],
      [72, 0.5],
      [74, 0.5],
      [76, 0.5],
      [76, 0.5],
      [74, 0.5],
      [72, 0.5],
      [69, 1],
      [67, 0.5],
      [69, 0.5],
      [72, 1],
    ],
  },
  default: {
    tempo: 84,
    notes: [
      [60, 1],
      [64, 1],
      [67, 1],
      [72, 2],
      [67, 1],
      [64, 1],
      [60, 2],
      [62, 1],
      [67, 1],
    ],
  },
};

export function melodyKeyForHoliday(key: string | null): string {
  if (!key) return "default";
  return MELODIES[key] ? key : "default";
}
