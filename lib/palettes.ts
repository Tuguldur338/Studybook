export const PALETTES = [
  {
    id: "sage",
    label: "Sage",
    description: "Calm forest greens",
    light: { background: "#f3f6f4", accent: "#1f7a5c" },
    dark: { background: "#0f1513", accent: "#5cc79a" },
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Cool teal and sea blue",
    light: { background: "#eef4f8", accent: "#147a91" },
    dark: { background: "#0b141a", accent: "#58c5d8" },
  },
  {
    id: "lavender",
    label: "Lavender",
    description: "Soft violet and dusk",
    light: { background: "#f4f1f9", accent: "#7c5cbf" },
    dark: { background: "#130f1c", accent: "#b39cf0" },
  },
  {
    id: "peach",
    label: "Peach",
    description: "Warm apricot and clay",
    light: { background: "#fbf3ee", accent: "#c0643a" },
    dark: { background: "#170f0c", accent: "#e9956c" },
  },
  {
    id: "matcha",
    label: "Matcha",
    description: "Fresh tea and moss",
    light: { background: "#f2f5e9", accent: "#5d7f3b" },
    dark: { background: "#10140c", accent: "#a9cc72" },
  },
  {
    id: "rose",
    label: "Rose",
    description: "Muted blossom and berry",
    light: { background: "#f9eff2", accent: "#b8476b" },
    dark: { background: "#180e13", accent: "#e8789c" },
  },
  {
    id: "slate",
    label: "Slate",
    description: "Quiet grey and steel blue",
    light: { background: "#f1f3f5", accent: "#3f5d78" },
    dark: { background: "#0e1216", accent: "#7fb0d8" },
  },
  {
    id: "sand",
    label: "Sand",
    description: "Warm paper and caramel",
    light: { background: "#f7f2e8", accent: "#9b7443" },
    dark: { background: "#15120d", accent: "#d7b27c" },
  },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
