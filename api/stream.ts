import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Innertube } from 'youtubei.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Setup Headers for CORS & Cache
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate"); // Cache links for 1 hour

    if (req.method === "OPTIONS") return res.status(200).end();

    const { id } = req.query;

    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Missing YouTube Video ID" });
    }

    try {
        // 2. Initialize InnerTube
        const yt = await Innertube.create();

        // 3. Get Video Info
        const info = await yt.getInfo(id);

        // 4. Select the best Audio-Only format
        // We filter for formats that have audio but NO video
        const format = info.streaming_data?.adaptive_formats
            .filter(f => f.has_audio && !f.has_video)
            .sort((a, b) => (b.average_bitrate || 0) - (a.average_bitrate || 0))[0];

        if (!format || !format.url) {
            throw new Error("Could not find a valid audio stream.");
        }

        // 5. Return clean metadata and URL
        return res.status(200).json({
            url: format.url,
            title: info.basic_info.title,
            duration: info.basic_info.duration,
            quality: format.audio_quality,
            bitrate: format.bitrate
        });

    } catch (error: any) {
        console.error("Stream Extraction Error:", error.message);
        return res.status(500).json({ error: "Failed to extract audio stream" });
    }
}