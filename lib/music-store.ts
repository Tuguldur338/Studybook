export type TrackSource =
  | "file"
  | "url"
  | "youtube"
  | "spotify"
  | "link"
  | "builtin";

export type MusicTrack = {
  id: string;
  title: string;
  source: TrackSource;
  /** Direct audio URL for `url`, external page for youtube/spotify/link. */
  url: string;
  /** Holiday key, or "any" for everyday music. */
  day: string;
  /** Personal playlist name, when the track belongs to a personal list. */
  playlist?: string;
  createdAt: string;
};

export type MusicSettings = {
  tracks: MusicTrack[];
  activeByDay: Record<string, string>;
  volume: number;
  enabled: boolean;
};

const STORAGE_KEY = "studybook-music-v1";
const DB_NAME = "studybook-music";
const STORE_NAME = "files";

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  tracks: [],
  activeByDay: {},
  volume: 0.45,
  enabled: false,
};

export function newTrackId(prefix = "track") {
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${unique}`;
}

export function detectTrackSource(raw: string): TrackSource {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be" || host.includes("youtube.com")) return "youtube";
    if (host.includes("spotify.com")) return "spotify";
    if (
      /\.(mp3|m4a|aac|ogg|oga|wav|flac|mp4|webm|mov)(\?|#|$)/i.test(
        `${url.pathname}${url.search}`,
      )
    ) {
      return "url";
    }
    return "link";
  } catch {
    return "link";
  }
}

export function trackTitleFromUrl(raw: string) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be" || host.includes("youtube.com")) return "YouTube track";
    if (host.includes("spotify.com")) return "Spotify track";
    const last = decodeURIComponent(
      url.pathname.split("/").filter(Boolean).pop() ?? "",
    ).replace(/\.[a-z0-9]+$/i, "");
    return last || host;
  } catch {
    return "Shared track";
  }
}

export function isPlayableSource(source: TrackSource) {
  // "link" links are attempted as audio too; a non-audio page simply reports
  // a clear error instead of being silently unplayable.
  return (
    source === "file" ||
    source === "url" ||
    source === "link" ||
    source === "builtin"
  );
}

function isMusicTrack(value: unknown): value is MusicTrack {
  if (typeof value !== "object" || value === null) return false;
  const track = value as Record<string, unknown>;
  return (
    typeof track.id === "string" &&
    typeof track.title === "string" &&
    typeof track.url === "string" &&
    typeof track.day === "string" &&
    typeof track.createdAt === "string" &&
    ["file", "url", "youtube", "spotify", "link", "builtin"].includes(
      String(track.source),
    ) &&
    (track.playlist === undefined || typeof track.playlist === "string")
  );
}

export function loadMusicSettings(): MusicSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MUSIC_SETTINGS;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const tracks = Array.isArray(parsed.tracks)
      ? parsed.tracks.filter(isMusicTrack).filter((track) => track.source !== "builtin")
      : [];
    const activeByDay: Record<string, string> = {};
    if (typeof parsed.activeByDay === "object" && parsed.activeByDay !== null) {
      for (const [day, id] of Object.entries(
        parsed.activeByDay as Record<string, unknown>,
      )) {
        if (typeof id === "string") activeByDay[day] = id;
      }
    }

    const volume =
      typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1
        ? parsed.volume
        : DEFAULT_MUSIC_SETTINGS.volume;

    return {
      tracks,
      activeByDay,
      volume,
      enabled: parsed.enabled === true,
    };
  } catch {
    return DEFAULT_MUSIC_SETTINGS;
  }
}

export function saveMusicSettings(settings: MusicSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota or privacy-mode failures; music still works this visit.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot store audio files."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open audio storage."));
  });
}

export async function putMusicFile(id: string, blob: Blob) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save the audio file."));
  });
  db.close();
}

export async function getMusicFile(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the audio file."));
  });
  db.close();
  return blob;
}

export async function deleteMusicFile(id: string) {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Deleting a missing file is fine.
  }
}
