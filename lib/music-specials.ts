import type { MusicTrack } from "@/lib/music-store";

/**
 * The Halloween opener. It is an embed, so it uses the global embedded player
 * instead of the synthesized holiday melody.
 *
 * The linked video is Rockwell's "Somebody's Watching Me", not Thriller.
 */
export const HALLOWEEN_THEME_TRACK: MusicTrack = {
  id: "halloween-opener-somebody",
  title: "Somebody's Watching Me — Rockwell",
  source: "youtube",
  url: "https://youtu.be/7YvAYIJSSZY?si=cMlWrxFQBEm1Xrxw",
  day: "halloween",
  createdAt: "",
};
