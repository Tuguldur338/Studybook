import type { MusicTrack } from "@/lib/music-store";

/**
 * The Halloween opener. It is an embed, so it uses the global embedded player
 * instead of the synthesized holiday melody.
 */
export const THRILLER_TRACK: MusicTrack = {
  id: "halloween-opener-thriller",
  title: "Thriller — Michael Jackson",
  source: "youtube",
  url: "https://youtu.be/7YvAYIJSSZY?si=cMlWrxFQBEm1Xrxw",
  day: "halloween",
  createdAt: "",
};
