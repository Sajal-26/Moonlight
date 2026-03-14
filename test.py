import yt_dlp

query = "Blinding Lights The Weeknd"

ydl_opts = {
    "quiet": True,
    "format": "bestaudio",
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(f"ytsearch1:{query}", download=False)

    video = info["entries"][0]

    stream_url = video["url"]

    print("Title:", video["title"])
    print("Video ID:", video["id"])
    print("\nAudio Stream URL:\n")
    print(stream_url)