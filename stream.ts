import type { VercelRequest, VercelResponse } from "@vercel/node";
import YTDlpWrapModule from "yt-dlp-wrap";

// Handling the ES Module import for yt-dlp-wrap
const YTDlpWrap = (YTDlpWrapModule as any).default || YTDlpWrapModule;
const ytDlp = new YTDlpWrap();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") return res.status(200).end();

    const { id } = req.query;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Video ID is required" });
    }

    try {
        const url = `https://www.youtube.com/watch?v=${id}`;

        // Executing yt-dlp with the exact same flags that worked in your main()
        const result = await ytDlp.execPromise([
            url,
            "-f", "bestaudio",
            "-j", // Output metadata as JSON
        ]);

        const video = JSON.parse(result);

        return res.status(200).json({
            url: video.url,
            title: video.title,
            duration: video.duration,
            source: "yt-dlp"
        });

    } catch (error: any) {
        console.error("yt-dlp Error:", error);
        return res.status(500).json({
            error: "yt-dlp failed",
            message: error.message
        });
    }
}