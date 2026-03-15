from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

app = FastAPI()

# Allow requests from your mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "moonlight-api"
    }

@app.get("/stream")
def stream(video_id: str):

    ydl_opts = {
        "format": "251/250/249/bestaudio",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["android"]
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}",
                download=False
            )

        formats = info.get("formats", [])

        audio = next(
            (
                f for f in formats
                if f.get("acodec") != "none"
                and f.get("vcodec") == "none"
            ),
            None
        )

        stream_url = audio.get("url") if audio else info.get("url")

        return {
            "url": stream_url,
            "title": info.get("title"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
        }

    except Exception as e:
        return {"error": str(e)}