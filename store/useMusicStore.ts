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
            set({ query: "", tracks: [], artists: [], albums: [], trackOffset: 0, hasMoreTracks: true });
            return;
        }

        // Helper to convert "3:45" to seconds
        const parseTime = (timeStr) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            return parts[0] || 0;
        };

        const filter = get().filter;
        const param = getApiParam(filter);

        set({ loading: true, query, trackOffset: 0 });

        try {
            const [streamRes, ytRes] = await Promise.allSettled([
                fetch(`https://streamex.sh/api/music/search?${param}=${encodeURIComponent(query)}&limit=${LIMIT}&offset=0`),
                fetch(YTM_SEARCH_URL, {
                    method: "POST",
                    headers: YTM_HEADERS,
                    body: JSON.stringify({ query, filter }) // Passing filter to backend
                })
            ]);

            if (get().query !== query) return;

            let finalTracks = [];

            // --- STREAMEX PARSING ---
            if (streamRes.status === "fulfilled") {
                const json = await streamRes.value.json();
                const sTracksRaw = json?.data?.tracks?.items ?? json?.data?.items ?? (Array.isArray(json?.data) ? json.data : []);

                const sTracks = sTracksRaw.map((t) => ({
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

            // --- YOUTUBE MUSIC PARSING ---
            if (ytRes.status === "fulfilled") {
                const data = await ytRes.value.json();
                const sections = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
                const ytTracks = [];

                for (const section of sections) {
                    // Handle Hero/Top result card
                    if (section.musicCardShelfRenderer) {
                        const card = section.musicCardShelfRenderer;
                        try {
                            const title = card.title.runs[0].text;
                            const videoId = card.title.runs[0].navigationEndpoint.watchEndpoint.videoId;
                            const artist = card.subtitle.runs[2]?.text || "Unknown";
                            const durationStr = card.subtitle.runs[card.subtitle.runs.length - 1]?.text;

                            ytTracks.push({
                                id: videoId,
                                title,
                                duration: parseTime(durationStr),
                                audioQuality: "Standard",
                                source: "youtube",
                                thumbnail: card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[1]?.url,
                                artists: [{ id: artist, name: artist }],
                                album: { id: "yt-album", title: "YouTube Music", cover: null }
                            });
                        } catch { }
                    }

                    // Handle List results
                    if (section.musicShelfRenderer) {
                        for (const item of section.musicShelfRenderer.contents || []) {
                            const r = item.musicResponsiveListItemRenderer;
                            if (!r || !r.playlistItemData) continue;

                            try {
                                const title = r.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
                                const videoId = r.playlistItemData.videoId;

                                // Extract artist and duration from the second column
                                const subRuns = r.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs;
                                const artist = subRuns[0]?.text || "Unknown";
                                const durationStr = subRuns[subRuns.length - 1]?.text;

                                ytTracks.push({
                                    id: videoId,
                                    title,
                                    duration: parseTime(durationStr),
                                    audioQuality: "Standard",
                                    source: "youtube",
                                    thumbnail: r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url,
                                    artists: [{ id: artist, name: artist }],
                                    album: { id: "yt-album", title: "YouTube Music", cover: null }
                                });
                            } catch { }
                        }
                    }
                }
                finalTracks = [...finalTracks, ...ytTracks];
            }

            // --- SCORING & DEDUPLICATION ---
            const q = query.toLowerCase().trim();
            const calculateScore = (track) => {
                const title = track.title.toLowerCase();
                const artist = track.artists?.[0]?.name.toLowerCase() || "";
                let score = 0;
                if (title === q) score += 10000;
                else if (title.startsWith(q)) score += 8000;
                else if (title.includes(q)) score += 5000;
                if (artist === q) score += 2000;
                if (track.source === "streamex") score += 500;
                return score;
            };

            finalTracks.sort((a, b) => calculateScore(b) - calculateScore(a));

            const seen = new Set();
            const filteredTracks = finalTracks.filter((track) => {
                const key = `${normalize(track.title)}-${normalize(track.artists?.[0]?.name || "")}`;
                if (track.source === "streamex") {
                    seen.add(key);
                    return true;
                }
                return !seen.has(key);
            });

            set({
                tracks: filteredTracks,
                loading: false,
                trackOffset: LIMIT,
                hasMoreTracks: filteredTracks.length >= LIMIT,
            });
        } catch (error) {
            console.error("Search Logic Error:", error);
            set({ loading: false });
        }
    },

    loadMore: async () => { },

    fetchUpNext: async (track: Track) => {
        console.log(" [Next] Starting Fast Parallel Pipeline...");

        // Helper: Checks if titles are a 50%+ match
        const getSimilarity = (s1: string, s2: string) => {
            const n1 = normalize(s1 || "");
            const n2 = normalize(s2 || "");
            if (!n1 || !n2) return 0;
            if (n1 === n2) return 1.0;
            if (n1.includes(n2) || n2.includes(n1)) return 0.8; // High confidence for containment

            const set1 = new Set(n1.split(""));
            const set2 = new Set(n2.split(""));
            const intersection = new Set([...set1].filter(x => set2.has(x)));
            return intersection.size / Math.max(set1.size, set2.size);
        };

        try {
            // --- STEP 1: BRIDGE TO YOUTUBE SEED ---
            let seedVideoId = track.source === "youtube" ? track.id : null;

            if (!seedVideoId) {
                console.log(" [Next] 1. Bridging Streamex to YouTube...");
                const cleanTitle = track.title.replace(/\(.*\)|\[.*\]/g, "").trim();
                const query = `${cleanTitle} ${track.artists?.[0]?.name || ""}`;

                const seedRes = await fetch(YTM_SEARCH_URL, {
                    method: "POST",
                    headers: YTM_HEADERS,
                    body: JSON.stringify({ query })
                });
                const seedData = await seedRes.json();

                const sections = seedData?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

                for (const section of sections) {
                    if (section.musicCardShelfRenderer) {
                        seedVideoId = section.musicCardShelfRenderer.title.runs[0].navigationEndpoint.watchEndpoint.videoId;
                    } else if (section.musicShelfRenderer) {
                        seedVideoId = section.musicShelfRenderer.contents[0]?.musicResponsiveListItemRenderer?.playlistItemData?.videoId;
                    }
                    if (seedVideoId) break;
                }
            }

            if (!seedVideoId) return console.warn(" [Next] No YouTube seed found.");

            // --- STEP 2: FETCH RECOMMENDATIONS ---
            const ytNextRes = await fetch(YTM_NEXT_URL, {
                method: "POST",
                headers: YTM_HEADERS,
                body: JSON.stringify({ videoId: seedVideoId })
            });
            const ytData = await ytNextRes.json();

            const ytQueue = ytData?.contents?.singleColumnMusicWatchNextResultsRenderer
                ?.tabbedRenderer?.watchNextTabbedResultsRenderer
                ?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer
                ?.content?.playlistPanelRenderer?.contents || [];

            const rawSuggestions = ytQueue.slice(1, 11); // Take top 10

            // --- STEP 3: PARALLEL STREAME-X UPGRADE (0.5 ACCURACY) ---
            console.log(" [Next] 3. Upgrading suggestions via Parallel Streamex calls...");

            const upgradePromises = rawSuggestions.map(async (item: any) => {
                const v = item.playlistPanelVideoRenderer;
                if (!v) return null;

                const ytTitle = v.title?.runs?.[0]?.text;
                const ytArtist = v.longBylineText?.runs?.[0]?.text || "Unknown";
                const ytThumb = v.thumbnail?.thumbnails?.[0]?.url;

                try {
                    // Search Streamex for each recommendation
                    const sRes = await fetch(`https://streamex.sh/api/music/search?s=${encodeURIComponent(ytTitle)}&limit=3`);
                    const sJson = await sRes.json();
                    const sTracks = sJson?.data?.tracks?.items ?? sJson?.data?.items ?? (Array.isArray(sJson?.data) ? sJson.data : []);

                    // Check for 0.5+ similarity match
                    const bestMatch = sTracks.find((st: any) => getSimilarity(st.title || st.Title, ytTitle) >= 0.5);

                    if (bestMatch) {
                        return {
                            id: bestMatch.id,
                            title: bestMatch.title || bestMatch.Title,
                            duration: bestMatch.duration || 0,
                            audioQuality: bestMatch.audioQuality || "Standard",
                            source: "streamex",
                            thumbnail: bestMatch.album?.cover || ytThumb,
                            artists: bestMatch.artists || [{ id: ytArtist, name: ytArtist }],
                            album: bestMatch.album || { id: "yt-album", title: "YouTube Music", cover: null }
                        };
                    }

                    // Fallback to YouTube if match score < 0.5
                    return {
                        id: v.videoId, title: ytTitle, duration: 0, audioQuality: "Standard",
                        source: "youtube", thumbnail: ytThumb,
                        artists: [{ id: ytArtist, name: ytArtist }],
                        album: { id: "yt-album", title: "YouTube Music", cover: ytThumb }
                    };
                } catch {
                    return null;
                }
            });

            // Resolve all searches at the same time
            const finalResults = (await Promise.all(upgradePromises)).filter(Boolean);
            set({ upNextTracks: finalResults });
            console.log(" [Next] Smart queue ready.");

        } catch (error) {
            console.error(" [Next] Error in pipeline:", error);
        }
    },

    playTrack: async (track: Track) => {
        console.log(" [1] playTrack invoked for:", track.title, "| Source:", track.source);

        const { sound: oldSound } = get();

        // 1. Cleanup old instances
        if (oldSound) {
            console.log(" [2] Cleaning up previous sound instance...");
            try {
                await oldSound.unloadAsync();
            } catch (e) {
                console.warn(" [2a] Failed to unload sound cleanly:", e);
            }
        }

        // 2. Reset UI State immediately
        set({
            currentTrack: track,
            isPlaying: false,
            syncedLyrics: [],
            currentTime: 0,
            // Set a small default to avoid "Slider limit" errors if UI renders before metadata
            totalDuration: track.duration > 0 ? track.duration : 1,
            currentLyricIndex: -1,
            sound: null,
            upNextTracks: [],
        });

        // 3. Kick off background tasks
        get().fetchUpNext(track);

        try {
            // --- STEP A: LYRICS FETCHING (Multi-Source) ---
            console.log(" [3] Starting Lyrics Pipeline...");
            let lyricsFound = false;

            // Try Source 1: Streamex (Primary)
            try {
                console.log(" [3a] Fetching from Streamex API...");
                const lyricsRes = await fetch(`https://streamex.sh/api/music/lyrics?id=${track.id}`);
                const lyricsData = await lyricsRes.json();

                if (lyricsData?.data?.lrc) {
                    console.log(" [3b] Found LRC on Streamex.");
                    set({ syncedLyrics: parseLRC(lyricsData.data.lrc) });
                    lyricsFound = true;
                }
            } catch (err) {
                console.log(" [3c] Streamex lyrics unavailable.");
            }

            // Try Source 2: LRCLIB (Fallback)
            if (!lyricsFound) {
                console.log(" [3d] Falling back to LRCLIB...");
                try {
                    const artist = track.artists[0]?.name || "Unknown";
                    const fallbackUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track.title)}`;

                    const fRes = await fetch(fallbackUrl);
                    if (fRes.ok) {
                        const fData = await fRes.json();
                        if (fData.syncedLyrics) {
                            console.log(" [3e] Synced lyrics found on LRCLIB.");
                            set({ syncedLyrics: parseLRC(fData.syncedLyrics) });
                            lyricsFound = true;
                        } else {
                            console.log(" [3f] LRCLIB: No synced version found.");
                        }
                    }
                } catch (err) {
                    console.error(" [3g] LRCLIB search failed:", err);
                }
            }

            if (!lyricsFound) console.warn(" [3h] No lyrics found for this track.");

            // --- STEP B: AUDIO STREAMING ---
            if (track.source === "streamex") {
                console.log(" [4] Fetching Streamex Manifest...");
                const trackRes = await fetch(
                    `https://streamex.sh/api/music/track?id=${track.id}&quality=${track.audioQuality}`
                );

                const trackJson = await trackRes.json();
                console.log(" [5] Manifest received. Decoding Base64...");

                const decodedManifest = JSON.parse(atob(trackJson.data.manifest));
                const streamUrl = decodedManifest.urls[0];
                console.log(" [6] Stream URL prepared:", streamUrl);

                const { sound } = await Audio.Sound.createAsync(
                    { uri: streamUrl },
                    { shouldPlay: true },
                    (status) => {
                        if (status.isLoaded) {
                            const time = status.positionMillis / 1000;
                            const lyrics = get().syncedLyrics;

                            // Find the lyric index where time is >= current playback time
                            const index = lyrics.findLastIndex((l) => l.time <= time);

                            set({
                                currentTime: time,
                                totalDuration: status.durationMillis ? status.durationMillis / 1000 : 1,
                                currentLyricIndex: index,
                                isPlaying: status.isPlaying,
                            });

                            if (status.didJustFinish) {
                                console.log(" [Playback] Track finished.");
                                set({ isPlaying: false, currentTime: 0 });
                            }
                        } else if (status.error) {
                            console.error(" [Playback Error] Status error:", status.error);
                        }
                    }
                );

                set({ sound, isPlaying: true });
                console.log(" [7] Playback initiated successfully.");

            } else if (track.source === "youtube") {
                console.log(" [4] YouTube source detected. (Requires proxy for audio stream)");
                // If you have a YouTube audio extractor endpoint, add it here.
                set({ isPlaying: false });
            }

        } catch (error) {
            console.error(" [FATAL] playTrack Error:", error);
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