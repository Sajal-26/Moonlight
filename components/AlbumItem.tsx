import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Album } from "../store/useMusicStore"

type Props = {
    album: Album
}

function getCoverUrl(cover?: string | null) {
    if (!cover) return "https://resources.tidal.com/images/default/320x320.jpg"
    const path = cover.replace(/-/g, "/")
    return `https://resources.tidal.com/images/${path}/320x320.jpg`
}

export default function AlbumItem({ album }: Props) {
    return (
        <TouchableOpacity style={styles.container}>
            <Image
                source={{ uri: getCoverUrl(album?.cover) }}
                style={styles.cover}
            />

            <View style={styles.info}>
                <Text numberOfLines={1} style={styles.title}>
                    {album?.title ?? "Unknown Album"}
                </Text>

                <Text numberOfLines={1} style={styles.subtitle}>
                    Album
                </Text>
            </View>
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
    cover: {
        width: 48,
        height: 48,
        borderRadius: 6, // Square with rounded corners
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
    subtitle: {
        color: "#9CA3AF",
        fontSize: 13,
        marginTop: 3,
    },
})