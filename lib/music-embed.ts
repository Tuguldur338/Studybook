import type { MusicTrack } from "@/lib/music-store";

export function embedUrlFor(track: MusicTrack) {
  if (track.source !== "youtube" && track.source !== "spotify") return null;

  try {
    const url = new URL(track.url);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (track.source === "youtube") {
      let id = "";
      if (host === "youtu.be") {
        id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      } else if (host.includes("youtube.com")) {
        if (
          url.pathname.startsWith("/shorts/") ||
          url.pathname.startsWith("/embed/")
        ) {
          id = url.pathname.split("/")[2] ?? "";
        } else {
          id = url.searchParams.get("v") ?? "";
        }
      }
      return id
        ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1`
        : null;
    }

    let parts = url.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("intl-")) parts = parts.slice(1);
    if (
      ["track", "album", "playlist", "episode"].includes(parts[0]) &&
      parts[1]
    ) {
      return `https://open.spotify.com/embed/${parts[0]}/${encodeURIComponent(parts[1])}`;
    }
  } catch {
    return null;
  }

  return null;
}
