from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import yt_dlp
from urllib.parse import urlparse, parse_qs

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 1. Parse the video ID from the URL
        query = parse_qs(urlparse(self.path).query)
        # We look for /api/stream?id=... or just ?id=...
        video_id = query.get('id', [None])[0]

        # 2. Set Headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        if not video_id:
            self.wfile.write(json.dumps({"error": "Missing video id"}).encode())
            return

        # 3. Use yt-dlp
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'ignoreerrors': False,
            'logtostderr': False,
            'no_color': True,
            'cachedir': False,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                response = {
                    "url": info.get('url'),
                    "title": info.get('title'),
                    "duration": info.get('duration'),
                    "source": "yt-dlp-local-python"
                }
                self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode())

# --- ADD THIS PART TO RUN LOCALLY ---
if __name__ == '__main__':
    server_address = ('', 3000)
    httpd = HTTPServer(server_address, handler)
    print("LOQ Server running on http://localhost:3000 ...")
    httpd.serve_forever()