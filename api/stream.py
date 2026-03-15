from http.server import BaseHTTPRequestHandler
import json
import yt_dlp
import os
from urllib.parse import urlparse, parse_qs

# Your hardcoded cookies
COOKIES_DATA = [
    {"domain": ".google.com", "name": "SID", "value": "g.a0007wjVXfqV2mbNyOEUxP2-TMAdWEsQv8q-ACHaaGQ6i7-IL-NFKbVaEhuvUqW3TlDsVgRdbwACgYKAWISARUSFQHGX2MiJPmpTWU3Y28zG2HKx9NllRoVAUF8yKo0qy_wha-4IVbsfpLJSkhq0076"},
    {"domain": ".google.com", "name": "__Secure-1PSID", "value": "g.a0007wjVXfqV2mbNyOEUxP2-TMAdWEsQv8q-ACHaaGQ6i7-IL-NF8-qU10wk8rPK_EfeEPeKkQACgYKAcUSARUSFQHGX2MidKXtnLPx12_CVsx2x2qjOhoVAUF8yKrI0tY5hyQoJLKBYyhb4PvT0076"},
    {"domain": ".google.com", "name": "__Secure-3PSID", "value": "g.a0007wjVXfqV2mbNyOEUxP2-TMAdWEsQv8q-ACHaaGQ6i7-IL-NFPfljeOukRqcCPOI2nWamQwACgYKAe4SARUSFQHGX2MihP7_6O0PmcrOFqxTmcFqHxoVAUF8yKpmvUxbvy32pt2T8ELl21-K0076"},
    {"domain": ".google.com", "name": "HSID", "value": "AJ440Ec2pTiLYZy8t"},
    {"domain": ".google.com", "name": "SSID", "value": "AFDYHgC737ONvqzEU"},
    {"domain": ".google.com", "name": "APISID", "value": "__-HlH-sevBg2Sa3/A0D8VrpenWklfRQj6"},
    {"domain": ".google.com", "name": "SAPISID", "value": "EsZ3ijHVbkoUruQv/AufOuBBNUmQ_AbAYR"},
    {"domain": ".google.com", "name": "__Secure-1PAPISID", "value": "EsZ3ijHVbkoUruQv/AufOuBBNUmQ_AbAYR"},
    {"domain": ".google.com", "name": "__Secure-3PAPISID", "value": "EsZ3ijHVbkoUruQv/AufOuBBNUmQ_AbAYR"},
    {"domain": ".google.com", "name": "SEARCH_SAMESITE", "value": "CgQIrKAB"},
    {"domain": ".google.com", "name": "__Secure-BUCKET", "value": "CPME"},
    {"domain": ".google.com", "name": "AEC", "value": "AaJma5urftr6bKZnRnAL9NrZSOlHtwnMoDERB0c1SHTFcKMlh7OMaYgdqQ"},
    {"domain": ".google.com", "name": "NID", "value": "529=NARZNcuS7KB4srLgTNUx9OtaV61nGJq4i9EHUiUonJ7fABWYE254_35QLSFRhusfvcMYUiLZmCepC2SuxsHilsD0mD8V2y5ENrFxNmwTyxkvggmYgQmGQXWfM1NMbH1kS6fjn3RrNORojzqyLKhkh7d1VppGjoFPuhSSAYYCQlhC3rGyKzHU6BuQksuxVUAakMk1fzCEpH5R9uMv_B795Uu7Efq7t3nnWs8QOa9GIBOloyD59lanJPxM-WvrYKFYt6qeQv8JTBT8Yw4fhGC6tpxDY0JebnRm4BjPheEyfkLTds2W_pwBCUYncggL2lns7z8S9nkTSN8p7wnC-oEWbZkP_gAi1A4UopZbiFNe6QvfodPZmCAvKTDWbrprymlW30GXRWU0AqIvUGS0Se_EwUurzFOo8rzCyMjKEfTSydkzjPAvXW9k_k0OamhtDMEcItCoOGbxT9JVRk5ycoiEkH1TkP_Kub4Z5mufy2sH6EjTxaKVflgdzkrZmIiDFVIUrn_jy6f6xg7Okl6sxDneng0lMzXCcm1OWVDzetYQvRCw9qne6uC9_86RStsHjEe7GjK0Pq_PhLMiHN-YFL7dtt7tQ8FV8zO3LgAQbYskpbR7NX3gB059xxRA8Gq745FITK734TD0JDpBH2tAoJAfQo1-8BpZlYsnM8AHgb9tfy0H9fvKKjSKifR00GEHZfboEN3LlcWT54yXHc-LgWpmQ9cqP_SO4qgRXNuRACbSZAtyOL6ynWNvepkUvTsC0SkcuGJnaXpGr6YterZX"},
    {"domain": ".google.com", "name": "__Secure-1PSIDTS", "value": "sidts-CjIBBj1CYqGS5UmM0XT2GiswAhBgahLtnldzijWadarYUijpyMXNgbJaQFkZVKczyMMNsRAA"},
    {"domain": ".google.com", "name": "__Secure-3PSIDTS", "value": "sidts-CjIBBj1CYqGS5UmM0XT2GiswAhBgahLtnldzijWadarYUijpyMXNgbJaQFkZVKczyMMNsRAA"},
    {"domain": ".google.com", "name": "SIDCC", "value": "AKEyXzUyFOr1a18ZqP53DGiNkJpbEXnaGk_14tVTSEXKT9gK9w75Ole4B2Gg5ryPmYnyA1e3i1Q"},
    {"domain": ".google.com", "name": "__Secure-1PSIDCC", "value": "AKEyXzX2kp4L-e5vxq2QVyaPPi6tGpcGabG1XPNgxuJFu_9CAk31jpgLbhbntpJTjeT_fhvyeQ"},
    {"domain": ".google.com", "name": "__Secure-3PSIDCC", "value": "AKEyXzWJyfM_o53xUfnkZLHOI8zDMajzA_Gk_nCu7SSJW33ifWzHjmCesudlmCqzCMAlu3P460g"}
]

def generate_cookie_file(file_path):
    with open(file_path, 'w') as f:
        f.write("# Netscape HTTP Cookie File\n")
        for c in COOKIES_DATA:
            domain = c.get('domain', '.google.com')
            flag = "TRUE" if domain.startswith('.') else "FALSE"
            path = "/"
            secure = "TRUE"
            expiry = "2147483647"
            name = c.get('name')
            value = c.get('value')
            f.write(f"{domain}\t{flag}\t{path}\t{secure}\t{expiry}\t{name}\t{value}\n")

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        video_id = query.get('id', [None])[0]

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        if not video_id:
            self.wfile.write(json.dumps({"error": "Missing video id"}).encode())
            return

        # Vercel-specific: Writing to /tmp is required
        cookie_file = os.path.join('/tmp', 'cookies.txt')
        generate_cookie_file(cookie_file)

        ydl_opts = {
            'format': 'bestaudio/best',
            'cookiefile': cookie_file,
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                response = {
                    "url": info.get('url'),
                    "title": info.get('title'),
                    "duration": info.get('duration'),
                    "thumbnail": info.get('thumbnail')
                }
                self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode())