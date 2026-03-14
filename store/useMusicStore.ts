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

type CombinedResult =
    | { type: "song"; score: number; data: Track }
    | { type: "album"; score: number; data: Album }
    | { type: "artist"; score: number; data: Artist };

type MusicStore = {
    query: string;
    tracks: Track[];
    artists: Artist[];
    albums: Album[];
    topResults: CombinedResult[]
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
    topResults: [],
    currentTrack: null,
    isPlaying: false,
    sound: null,
    currentTime: 0,
    totalDuration: 0,
    syncedLyrics: [],
    currentLyricIndex: -1,
    upNextTracks: [],

    setFilter: (filter) => {
        set({ filter });
    },

    searchMusic: async (query: string) => {

        if (!query) {
            set({
                query: "",
                tracks: [],
                artists: [],
                albums: [],
                topResults: [],
                trackOffset: 0,
                hasMoreTracks: true,
            });
            return;
        }

        const parseTime = (timeStr?: string): number => {
            if (!timeStr) return 0;
            const parts = timeStr.split(":").map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            return parts[0] || 0;
        };

        /* ---------- FIXED DURATION PARSER ---------- */

        const extractDuration = (r: any): string | undefined => {

            const runs =
                r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

            // find mm:ss pattern
            const runMatch = runs.find((run: any) => /^\d+:\d+$/.test(run?.text));
            if (runMatch) return runMatch.text;

            // accessibility fallback
            const label =
                r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text
                    ?.accessibility?.accessibilityData?.label;

            if (label) {
                const match = label.match(/(\d+:\d+)/);
                if (match) return match[1];
            }

            // fixed column fallback
            const fixed =
                r?.fixedColumns?.[0]
                    ?.musicResponsiveListItemFixedColumnRenderer
                    ?.text?.runs?.[0]?.text;

            if (fixed && /^\d+:\d+$/.test(fixed)) return fixed;

            return undefined;
        };

        /* ---------- FIXED MUSIC VIDEO DETECTOR ---------- */

        const isMusicVideo = (r: any) => {

            const type =
                r?.menu?.menuRenderer?.items?.[0]
                    ?.menuNavigationItemRenderer
                    ?.navigationEndpoint
                    ?.watchEndpoint
                    ?.watchEndpointMusicSupportedConfigs
                    ?.watchEndpointMusicConfig
                    ?.musicVideoType ||
                r?.overlay?.musicItemThumbnailOverlayRenderer
                    ?.content?.musicPlayButtonRenderer
                    ?.playNavigationEndpoint
                    ?.watchEndpoint
                    ?.watchEndpointMusicSupportedConfigs
                    ?.watchEndpointMusicConfig
                    ?.musicVideoType;

            return (
                type === "MUSIC_VIDEO_TYPE_ATV" ||
                type === "MUSIC_VIDEO_TYPE_OMV" ||
                type === "MUSIC_VIDEO_TYPE_PRIVATELY_OWNED_TRACK"
            );
        };

        const currentFilter = get().filter;
        const param = getApiParam(currentFilter);

        set({ loading: true, query, trackOffset: 0 });

        try {

            const requests = [];
            requests.push(fetch(`https://streamex.sh/api/music/search?s=${encodeURIComponent(query)}&limit=${LIMIT}`));
            requests.push(fetch(`https://streamex.sh/api/music/search?al=${encodeURIComponent(query)}&limit=${LIMIT}`));
            requests.push(fetch(`https://streamex.sh/api/music/search?a=${encodeURIComponent(query)}&limit=${LIMIT}`));

            requests.push(fetch(YTM_SEARCH_URL, { method: "POST", headers: YTM_HEADERS, body: JSON.stringify({ query, filter: "songs" }) }));
            requests.push(fetch(YTM_SEARCH_URL, { method: "POST", headers: YTM_HEADERS, body: JSON.stringify({ query, filter: "albums" }) }));
            requests.push(fetch(YTM_SEARCH_URL, { method: "POST", headers: YTM_HEADERS, body: JSON.stringify({ query, filter: "artists" }) }));


            const responses = await Promise.allSettled(requests);

            if (get().query !== query) return;

            let finalTracks: Track[] = [];
            let finalArtists: Artist[] = [];
            let finalAlbums: Album[] = [];

            for (const res of responses) {

                if (res.status !== "fulfilled") continue;

                const data = await res.value.json();

                console.log("Raw API response:", data);

                /* ---------------- STREAME X ---------------- */

                if (data?.data) {

                    /* ---------- STREAME X SONGS ---------- */

                    const tracks = data?.data?.tracks?.items;

                    if (tracks) {
                        for (const t of tracks) {
                            finalTracks.push({
                                id: t.id,
                                title: t.title || "Unknown",
                                duration: t.duration || 0,
                                audioQuality: t.audioQuality || "Standard",
                                artists: t.artists || [],
                                album: t.album || { id: 0, title: "Unknown Album", cover: null },
                                source: "streamex" as TrackSource,
                                thumbnail: t.album?.cover || null,
                            });
                        }
                    }

                    /* ---------- STREAME X ALBUMS ---------- */

                    const albums = data?.data?.albums?.items;

                    if (albums) {
                        for (const a of albums) {
                            finalAlbums.push({
                                id: a.id,
                                title: a.title || "Unknown Album",
                                artist: a.artist || a.artists?.[0]?.name || "Unknown Artist",
                                cover: a.cover || null,
                                source: "streamex" as TrackSource
                            });
                        }
                    }

                    /* ---------- STREAME X ARTISTS ---------- */

                    const artists = data?.data?.artists?.items;

                    if (artists) {
                        for (const a of artists) {
                            finalArtists.push({
                                id: a.id,
                                name: a.name || "Unknown Artist",
                                picture: a.picture || a.cover || null,
                                source: "streamex" as TrackSource
                            });
                        }
                    }

                    continue;
                }

                /* ---------------- YOUTUBE ---------------- */

                const sections =
                    data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
                        ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

                for (const section of sections) {

                    const shelf = section.musicShelfRenderer;
                    const card = section.musicCardShelfRenderer;

                    /* ---------- CARD ---------- */

                    if (card) {

                        try {

                            if (!isMusicVideo(card)) continue;

                            const title = card.title?.runs?.[0]?.text;
                            const videoId =
                                card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

                            const duration =
                                card.subtitle?.runs?.find((r: any) => /^\d+:\d+$/.test(r?.text))?.text;

                            const artist =
                                card.subtitle?.runs?.find((r: any) =>
                                    r.navigationEndpoint?.browseEndpoint
                                )?.text || "Unknown";

                            if (!videoId || !title) continue;

                            finalTracks.push({
                                id: videoId,
                                title,
                                duration: parseTime(duration),
                                audioQuality: "Standard",
                                source: "youtube" as TrackSource,
                                thumbnail:
                                    card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url,
                                artists: [{ id: artist, name: artist }],
                                album: { id: "yt-album", title: "YouTube Music", cover: null }
                            });

                        } catch { }
                    }

                    if (!shelf) continue;

                    const shelfTitle =
                        shelf.title?.runs?.[0]?.text?.toLowerCase() || "";

                    for (const item of shelf.contents || []) {

                        const r = item.musicResponsiveListItemRenderer;
                        if (!r) continue;

                        const browse = r.navigationEndpoint?.browseEndpoint;

                        const pageType =
                            browse?.browseEndpointContextSupportedConfigs
                                ?.browseEndpointContextMusicConfig?.pageType;

                        const thumbnails =
                            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;

                        const thumbnail =
                            thumbnails?.[thumbnails.length - 1]?.url || null;

                        /* ---------- ARTISTS ---------- */

                        if (pageType === "MUSIC_PAGE_TYPE_ARTIST" || shelfTitle.includes("artist")) {

                            const artistName =
                                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
                                    ?.text?.runs?.[0]?.text;

                            if (!artistName) continue;

                            finalArtists.push({
                                id: browse?.browseId || `artist-${Math.random()}`,
                                name: artistName,
                                picture: thumbnail,
                                source: "youtube" as TrackSource
                            });

                            continue;
                        }

                        /* ---------- ALBUMS ---------- */

                        if (pageType === "MUSIC_PAGE_TYPE_ALBUM" || shelfTitle.includes("album")) {

                            const albumTitle =
                                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
                                    ?.text?.runs?.[0]?.text;

                            const subRuns =
                                r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
                                    ?.text?.runs || [];

                            const artistRun = subRuns.find((run: any) =>
                                run.navigationEndpoint?.browseEndpoint
                                    ?.browseEndpointContextSupportedConfigs
                                    ?.browseEndpointContextMusicConfig?.pageType === "MUSIC_PAGE_TYPE_ARTIST"
                            );

                            const artistName =
                                artistRun?.text || subRuns[0]?.text || "Unknown Artist";

                            if (!albumTitle) continue;

                            finalAlbums.push({
                                id: browse?.browseId || `album-${Math.random()}`,
                                title: albumTitle,
                                artist: artistName,
                                cover: thumbnail,
                                source: "youtube" as TrackSource,
                            });

                            continue;
                        }

                        /* ---------- SONGS ---------- */

                        if (r.playlistItemData || shelfTitle.includes("song") || shelfTitle.includes("result")) {

                            if (!isMusicVideo(r)) continue;

                            const title =
                                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
                                    ?.text?.runs?.[0]?.text;

                            const videoId =
                                r.playlistItemData?.videoId ||
                                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
                                    ?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

                            if (!videoId || !title) continue;

                            const subRuns =
                                r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
                                    ?.text?.runs || [];

                            const durationStr = extractDuration(r);

                            const artistName =
                                subRuns.find((run: any) =>
                                    run.navigationEndpoint?.browseEndpoint
                                        ?.browseEndpointContextSupportedConfigs
                                        ?.browseEndpointContextMusicConfig?.pageType === "MUSIC_PAGE_TYPE_ARTIST"
                                )?.text || subRuns[0]?.text || "Unknown Artist";

                            finalTracks.push({
                                id: videoId,
                                title,
                                duration: parseTime(durationStr),
                                audioQuality: "Standard",
                                source: "youtube" as TrackSource,
                                thumbnail,
                                artists: [{ id: artistName, name: artistName }],
                                album: { id: "yt-album", title: "YouTube Music", cover: null }
                            });
                        }
                    }
                }
            }

            /* ---------- SCORE ---------- */

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
                if (track.source === "streamex" && track.audioQuality === "LOSSLESS") score += 500;

                return score;
            };

            finalTracks.sort((a, b) => calculateScore(b) - calculateScore(a));

            /* ---------- DEDUP ---------- */

            const qualityScore = (track: Track) => {

                let score = 0;

                if (track.audioQuality === "LOSSLESS") score += 100;
                if (track.audioQuality === "HI_RES") score += 90;
                if (track.audioQuality === "HIGH") score += 80;
                if (track.audioQuality === "Standard") score += 50;

                if (track.source === "streamex") score += 10;

                return score;
            };

            const bestTrackMap = new Map<string, Track>();

            for (const track of finalTracks) {

                const key =
                    `${normalize(track.title)}-${normalize(track.artists?.[0]?.name || "")}`;

                const existing = bestTrackMap.get(key);

                if (!existing) {
                    bestTrackMap.set(key, track);
                    continue;
                }

                if (qualityScore(track) > qualityScore(existing)) {
                    bestTrackMap.set(key, track);
                }
            }

            const filteredTracks = Array.from(bestTrackMap.values());

            const albumSeen = new Set<string>();

            const uniqueAlbums = finalAlbums.filter((album) => {

                const key = `${normalize(album.title)}`;

                if (albumSeen.has(key)) return false;

                albumSeen.add(key);

                return true;
            });

            finalArtists.sort((a, b) => {
                if (a.source === "youtube" && b.source !== "youtube") return -1;
                if (a.source !== "youtube" && b.source === "youtube") return 1;
                return 0;
            });

            finalAlbums.sort((a, b) => {
                if (a.source === "youtube" && b.source !== "youtube") return -1;
                if (a.source !== "youtube" && b.source === "youtube") return 1;
                return 0;
            });

            /* ---------- GLOBAL BEST MATCH ORDER (FOR ALL TAB) ---------- */

            const matchScore = (name: string) => {

                const n = normalize(name);
                const qn = normalize(query);

                if (n === qn) return 10000;
                if (n.startsWith(qn)) return 8000;
                if (n.includes(qn)) return 5000;

                return 0;
            };

            type ResultType = "song" | "album" | "artist";

            const typePriority: Record<ResultType, number> = {
                song: 3,
                album: 2,
                artist: 1
            };



            const combinedResults: CombinedResult[] = [

                ...filteredTracks.map((t): CombinedResult => ({
                    type: "song",
                    score: matchScore(t.title),
                    data: t
                })),

                ...uniqueAlbums.map((a): CombinedResult => ({
                    type: "album",
                    score: matchScore(a.title),
                    data: a
                })),

                ...finalArtists.map((a): CombinedResult => ({
                    type: "artist",
                    score: matchScore(a.name),
                    data: a
                }))
            ];


            combinedResults.sort((a, b) => {

                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                return typePriority[b.type] - typePriority[a.type];
            });

            /* ---------- REBUILD ARRAYS ---------- */


            const sortedTracks = combinedResults.filter(i => i.type === "song").map(i => i.data as Track);
            const sortedAlbums = combinedResults.filter(i => i.type === "album").map(i => i.data as Album);
            const sortedArtists = combinedResults.filter(i => i.type === "artist").map(i => i.data as Artist);

            set({
                tracks: sortedTracks,
                artists: sortedArtists,
                albums: sortedAlbums,
                topResults: combinedResults,
                loading: false,
                trackOffset: LIMIT,
                hasMoreTracks: filteredTracks.length >= LIMIT,
            });

        } catch (error) {

            console.error("Multi-Search Error:", error);

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
                console.log(" [4] YouTube source detected. Fetching stream...");

                try {
                    // 1. Fetch from your Python/yt-dlp Vercel endpoint
                    const response = await fetch(`https://moonlight-lac.vercel.app/api/stream?id=${track.id}`);

                    const contentType = response.headers.get("content-type");
                    if (!response.ok || !contentType?.includes("application/json")) {
                        const text = await response.text();
                        throw new Error(`Server status ${response.status}: ${text}`);
                    }

                    const data = await response.json();

                    if (!data.url) {
                        throw new Error("No stream URL returned from backend");
                    }

                    console.log(" [5] Stream URL obtained from yt-dlp.");

                    // 2. Create the Audio instance
                    // Note: data.duration from yt-dlp is usually in seconds
                    const { sound } = await Audio.Sound.createAsync(
                        { uri: data.url },
                        { shouldPlay: true, progressUpdateIntervalMillis: 500 }, // Smoother slider updates
                        (status) => {
                            if (status.isLoaded) {
                                set({
                                    currentTime: status.positionMillis / 1000,
                                    // Use status duration if available, else fallback to backend data
                                    totalDuration: status.durationMillis
                                        ? status.durationMillis / 1000
                                        : (data.duration || track.duration || 1),
                                    isPlaying: status.isPlaying,
                                });

                                // Handle track finish
                                if (status.didJustFinish) {
                                    set({ isPlaying: false, currentTime: 0 });
                                }
                            }
                        }
                    );

                    // 3. Store the sound instance globally
                    set({ sound, isPlaying: true });

                } catch (err) {
                    console.error(" [YouTube Error]:", err);
                    // Important: Let the user know it failed
                    set({ isPlaying: false, currentTrack: null });
                    alert("Failed to load YouTube stream. Please try again.");
                }
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