from http.server import BaseHTTPRequestHandler
import json
import yt_dlp
from urllib.parse import urlparse, parse_qs

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 1. Parse the video ID from the URL
        query = parse_qs(urlparse(self.path).query)
        video_id = query.get('id', [None])[0]

        # 2. Set Headers (CORS is essential for your Expo app)
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        if not video_id:
            self.wfile.write(json.dumps({"error": "Missing video id"}).encode())
            return

        # 3. Use yt-dlp (This is the logic that works on your LOQ!)
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'ignoreerrors': False,
            'logtostderr': False,
            'no_color': True,
            'cachedir': False,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                response = {
                    "url": info.get('url'),
                    "title": info.get('title'),
                    "duration": info.get('duration'),
                    "source": "yt-dlp-python-runtime"
                }
                self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode())