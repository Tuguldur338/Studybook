"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getHoliday,
  getUpcomingHoliday,
  melodyKeyForHoliday,
  MELODIES,
  toDayKey,
  type Holiday,
} from "@/lib/holidays";
import {
  DEFAULT_MUSIC_SETTINGS,
  deleteMusicFile,
  detectTrackSource,
  getMusicFile,
  isPlayableSource,
  loadMusicSettings,
  newTrackId,
  putMusicFile,
  saveMusicSettings,
  trackTitleFromUrl,
  type MusicSettings,
  type MusicTrack,
} from "@/lib/music-store";

type MusicContextValue = {
  ready: boolean;
  holiday: Holiday | null;
  upcoming: ReturnType<typeof getUpcomingHoliday>;
  settings: MusicSettings;
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  blocked: boolean;
  error: string;
  play: () => Promise<void>;
  playTrack: (track: MusicTrack) => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  setVolume: (value: number) => void;
  addUrlTrack: (url: string, day: string, title: string) => Promise<MusicTrack>;
  addFileTrack: (file: File, day: string, title: string) => Promise<MusicTrack>;
  updateTrack: (
    id: string,
    changes: { title?: string; day?: string },
  ) => void;
  removeTrack: (id: string) => void;
  assignTrack: (day: string, id: string | null) => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

function builtinTrack(holiday: Holiday): MusicTrack {
  return {
    id: `builtin:${holiday.key}`,
    title: `${holiday.name} theme`,
    source: "builtin",
    url: "",
    day: holiday.key,
    createdAt: "",
  };
}

export function resolveTrack(
  holiday: Holiday | null,
  settings: MusicSettings,
): MusicTrack | null {
  const activeAny = settings.tracks.find(
    (track) =>
      track.id === settings.activeByDay.any && isPlayableSource(track.source),
  );
  const anyTrack = settings.tracks.find(
    (track) => track.day === "any" && isPlayableSource(track.source),
  );

  // Music is primarily for celebrations, but an "Any day" track can be a
  // normal browser playlist too.
  if (!holiday) return activeAny ?? anyTrack ?? null;

  const activeId = settings.activeByDay[holiday.key];
  const active = settings.tracks.find((track) => track.id === activeId);
  if (active && isPlayableSource(active.source)) return active;

  const dayTrack = settings.tracks.find(
    (track) => track.day === holiday.key && isPlayableSource(track.source),
  );
  if (dayTrack) return dayTrack;

  if (activeAny) return activeAny;
  if (anyTrack) return anyTrack;

  return builtinTrack(holiday);
}

function playlistFor(holiday: Holiday | null, settings: MusicSettings) {
  if (holiday) {
    const holidayTracks = settings.tracks.filter(
      (track) =>
        isPlayableSource(track.source) &&
        (track.day === holiday.key ||
          settings.activeByDay[holiday.key] === track.id),
    );
    if (holidayTracks.length) return holidayTracks;
  }

  const anyTracks = settings.tracks.filter(
    (track) =>
      isPlayableSource(track.source) &&
      (track.day === "any" || settings.activeByDay.any === track.id),
  );
  if (anyTracks.length) return anyTracks;

  return settings.tracks.filter((track) => isPlayableSource(track.source));
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MusicSettings>(
    DEFAULT_MUSIC_SETTINGS,
  );
  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [upcoming, setUpcoming] = useState<
    ReturnType<typeof getUpcomingHoliday>
  >(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");

  const settingsRef = useRef<MusicSettings>(DEFAULT_MUSIC_SETTINGS);
  const dayKeyRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const synthStopRef = useRef<(() => void) | null>(null);
  const synthGainRef = useRef<GainNode | null>(null);
  const lastStartedRef = useRef<string | null>(null);

  const currentTrack = useMemo(
    () => resolveTrack(holiday, settings),
    [holiday, settings],
  );

  const commit = useCallback((next: MusicSettings) => {
    settingsRef.current = next;
    setSettings(next);
    saveMusicSettings(next);
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (synthStopRef.current) {
      synthStopRef.current();
      synthStopRef.current = null;
    }
    synthGainRef.current = null;
  }, []);

  const startSynth = useCallback((track: MusicTrack) => {
    type AudioContextConstructor = new () => AudioContext;
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextConstructor })
        .webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("This browser cannot synthesize the theme.");
    }

    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.value = settingsRef.current.volume;
    gain.connect(context.destination);

    const melody =
      MELODIES[melodyKeyForHoliday(track.day)] ?? MELODIES.default;
    const beat = 60 / melody.tempo;
    const oscillators = new Set<OscillatorNode>();
    let stopped = false;
    let loopTimer = 0;

    const schedule = () => {
      if (stopped) return;
      let time = context.currentTime + 0.06;
      let total = 0;

      for (const [midi, beats] of melody.notes) {
        const duration = beats * beat;
        if (midi > 0) {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          oscillator.type = "triangle";
          oscillator.frequency.value =
            440 * Math.pow(2, (midi - 69) / 12);
          envelope.gain.setValueAtTime(0, time);
          envelope.gain.linearRampToValueAtTime(0.9, time + 0.02);
          envelope.gain.exponentialRampToValueAtTime(
            0.001,
            time + duration * 0.92,
          );
          oscillator.connect(envelope);
          envelope.connect(gain);
          oscillator.start(time);
          oscillator.stop(time + duration);
          oscillators.add(oscillator);
          oscillator.onended = () => oscillators.delete(oscillator);
        }
        time += duration;
        total += duration;
      }

      loopTimer = window.setTimeout(schedule, total * 1000);
    };

    synthStopRef.current = () => {
      stopped = true;
      window.clearTimeout(loopTimer);
      oscillators.forEach((oscillator) => {
        try {
          oscillator.stop();
        } catch {
          // Oscillator may already have finished.
        }
      });
      oscillators.clear();
      void context.close();
    };
    synthGainRef.current = gain;

    schedule();
    void context
      .resume()
      .then(() => {
        if (!stopped) setIsPlaying(true);
      })
      .catch(() => {
        setBlocked(true);
        stopPlayback();
      });
  }, [stopPlayback]);

  const startAudio = useCallback(async (track: MusicTrack) => {
    const audio = audioRef.current;
    if (!audio) throw new Error("Audio is not ready yet.");

    stopPlayback();
    let source = track.url;
    if (track.source === "file") {
      const blob = await getMusicFile(track.id);
      if (!blob) {
        throw new Error("That audio file is missing. Add it again.");
      }
      source = URL.createObjectURL(blob);
      objectUrlRef.current = source;
    }

    audio.src = source;
    audio.volume = settingsRef.current.volume;
    await audio.play();
    setIsPlaying(true);
  }, [stopPlayback]);

  const startTrack = useCallback(
    async (track: MusicTrack) => {
      setError("");
      setBlocked(false);
      try {
        if (track.source === "builtin") {
          stopPlayback();
          startSynth(track);
          return;
        }
        if (!isPlayableSource(track.source)) {
          throw new Error(
            "This link opens on its platform — it cannot autoplay as background music.",
          );
        }
        await startAudio(track);
      } catch (cause) {
        setIsPlaying(false);
        stopPlayback();
        if (
          cause instanceof DOMException &&
          (cause.name === "NotAllowedError" || cause.name === "AbortError")
        ) {
          setBlocked(true);
          return;
        }
        if (
          cause instanceof DOMException &&
          cause.name === "NotSupportedError"
        ) {
          setError(
            "This link is not a direct audio file. Use a direct MP3/audio link or upload the file.",
          );
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not play this track.",
        );
      }
    },
    [startAudio, startSynth, stopPlayback],
  );

  const play = useCallback(async () => {
    if (!currentTrack) return;
    if (!settingsRef.current.enabled) {
      commit({ ...settingsRef.current, enabled: true });
    }
    lastStartedRef.current = currentTrack.id;
    await startTrack(currentTrack);
  }, [commit, currentTrack, startTrack]);

  const pause = useCallback(() => {
    stopPlayback();
    setIsPlaying(false);
    setBlocked(false);
    lastStartedRef.current = null;
    if (settingsRef.current.enabled) {
      commit({ ...settingsRef.current, enabled: false });
    }
  }, [commit, stopPlayback]);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else void play();
  }, [isPlaying, pause, play]);

  const playTrack = useCallback(
    async (track: MusicTrack) => {
      if (!isPlayableSource(track.source)) return;

      const dayKey = holiday?.key ?? "any";
      const activeByDay = {
        ...settingsRef.current.activeByDay,
        [dayKey]: track.id,
      };
      commit({ ...settingsRef.current, enabled: true, activeByDay });
      lastStartedRef.current = track.id;
      await startTrack(track);
    },
    [commit, holiday, startTrack],
  );

  const nextTrack = useCallback(async () => {
    const playable = playlistFor(holiday, settingsRef.current);
    if (!playable.length) return;

    const index = currentTrack
      ? playable.findIndex((track) => track.id === currentTrack.id)
      : -1;
    const next = playable[(index + 1) % playable.length] ?? playable[0];
    await playTrack(next);
  }, [currentTrack, holiday, playTrack]);

  const previousTrack = useCallback(async () => {
    const playable = playlistFor(holiday, settingsRef.current);
    if (!playable.length) return;

    const index = currentTrack
      ? playable.findIndex((track) => track.id === currentTrack.id)
      : 0;
    const previous =
      playable[(index - 1 + playable.length) % playable.length] ?? playable[0];
    await playTrack(previous);
  }, [currentTrack, holiday, playTrack]);

  const setVolume = useCallback(
    (value: number) => {
      const volume = Math.min(1, Math.max(0, value));
      commit({ ...settingsRef.current, volume });
      if (audioRef.current) audioRef.current.volume = volume;
      if (synthGainRef.current) synthGainRef.current.gain.value = volume;
    },
    [commit],
  );

  const addUrlTrack = useCallback(
    async (url: string, day: string, title: string) => {
      const trimmed = url.trim();
      if (!trimmed) throw new Error("Paste a link first.");
      try {
        new URL(trimmed);
      } catch {
        throw new Error("That does not look like a valid link.");
      }

      const source = detectTrackSource(trimmed);
      const track: MusicTrack = {
        id: newTrackId(source),
        title: title.trim() || trackTitleFromUrl(trimmed),
        source,
        url: trimmed,
        day,
        createdAt: new Date().toISOString(),
      };

      const next: MusicSettings = {
        ...settingsRef.current,
        tracks: [track, ...settingsRef.current.tracks],
      };
      if (source === "url") {
        next.activeByDay = { ...next.activeByDay, [day]: track.id };
      }
      commit(next);
      return track;
    },
    [commit],
  );

  const addFileTrack = useCallback(
    async (file: File, day: string, title: string) => {
      const isAudio =
        file.type.startsWith("audio/") ||
        file.type === "video/mp4" ||
        file.type === "video/webm";
      if (!isAudio) {
        throw new Error("Choose an audio file (mp3, m4a, ogg, wav, mp4…).");
      }
      if (file.size > 30 * 1024 * 1024) {
        throw new Error("Audio files must be smaller than 30 MB.");
      }

      const id = newTrackId("file");
      await putMusicFile(id, file);
      const track: MusicTrack = {
        id,
        title:
          title.trim() || file.name.replace(/\.[^.]+$/, "") || "Audio track",
        source: "file",
        url: "",
        day,
        createdAt: new Date().toISOString(),
      };

      commit({
        ...settingsRef.current,
        tracks: [track, ...settingsRef.current.tracks],
        activeByDay: { ...settingsRef.current.activeByDay, [day]: track.id },
      });
      return track;
    },
    [commit],
  );

  const removeTrack = useCallback(
    (id: string) => {
      const track = settingsRef.current.tracks.find((item) => item.id === id);
      if (track?.source === "file") void deleteMusicFile(id);

      const activeByDay: Record<string, string> = {};
      for (const [day, trackId] of Object.entries(
        settingsRef.current.activeByDay,
      )) {
        if (trackId !== id) activeByDay[day] = trackId;
      }

      commit({
        ...settingsRef.current,
        tracks: settingsRef.current.tracks.filter((item) => item.id !== id),
        activeByDay,
      });

      if (lastStartedRef.current === id) {
        pause();
      }
    },
    [commit, pause],
  );

  const updateTrack = useCallback(
    (id: string, changes: { title?: string; day?: string }) => {
      const current = settingsRef.current;
      const track = current.tracks.find((item) => item.id === id);
      if (!track) return;

      const nextTitle = changes.title?.trim() || track.title;
      const nextDay = changes.day ?? track.day;
      const tracks = current.tracks.map((item) =>
        item.id === id ? { ...item, title: nextTitle, day: nextDay } : item,
      );

      let activeByDay = current.activeByDay;
      if (nextDay !== track.day) {
        activeByDay = { ...current.activeByDay };
        for (const [day, trackId] of Object.entries(activeByDay)) {
          if (trackId === id) delete activeByDay[day];
        }
        if (isPlayableSource(track.source)) activeByDay[nextDay] = id;
      }

      commit({ ...current, tracks, activeByDay });
    },
    [commit],
  );

  const assignTrack = useCallback(
    (day: string, id: string | null) => {
      const activeByDay = { ...settingsRef.current.activeByDay };
      if (id) activeByDay[day] = id;
      else delete activeByDay[day];
      commit({ ...settingsRef.current, activeByDay });
    },
    [commit],
  );

  useEffect(() => {
    const audio = new Audio();
    audio.loop = false;
    audio.preload = "auto";
    audio.volume = DEFAULT_MUSIC_SETTINGS.volume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      void nextTrack();
    };
    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [nextTrack]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadMusicSettings();
      const now = new Date();
      dayKeyRef.current = toDayKey(now);
      settingsRef.current = loaded;
      setSettings(loaded);
      setHoliday(getHoliday(now));
      setUpcoming(getUpcomingHoliday(now));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const dayKey = toDayKey(now);
      if (dayKey === dayKeyRef.current) return;

      dayKeyRef.current = dayKey;
      setHoliday(getHoliday(now));
      setUpcoming(getUpcomingHoliday(now));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready || !settings.enabled || !currentTrack) return;
    if (lastStartedRef.current === currentTrack.id) return;

    lastStartedRef.current = currentTrack.id;
    const timer = window.setTimeout(() => {
      void startTrack(currentTrack);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentTrack, ready, settings.enabled, startTrack]);

  return (
    <MusicContext.Provider
      value={{
        ready,
        holiday,
        upcoming,
        settings,
        currentTrack,
        isPlaying,
        blocked,
        error,
        play,
        playTrack,
        nextTrack,
        previousTrack,
        pause,
        toggle,
        setVolume,
        addUrlTrack,
        addFileTrack,
        updateTrack,
        removeTrack,
        assignTrack,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error("useMusic must be used inside MusicProvider.");
  }
  return context;
}
