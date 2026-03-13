import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {

    // CORS HEADERS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight request
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const q = req.query.q;

    if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Missing query" });
    }

    try {

        const response = await axios.get(
            `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`
        );

        return res.status(200).json(response.data);

    } catch (err) {

        console.error("Lyrics fetch error:", err);

        return res.status(500).json({
            error: "Lyrics fetch failed",
        });

    }
}