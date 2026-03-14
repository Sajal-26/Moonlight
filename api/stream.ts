import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Innertube } from 'youtubei.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. SET HEADERS IMMEDIATELY (Before any logic)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    const { id } = req.query;

    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Missing YouTube Video ID" });
    }

    try {
        const yt = await Innertube.create();
        const info = await yt.getInfo(id);

        const format = info.streaming_data?.adaptive_formats
            .filter(f => f.has_audio && !f.has_video)
            .sort((a, b) => (b.average_bitrate || 0) - (a.average_bitrate || 0))[0];

        if (!format || !format.url) {
            return res.status(404).json({ error: "No audio stream found" });
        }

        return res.status(200).json({
            url: format.url,
            title: info.basic_info.title,
            duration: info.basic_info.duration,
        });

    } catch (error: any) {
        console.error("Crash Log:", error.message);
        // Explicitly return CORS headers even on 500
        return res.status(500).json({
            error: "Extraction failed",
            message: error.message
        });
    }
}