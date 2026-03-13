import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Track, useMusicStore } from "../store/useMusicStore"

type Props = {
    song: Track
}

function formatDuration(seconds?: number) {
    if (!seconds) return "0:00"
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

function getCoverUrl(cover?: string | null) {
    if (!cover) return "https://resources.tidal.com/images/default/320x320.jpg"
    const path = cover.replace(/-/g, "/")
    return `https://resources.tidal.com/images/${path}/320x320.jpg`
}

export default function SongItem({ song }: Props) {
    // 1. Hook into the playTrack action instead of setCurrentTrack
    const playTrack = useMusicStore((state) => state.playTrack)
    const currentTrack = useMusicStore((state) => state.currentTrack)

    // Check if this specific song is the one currently playing
    const isPlayingThis = currentTrack?.id === song.id

    return (
        <TouchableOpacity
            style={[styles.container, isPlayingThis && styles.activeContainer]}
            activeOpacity={0.7}
            onPress={() => playTrack(song)} // 2. Trigger the full playback logic
        >
            <Image
                source={{ uri: getCoverUrl(song?.album?.cover) }}
                style={styles.cover}
            />

            <View style={styles.info}>
                <Text
                    numberOfLines={1}
                    style={[styles.title, isPlayingThis && styles.activeTitle]}
                >
                    {song?.title ?? "Unknown"}
                </Text>

                <View style={styles.artistRow}>
                    {song?.audioQuality === "LOSSLESS" && (
                        <View style={styles.losslessBadge}>
                            <Text style={styles.losslessText}>LOSSLESS</Text>
                        </View>
                    )}
                    <Text numberOfLines={1} style={styles.artist}>
                        {song?.artists?.[0]?.name ?? "Unknown Artist"}
                    </Text>
                </View>
            </View>

            {/* If playing, show a small speaker icon instead of duration (optional but looks cool) */}
            <Text style={styles.duration}>
                {formatDuration(song?.duration)}
            </Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    activeContainer: {
        backgroundColor: 'rgba(124, 108, 242, 0.05)', // Subtle highlight for playing song
    },
    cover: {
        width: 48,
        height: 48,
        borderRadius: 6,
        marginRight: 14,
    },
    info: {
        flex: 1,
    },
    title: {
        color: "white",
        fontSize: 16,
        fontWeight: "500",
    },
    activeTitle: {
        color: '#7C6CF2', // Highlight title in your brand purple
    },
    artistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    artist: {
        color: "#9CA3AF",
        fontSize: 13,
    },
    duration: {
        color: "#9CA3AF",
        fontSize: 13,
    },
    losslessBadge: {
        backgroundColor: 'rgba(225, 176, 126, 0.1)', // Matches the player's gold tone
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
        marginRight: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(225, 176, 126, 0.3)',
    },
    losslessText: {
        color: '#E1B07E',
        fontSize: 8,
        fontWeight: '900',
    },
})