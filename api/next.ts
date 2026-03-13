import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";

const YTM_HEADERS = {
    "Content-Type": "application/json",
    "X-YouTube-Client-Name": "67",
    "X-YouTube-Client-Version": "1.20260311.03.00",
};

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const response = await axios.post(
            "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
            req.body,
            { headers: YTM_HEADERS }
        );

        res.setHeader("Access-Control-Allow-Origin", "*");

        return res.status(200).json(response.data);
    } catch (error: any) {
        return res.status(500).json({
            error: "Next failed",
            message: error.message,
        });
    }
}