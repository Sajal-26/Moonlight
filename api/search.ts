import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { query } = req.body;

    try {

        const ytRes = await fetch(
            "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-YouTube-Client-Name": "67",
                    "X-YouTube-Client-Version": "1.20260311.03.00"
                },
                body: JSON.stringify({
                    query,
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

        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: "search failed" });
    }
}