import { decode as atob } from "base-64";
import { Audio } from "expo-av";
import { create } from "zustand";

const LIMIT = 25;
const MAX_OFFSET = 1000;

// Your Vercel proxy server
const YTM_SEARCH_URL = "https://moonlight-lac.vercel.app/api/search";
const YTM_NEXT_URL = "https://moonlight-lac.vercel.app/api/next";
const YTM_HEADERS = {
    "Content-Type": "application/json",
};

// Added "lastfm" as a source for placeholder suggestion tracks
export type TrackSource = "streamex" | "youtube" | "lastfm";

export type Track = {
    id: string | number;
    title: string;
    duration: number;
    audioQuality: string;
    source: TrackSource;
    thumbnail?: string;
    artists: { id: number | string; name: string }[];
    album: {
        id: number | string;
        title: string;
        cover: string | null;
    };
};

export type Artist = {
    id: number | string;
    name: string;
    picture: string | null;
    source: TrackSource;
};

export type Album = {
    id: number | string;
    title: string;
    cover: string | null;
    source: TrackSource;
};

export type FilterType = "all" | "songs" | "artists" | "albums";

type LyricLine = { time: number; text: string };

type MusicStore = {
    query: string;
    tracks: Track[];
    artists: Artist[];
    albums: Album[];
    loading: boolean;
    trackOffset: number;
    hasMoreTracks: boolean;
    filter: FilterType;

    currentTrack: Track | null;
    isPlaying: boolean;
    sound: Audio.Sound | null;
    currentTime: number;
    totalDuration: number;
    syncedLyrics: LyricLine[];
    currentLyricIndex: number;
    upNextTracks: Track[];

    setFilter: (filter: FilterType) => void;
    searchMusic: (query: string) => Promise<void>;
    loadMore: () => Promise<void>;
    playTrack: (track: Track) => Promise<void>;
    togglePlay: () => Promise<void>;
    seek: (millis: number) => Promise<void>;
    fetchUpNext: (track: Track) => Promise<void>;
};

const getApiParam = (filter: FilterType) => {
    if (filter === "songs") return "s";
    if (filter === "albums") return "al";
    return "a";
};

const decodeHtml = (text: string) =>
    text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const normalize = (text: string) =>
    text
        .toLowerCase()
        .replace(/&quot;/g, "")
        .replace(/&#39;/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim();

const parseDuration = (iso: string) => {
    const match = iso.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

    const h = parseInt(match?.[1] || "0");
    const m = parseInt(match?.[2] || "0");
    const s = parseInt(match?.[3] || "0");

    return h * 3600 + m * 60 + s;
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
    upNextTracks: [],

    setFilter: (filter) => {
        set({
            filter,
            trackOffset: 0,
            hasMoreTracks: true,
            tracks: [],
            artists: [],
            albums: [],
        });

        const { query, searchMusic } = get();
        if (query) searchMusic(query);
    },

    searchMusic: async (query: string) => {
        if (!query) {
            set({
                query: "",
                tracks: [],
                artists: [],
                albums: [],
                trackOffset: 0,
                hasMoreTracks: true,
            });
            return;
        }

        const filter = get().filter;
        const param = getApiParam(filter);

        set({ loading: true, query, trackOffset: 0 });

        try {
            const [streamRes, ytRes] = await Promise.allSettled([
                fetch(
                    `https://streamex.sh/api/music/search?${param}=${encodeURIComponent(
                        query
                    )}&limit=${LIMIT}&offset=0`
                ),

                // replaced YouTube API search with YouTube Music search
                fetch(YTM_SEARCH_URL, {
                    method: "POST",
                    headers: YTM_HEADERS,
                    body: JSON.stringify({
                        query
                    })
                })
            ]);

            if (get().query !== query) return;

            let finalTracks: Track[] = [];

            if (streamRes.status === "fulfilled") {
                const json = await streamRes.value.json();

                const sTracksRaw =
                    json?.data?.tracks?.items ??
                    json?.data?.items ??
                    (Array.isArray(json?.data) ? json.data : []);

                const sTracks: Track[] = sTracksRaw.map((t: any) => ({
                    id: t.id,
                    title: t.title || t.Title || "Unknown",
                    duration: t.duration || 0,
                    audioQuality: t.audioQuality || "Standard",
                    artists: t.artists || [],
                    album: t.album || { id: 0, title: "Unknown Album", cover: null },
                    source: "streamex",
                    thumbnail: t.album?.cover || null,
                }));

                finalTracks = [...sTracks];
            }

            // ---------- YOUTUBE MUSIC RESULTS ----------

            if (ytRes.status === "fulfilled") {

                const data = await ytRes.value.json();

                const sections =
                    data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
                        ?.content?.sectionListRenderer?.contents || [];

                const ytTracks: Track[] = [];

                for (const section of sections) {

                    if (section.musicCardShelfRenderer) {
                        const card = section.musicCardShelfRenderer;

                        try {
                            const title = card.title.runs[0].text;
                            const videoId = card.title.runs[0].navigationEndpoint.watchEndpoint.videoId;
                            const artist = card.subtitle.runs[2].text;

                            ytTracks.push({
                                id: videoId,
                                title,
                                duration: 0,
                                audioQuality: "Standard",
                                source: "youtube",
                                thumbnail: card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[1]?.url,
                                artists: [{ id: artist, name: artist }],
                                album: {
                                    id: "yt-album",
                                    title: "YouTube Music",
                                    cover: card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[1]?.url
                                }
                            });
                        } catch { }
                    }

                    if (section.musicShelfRenderer) {

                        for (const item of section.musicShelfRenderer.contents || []) {

                            const r = item.musicResponsiveListItemRenderer;
                            if (!r) continue;

                            try {
                                const title = r.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
                                const artist = r.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[2].text;
                                const videoId = r.playlistItemData.videoId;

                                ytTracks.push({
                                    id: videoId,
                                    title,
                                    duration: 0,
                                    audioQuality: "Standard",
                                    source: "youtube",
                                    thumbnail: r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url,
                                    artists: [{ id: artist, name: artist }],
                                    album: {
                                        id: "yt-album",
                                        title: "YouTube Music",
                                        cover: r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url
                                    }
                                });

                            } catch { }
                        }
                    }
                }

                finalTracks = [...finalTracks, ...ytTracks];
            }

            const q = query.toLowerCase().trim();

            const calculateScore = (track: Track) => {
                const title = track.title.toLowerCase();
                const artist = track.artists?.[0]?.name.toLowerCase() || "";

                let score = 0;

                if (title === q) score += 10000;
                else if (title.startsWith(q)) score += 8000;
                else if (title.includes(q)) score += 5000;

                if (artist === q) score += 2000;
                else if (artist.includes(q)) score += 1000;

                if (track.source === "streamex") score += 500;

                if (track.source === "streamex" && track.audioQuality === "LOSSLESS")
                    score += 500;

                return score;
            };

            finalTracks.sort((a, b) => calculateScore(b) - calculateScore(a));

            const seen = new Set<string>();

            finalTracks = finalTracks.filter((track) => {
                const title = normalize(track.title);
                const artist = normalize(track.artists?.[0]?.name || "");
                const key = `${title}-${artist}`;

                if (track.source === "streamex") {
                    seen.add(key);
                    return true;
                }

                if (track.source === "youtube" && seen.has(key)) {
                    return false;
                }

                return true;
            });

            set({
                tracks: finalTracks,
                loading: false,
                trackOffset: LIMIT,
                hasMoreTracks: finalTracks.length >= LIMIT,
            });
        } catch (error) {
            console.error("Search Logic Error:", error);
            set({ loading: false });
        }
    },

    loadMore: async () => { },

    // replaced LastFM suggestions with YouTube Music autoplay
    fetchUpNext: async (track: Track) => {

        try {

            const res = await fetch(YTM_NEXT_URL, {
                method: "POST",
                headers: YTM_HEADERS,
                body: JSON.stringify({
                    videoId: track.id
                })
            });

            const data = await res.json();

            const queue =
                data?.contents?.singleColumnMusicWatchNextResultsRenderer
                    ?.tabbedRenderer?.watchNextTabbedResultsRenderer
                    ?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer
                    ?.content?.playlistPanelRenderer?.contents || [];

            const suggestions: Track[] = [];

            for (const item of queue.slice(1, 15)) {

                const v = item.playlistPanelVideoRenderer;

                suggestions.push({
                    id: v.videoId,
                    title: v.title.runs[0].text,
                    duration: 0,
                    audioQuality: "Standard",
                    source: "youtube",
                    thumbnail: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                    artists: [{ id: v.longBylineText.runs[0].text, name: v.longBylineText.runs[0].text }],
                    album: {
                        id: "yt-album",
                        title: "YouTube Music",
                        cover: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
                    }
                });
            }

            set({ upNextTracks: suggestions.slice(0, 10) });

        } catch (error) {

            console.error("Failed to fetch YT Music autoplay", error);
            set({ upNextTracks: [] });

        }
    },

    playTrack: async (track: Track) => {

        const { sound: oldSound } = get();

        if (oldSound) {
            await oldSound.unloadAsync();
        }

        set({
            currentTrack: track,
            isPlaying: false,
            syncedLyrics: [],
            currentTime: 0,
            totalDuration: track.duration || 0,
            currentLyricIndex: -1,
            sound: null,
            upNextTracks: [],
        });

        get().fetchUpNext(track);

        try {

            if (track.source === "streamex") {
                const trackRes = await fetch(
                    `https://streamex.sh/api/music/track?id=${track.id}&quality=${track.audioQuality}`
                );

                const trackJson = await trackRes.json();
                const decodedManifest = JSON.parse(atob(trackJson.data.manifest));
                const streamUrl = decodedManifest.urls[0];

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
                                totalDuration: status.durationMillis
                                    ? status.durationMillis / 1000
                                    : 0,
                                currentLyricIndex: index,
                                isPlaying: status.isPlaying,
                            });

                            if (status.didJustFinish) {
                                set({ isPlaying: false, currentTime: 0 });
                            }
                        }
                    }
                );

                set({ sound, isPlaying: true });
            } else {
                console.warn("YouTube audio streaming skipped for now.");
                set({
                    isPlaying: false,
                    totalDuration: track.duration || 0
                });
            }

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
    },
}));