import type { MusicTrack } from "@/lib/music-store";

function youtubeIdFor(track: MusicTrack) {
  if (track.source !== "youtube") return null;

  try {
    const url = new URL(track.url);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (host.includes("youtube.com")) {
      if (
        url.pathname.startsWith("/shorts/") ||
        url.pathname.startsWith("/embed/")
      ) {
        return url.pathname.split("/")[2] ?? null;
      }
      return url.searchParams.get("v") ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

export function coverUrlFor(track: MusicTrack) {
  const id = youtubeIdFor(track);
  return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null;
}

export function embedUrlFor(track: MusicTrack) {
  if (track.source !== "youtube" && track.source !== "spotify") return null;

  try {
    const url = new URL(track.url);

    if (track.source === "youtube") {
      const id = youtubeIdFor(track);
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
