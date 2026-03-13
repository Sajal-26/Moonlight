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
    if (!cover) {
        return "https://resources.tidal.com/images/default/320x320.jpg"
    }

    if (cover.startsWith("http")) return cover

    const path = cover.replace(/-/g, "/")
    return `https://resources.tidal.com/images/${path}/320x320.jpg`
}

export default function SongItem({ song }: Props) {

    const playTrack = useMusicStore((state) => state.playTrack)
    const currentTrack = useMusicStore((state) => state.currentTrack)

    const isPlayingThis =
        currentTrack?.id === song.id &&
        currentTrack?.source === song.source

    function resolveImage(song: Track) {
        if (song.thumbnail && song.thumbnail.startsWith("http")) {
            return song.thumbnail
        }

        if (song.album?.cover) {
            return getCoverUrl(song.album.cover)
        }

        return "https://resources.tidal.com/images/default/320x320.jpg"
    }

    const imageUri = resolveImage(song)

    return (
        <TouchableOpacity
            style={[styles.container, isPlayingThis && styles.activeContainer]}
            activeOpacity={0.7}
            onPress={() => playTrack(song)}
        >
            <Image
                source={{ uri: imageUri }}
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

                    <View style={styles.losslessBadge}>
                        <Text style={styles.losslessText}>
                            {song.source === "youtube"
                                ? "HIGH"
                                : song?.audioQuality ?? "HIGH"}
                        </Text>
                    </View>

                    <Text numberOfLines={1} style={styles.artist}>
                        {song?.artists?.[0]?.name ?? "Unknown Artist"}
                    </Text>
                </View>
            </View>

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
        backgroundColor: "rgba(124,108,242,0.05)",
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
        color: "#7C6CF2",
    },

    artistRow: {
        flexDirection: "row",
        alignItems: "center",
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
        backgroundColor: "rgba(225,176,126,0.1)",
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
        marginRight: 6,
        borderWidth: 0.5,
        borderColor: "rgba(225,176,126,0.3)",
    },

    losslessText: {
        color: "#E1B07E",
        fontSize: 8,
        fontWeight: "900",
    },
})