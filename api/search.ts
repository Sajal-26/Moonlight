import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { query, filter } = req.body;

    if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
    }

    // YT Music category tokens
    const filterMap: Record<string, string> = {
        songs: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
        albums: "EgWKAQIYAWoKEAkQChADFAMQBA%3D%3D",
        artists: "EgWKAQIYAWoKEAkQChADGAsQBA%3D%3D",
    };

    const params = filterMap[filter] || filterMap.songs;

    try {

        const ytRes = await fetch(
            "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-YouTube-Client-Name": "67",
                    "X-YouTube-Client-Version": "1.20260311.03.00",
                    "Origin": "https://music.youtube.com",
                    "User-Agent": "Mozilla/5.0"
                },
                credentials: "omit",
                body: JSON.stringify({
                    query,
                    params,
                    context: {
                        client: {
                            clientName: "WEB_REMIX",
                            clientVersion: "1.20260311.03.00"
                        }
                    }
                })
            }
        );

        const data = await ytRes.json();

        // basic caching
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

        return res.status(200).json(data);

    } catch (error) {

        console.error("Search error:", error);

        return res.status(500).json({
            error: "Search failed"
        });
    }
}