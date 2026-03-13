import { decode as atob } from "base-64";
import { Audio } from "expo-av";
import { create } from "zustand";

const LIMIT = 25;
const MAX_OFFSET = 1000;

export type Track = {
    id: number;
    title: string;
    duration: number;
    audioQuality: string;
    artists: { id: number; name: string }[];
    album: {
        id: number;
        title: string;
        cover: string | null;
    };
};

export type Artist = {
    id: number;
    name: string;
    picture: string | null;
};

export type Album = {
    id: number;
    title: string;
    cover: string | null;
};

export type FilterType = "all" | "songs" | "artists" | "albums";

type LyricLine = { time: number; text: string };

type MusicStore = {
    // Search State
    query: string;
    tracks: Track[];
    artists: Artist[];
    albums: Album[];
    loading: boolean;
    trackOffset: number;
    hasMoreTracks: boolean;
    filter: FilterType;

    // Player State
    currentTrack: Track | null;
    isPlaying: boolean;
    sound: Audio.Sound | null;
    currentTime: number;
    totalDuration: number;
    syncedLyrics: LyricLine[];
    currentLyricIndex: number;

    // Actions
    setFilter: (filter: FilterType) => void;
    searchMusic: (query: string) => Promise<void>;
    loadMore: () => Promise<void>;
    playTrack: (track: Track) => Promise<void>;
    togglePlay: () => Promise<void>;
    seek: (millis: number) => Promise<void>;
};

const getApiParam = (filter: FilterType) => {
    if (filter === "songs") return "s";
    if (filter === "albums") return "al";
    return "a";
};

const parseLRC = (lrc: string): LyricLine[] => {
    const lines = lrc.split("\n");
    const result: LyricLine[] = [];
    const timeRegex = /\[(\d+):(\d+\.\d+)\]/;
    lines.forEach((line) => {
        const match = timeRegex.exec(line);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseFloat(match[2]);
            const text = line.replace(timeRegex, "").trim();
            if (text) result.push({ time: minutes * 60 + seconds, text });
        }
    });
    return result;
};

export const useMusicStore = create<MusicStore>((set, get) => ({
    query: "",
    tracks: [],
    artists: [],
    albums: [],
    loading: false,
    trackOffset: 0,
    hasMoreTracks: true,
    filter: "all",

    currentTrack: null,
    isPlaying: false,
    sound: null,
    currentTime: 0,
    totalDuration: 0,
    syncedLyrics: [],
    currentLyricIndex: -1,

    setFilter: (filter) => {
        set({ filter, trackOffset: 0, hasMoreTracks: true, tracks: [], artists: [], albums: [] });
        const { query, searchMusic } = get();
        if (query) searchMusic(query);
    },

    searchMusic: async (query: string) => {
        if (!query) {
            set({ query: "", tracks: [], artists: [], albums: [], trackOffset: 0, hasMoreTracks: true });
            return;
        }
        const filter = get().filter;
        const param = getApiParam(filter);
        set({ loading: true, query, trackOffset: 0 });

        try {
            const res = await fetch(`https://streamex.sh/api/music/search?${param}=${encodeURIComponent(query)}&limit=${LIMIT}&offset=0`);
            const json = await res.json();
            if (get().query !== query) return;

            let tracks = [], artists = [], albums = [];
            if (param === "s") {
                tracks = json?.data?.items ?? [];
            } else if (param === "al") {
                albums = json?.data?.albums?.items ?? [];
            } else {
                tracks = json?.data?.tracks?.items ?? [];
                artists = json?.data?.artists?.items ?? [];
                albums = json?.data?.albums?.items ?? [];
            }

            set({
                tracks, artists, albums,
                loading: false,
                trackOffset: LIMIT,
                hasMoreTracks: tracks.length === LIMIT || artists.length === LIMIT || albums.length === LIMIT
            });
        } catch (error) {
            set({ loading: false });
        }
    },

    loadMore: async () => {
        const { query, trackOffset, tracks, artists, albums, loading, hasMoreTracks, filter } = get();
        if (loading || !hasMoreTracks || trackOffset >= MAX_OFFSET) return;
        set({ loading: true });
        const param = getApiParam(filter);

        try {
            const res = await fetch(`https://streamex.sh/api/music/search?${param}=${encodeURIComponent(query)}&limit=${LIMIT}&offset=${trackOffset}`);
            const json = await res.json();
            let newTracks = [], newArtists = [], newAlbums = [];

            if (param === "s") newTracks = json?.data?.items ?? [];
            else if (param === "al") newAlbums = json?.data?.albums?.items ?? [];
            else {
                newTracks = json?.data?.tracks?.items ?? [];
                newArtists = json?.data?.artists?.items ?? [];
                newAlbums = json?.data?.albums?.items ?? [];
            }

            set({
                tracks: [...tracks, ...newTracks],
                artists: [...artists, ...newArtists],
                albums: [...albums, ...newAlbums],
                trackOffset: trackOffset + LIMIT,
                loading: false,
                hasMoreTracks: newTracks.length === LIMIT || newArtists.length === LIMIT || newAlbums.length === LIMIT
            });
        } catch (error) {
            set({ loading: false });
        }
    },

    playTrack: async (track: Track) => {
        const { sound: oldSound } = get();
        if (oldSound) await oldSound.unloadAsync();

        set({
            currentTrack: track,
            isPlaying: true,
            syncedLyrics: [],
            currentTime: 0,
            currentLyricIndex: -1
        });

        try {
            const [trackRes, lyricsRes] = await Promise.all([
                fetch(`https://streamex.sh/api/music/track?id=${track.id}&quality=${track.audioQuality}`),
                fetch(`https://streamex.sh/api/music/lyrics?id=${track.id}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artists[0].name)}`)
            ]);

            const trackJson = await trackRes.json();
            const lyricsJson = await lyricsRes.json();

            const decodedManifest = JSON.parse(atob(trackJson.data.manifest));
            const streamUrl = decodedManifest.urls[0];

            if (lyricsJson.subtitles) {
                set({ syncedLyrics: parseLRC(lyricsJson.subtitles) });
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri: streamUrl },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded) {
                        const time = status.positionMillis / 1000;
                        const lyrics = get().syncedLyrics;
                        const index = lyrics.findLastIndex((l) => l.time <= time);

                        set({
                            currentTime: time,
                            totalDuration: status.durationMillis ? status.durationMillis / 1000 : 0,
                            currentLyricIndex: index,
                            // Sync isPlaying state with the actual audio engine state
                            isPlaying: status.isPlaying
                        });

                        // HANDLE SONG COMPLETION: 
                        // Set isPlaying to false so button returns to triangle (Play)
                        if (status.didJustFinish) {
                            set({ isPlaying: false, currentTime: 0 });
                        }
                    }
                }
            );
            set({ sound });
        } catch (error) {
            console.error("Playback Error:", error);
            set({ isPlaying: false });
        }
    },

    togglePlay: async () => {
        const { sound, isPlaying } = get();
        if (!sound) return;
        if (isPlaying) {
            await sound.pauseAsync();
        } else {
            // If the song was finished, we play from the start
            const status = await sound.getStatusAsync();
            if (status.isLoaded && status.positionMillis >= status.durationMillis!) {
                await sound.setPositionAsync(0);
            }
            await sound.playAsync();
        }
    },

    seek: async (millis: number) => {
        const { sound } = get();
        if (sound) await sound.setPositionAsync(millis);
    }
}));