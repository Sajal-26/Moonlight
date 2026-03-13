import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    const { q } = req.query;

    if (!q) {
        return res.status(400).json({ error: "Missing query" });
    }

    try {
        const response = await axios.get(
            `https://lrclib.net/api/search?q=${encodeURIComponent(String(q))}`
        );

        res.setHeader("Access-Control-Allow-Origin", "*");

        return res.status(200).json(response.data);
    } catch {
        return res.status(500).json({
            error: "Lyrics fetch failed",
        });
    }
}