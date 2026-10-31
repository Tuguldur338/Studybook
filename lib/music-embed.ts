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

/**
 * Best-effort title lookup for YouTube/Spotify links. Uses noembed because
 * YouTube's own oEmbed endpoint does not allow browser CORS requests.
 */
export async function fetchRemoteTrackTitle(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "title" in payload &&
      typeof payload.title === "string"
    ) {
      return payload.title.trim() || null;
    }
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }

  return null;
}

export function embedUrlFor(track: MusicTrack) {
  if (track.source !== "youtube" && track.source !== "spotify") return null;

  try {
    const url = new URL(track.url);

    if (track.source === "youtube") {
      const id = youtubeIdFor(track);
      return id
        ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&enablejsapi=1&playsinline=1`
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
