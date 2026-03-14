import YTDlpWrapModule from "yt-dlp-wrap";

const YTDlpWrap = (YTDlpWrapModule as any).default;

const ytDlp = new YTDlpWrap();

const query = "Blinding Lights The Weeknd";

async function main() {
    const result = await ytDlp.execPromise([
        `ytsearch1:${query}`,
        "-f",
        "bestaudio",
        "-j",
    ]);

    const video = JSON.parse(result);

    console.log("Title:", video.title);
    console.log("Video ID:", video.id);
    console.log("\nAudio Stream URL:\n");
    console.log(video.url);
}

main();