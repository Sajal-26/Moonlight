import { StatusBar } from "expo-status-bar";
import { useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, ListRenderItem, Platform, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // Fixed Safe Area
import AlbumItem from "../components/AlbumItem";
import ArtistItem from "../components/ArtistItem";
import SearchFilters from "../components/SearchFilters";
import SongItem from "../components/SongItem";
import { Album, Artist, Track, useMusicStore } from "../store/useMusicStore";

type ListItem =
    | { type: "track"; item: Track }
    | { type: "artist"; item: Artist }
    | { type: "album"; item: Album }

export default function Search() {
    const {
        tracks,
        artists,
        albums,
        searchMusic,
        loadMore,
        loading,
        hasMoreTracks,
        filter,
        query
    } = useMusicStore()

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleSearch = (text: string) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => {
            searchMusic(text)
        }, 500)
    }

    const listData = useMemo<ListItem[]>(() => {
        if (filter === "songs") return tracks.map((t) => ({ type: "track", item: t }))
        if (filter === "artists") return artists.map((a) => ({ type: "artist", item: a }))
        if (filter === "albums") return albums.map((a) => ({ type: "album", item: a }))

        if (filter === "all") {
            return [
                ...artists.slice(0, 3).map((a) => ({ type: "artist" as const, item: a })),
                ...albums.slice(0, 3).map((a) => ({ type: "album" as const, item: a })),
                ...tracks.map((t) => ({ type: "track" as const, item: t })),
            ]
        }
        return []
    }, [filter, tracks, artists, albums])

    const renderItem: ListRenderItem<ListItem> = ({ item }) => {
        switch (item.type) {
            case "track": return <SongItem song={item.item} />
            case "artist": return <ArtistItem artist={item.item} />
            case "album": return <AlbumItem album={item.item} />
            default: return null
        }
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="light" />

            <View style={styles.searchSection}>
                <TextInput
                    placeholder="Search music, artists..."
                    placeholderTextColor="#999"
                    defaultValue={query}
                    onChangeText={handleSearch}
                    style={styles.searchBar}
                    selectionColor="#E1B07E" // Match your lossless/brand color
                />
            </View>

            <View style={styles.filterWrapper}>
                <SearchFilters />
            </View>

            <FlatList<ListItem>
                data={listData}
                keyExtractor={(item, index) => `${item.type}-${item.item.id}-${index}`}
                renderItem={renderItem}
                onEndReached={() => {
                    if (!loading && hasMoreTracks && (filter === "songs" || filter === "all")) {
                        loadMore()
                    }
                }}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.listPadding}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                    loading ? (
                        <ActivityIndicator
                            size="small"
                            color="#E1B07E"
                            style={{ marginVertical: 30 }}
                        />
                    ) : <View style={{ height: 120 }} /> // Space for the MiniPlayer
                }
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0B0B0F"
    },
    searchSection: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 10 : 0,
        marginBottom: 8,
    },
    searchBar: {
        height: 52,
        paddingHorizontal: 18,
        borderRadius: 14,
        backgroundColor: "#1A1A22",
        color: "white",
        fontSize: 16,
        fontWeight: '500',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    filterWrapper: {
        marginBottom: 8,
    },
    listPadding: {
        paddingBottom: 20,
    }
})