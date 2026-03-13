import { Pressable, StyleSheet, Text, View } from "react-native"
import { useMusicStore } from "../store/useMusicStore"

const filters = ["all", "songs", "artists", "albums"] as const

export default function SearchFilters() {
    const { filter, setFilter } = useMusicStore()

    return (
        <View style={styles.container}>
            {filters.map((f) => (
                <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[
                        styles.button,
                        filter === f && styles.active
                    ]}
                >
                    <Text
                        style={[
                            styles.text,
                            filter === f && styles.activeText
                        ]}
                    >
                        {f.toUpperCase()}
                    </Text>
                </Pressable>
            ))}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        paddingHorizontal: 16,
        marginBottom: 8,
    },

    button: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: "#14141A",
        marginRight: 8,
    },

    active: {
        backgroundColor: "#3B82F6",
    },

    text: {
        color: "#AAA",
        fontSize: 12,
        fontWeight: "600",
    },

    activeText: {
        color: "white",
    },
})