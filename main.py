from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract(video_id: str):
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "nocheckcertificate": True,
        "user_agent": "Mozilla/5.0",
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}",
            download=False
        )

    return info


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/raw")
def raw(video_id: str):
    try:
        info = extract(video_id)
        return info
    except Exception as e:
        return {"error": str(e)}


@app.get("/formats")
def formats(video_id: str):
    try:
        info = extract(video_id)

        formats = info.get("formats", [])

        result = []

        for f in formats:
            result.append({
                "format_id": f.get("format_id"),
                "ext": f.get("ext"),
                "acodec": f.get("acodec"),
                "vcodec": f.get("vcodec"),
                "abr": f.get("abr"),
                "tbr": f.get("tbr"),
                "resolution": f.get("resolution"),
                "fps": f.get("fps"),
                "filesize": f.get("filesize"),
                "url": f.get("url")
            })

        return {
            "title": info.get("title"),
            "formats": result
        }

    except Exception as e:
        return {"error": str(e)}
    
@app.get("/stream")
def stream(video_id: str):
    try:
        info = extract(video_id)
        formats = info.get("formats", [])

        audio_formats = [
            f for f in formats
            if f.get("acodec") != "none"
            and (f.get("vcodec") == "none" or f.get("vcodec") is None)
            and f.get("url")
        ]

        if not audio_formats:
            return {"error": "No audio formats found"}

        def get_score(f):
            # Start with the raw bitrate
            bitrate = f.get("abr") or f.get("tbr") or 0
            
            # Give format 251 (Opus) a 20% quality bonus 
            # because Opus sounds better than AAC at the same bitrate.
            if f.get("format_id") == "251":
                bitrate *= 1.2
                
            return bitrate

        best = max(audio_formats, key=get_score)

        return {
            "url": best.get("url"),
            "format_id": best.get("format_id"),
            "ext": best.get("ext"),
            "abr": best.get("abr") or best.get("tbr"),
            "title": info.get("title"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
        }

    except Exception as e:
        return {"error": str(e)}