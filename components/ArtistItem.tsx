import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Artist } from "../store/useMusicStore"

type Props = {
    artist: Artist
}

function getPictureUrl(picture?: string | null) {

    if (!picture) {
        return "https://resources.tidal.com/images/default/320x320.jpg"
    }

    // Already a full URL (YouTube / other APIs)
    if (picture.startsWith("http")) {
        return picture
    }

    // Tidal ID format
    const path = picture.replace(/-/g, "/")
    return `https://resources.tidal.com/images/${path}/320x320.jpg`
}

export default function ArtistItem({ artist }: Props) {

    return (
        <TouchableOpacity style={styles.container} activeOpacity={0.7}>

            <Image
                source={{ uri: getPictureUrl(artist?.picture) }}
                style={styles.cover}
            />

            <View style={styles.info}>

                <Text numberOfLines={1} style={styles.title}>
                    {artist?.name ?? "Unknown Artist"}
                </Text>

                <Text numberOfLines={1} style={styles.subtitle}>
                    Artist
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
        borderRadius: 24,
        marginRight: 14,
        backgroundColor: "#1A1A22", // prevents flicker while loading
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