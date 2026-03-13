import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Track, useMusicStore } from '../store/useMusicStore';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const useNativeDriver = Platform.OS !== 'web';
const LYRIC_LINE_HEIGHT = 70;

export default function Player() {

    const {
        currentTrack,
        isPlaying,
        togglePlay,
        currentTime,
        totalDuration,
        seek,
        syncedLyrics,
        currentLyricIndex,
        upNextTracks, // Extracting the actual suggested tracks
        playTrack // Extracting playTrack to play a suggestion
    } = useMusicStore();

    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'PLAYER' | 'UP NEXT' | 'LYRICS' | 'RELATED'>('PLAYER');
    const [isLiked, setIsLiked] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);

    const lyricScrollRef = useRef<ScrollView>(null);

    const slideAnimLyrics = useRef(new Animated.Value(0)).current;
    const slideAnimUpNext = useRef(new Animated.Value(0)).current;
    const slideAnimRelated = useRef(new Animated.Value(0)).current;
    const slideAnimMenu = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(slideAnimLyrics, { toValue: activeTab === 'LYRICS' ? 1 : 0, friction: 8, tension: 40, useNativeDriver }).start();
        Animated.spring(slideAnimUpNext, { toValue: activeTab === 'UP NEXT' ? 1 : 0, friction: 8, tension: 40, useNativeDriver }).start();
        Animated.spring(slideAnimRelated, { toValue: activeTab === 'RELATED' ? 1 : 0, friction: 8, tension: 40, useNativeDriver }).start();
    }, [activeTab]);

    useEffect(() => {
        Animated.spring(slideAnimMenu, { toValue: isMenuVisible ? 1 : 0, friction: 8, tension: 40, useNativeDriver }).start();
    }, [isMenuVisible]);

    useEffect(() => {
        if (activeTab === 'LYRICS' && currentLyricIndex !== -1 && syncedLyrics.length > 0) {
            const scrollPos = currentLyricIndex * LYRIC_LINE_HEIGHT;
            lyricScrollRef.current?.scrollTo({ y: scrollPos, animated: true });
        }
    }, [currentLyricIndex, activeTab, syncedLyrics]);

    if (!currentTrack) return null;

    // Intelligent cover URL resolver for both StreamEx and YouTube
    const getCoverUrl = (track: Track) => {
        const cover = track.thumbnail || track.album?.cover;
        if (!cover) {
            return "https://resources.tidal.com/images/default/640x640.jpg";
        }
        if (cover.startsWith("http")) {
            return cover; // YouTube thumbnail or standard URL
        }
        const path = cover.replace(/-/g, "/");
        return `https://resources.tidal.com/images/${path}/640x640.jpg`;
    };

    const coverUrl = getCoverUrl(currentTrack);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const playerTranslateY = Animated.add(
        Animated.add(slideAnimLyrics, slideAnimUpNext),
        slideAnimRelated
    ).interpolate({
        inputRange: [0, 1, 2, 3],
        outputRange: [0, -SCREEN_HEIGHT, -SCREEN_HEIGHT, -SCREEN_HEIGHT],
    });

    const lyricsTranslateY = slideAnimLyrics.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT, 0] });
    const upNextTranslateY = slideAnimUpNext.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT, 0] });
    const relatedTranslateY = slideAnimRelated.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT, 0] });

    const menuTranslateY = slideAnimMenu.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT, 0] });
    const backdropOpacity = slideAnimMenu.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

    return (
        <View style={styles.wrapper}>

            <StatusBar style={isExpanded ? "light" : "auto"} />

            {!isExpanded && (
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsExpanded(true)}
                    style={styles.miniBar}
                >
                    <Image source={{ uri: coverUrl }} style={styles.miniCover} />

                    <View style={styles.miniInfo}>
                        <Text numberOfLines={1} style={styles.miniTitle}>
                            {currentTrack.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.miniArtist}>
                            {currentTrack.artists[0]?.name}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={togglePlay} style={styles.miniControl}>
                        <Ionicons name={isPlaying ? "pause" : "play"} size={26} color="white" />
                    </TouchableOpacity>
                </TouchableOpacity>
            )}

            <Modal
                animationType="slide"
                presentationStyle="overFullScreen"
                transparent
                visible={isExpanded}
            >

                <View style={styles.fullContainer}>

                    <LinearGradient
                        colors={['#25252d', '#000000']}
                        style={StyleSheet.absoluteFill}
                    />

                    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

                        <View style={styles.topNav}>
                            <TouchableOpacity onPress={() => setIsExpanded(false)}>
                                <Ionicons name="chevron-down" size={30} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
                                <Ionicons name="ellipsis-vertical" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.contentStack}>

                            {/* PLAYER VIEW */}
                            <Animated.View
                                style={[
                                    styles.mainContent,
                                    { transform: [{ translateY: playerTranslateY }] }
                                ]}
                            >
                                <View style={styles.albumArtWrapper}>
                                    <Image source={{ uri: coverUrl }} style={styles.mainCover} />
                                </View>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaText}>
                                        <Text numberOfLines={1} style={styles.mainTitleLarge}>
                                            {currentTrack.title}
                                        </Text>

                                        <View style={styles.metaSubRow}>
                                            <Text numberOfLines={1} style={styles.mainArtist}>
                                                {currentTrack.artists[0]?.name}
                                            </Text>
                                            {currentTrack.audioQuality === "LOSSLESS" && (
                                                <View style={styles.losslessBadgeMain}>
                                                    <Text style={styles.losslessTextMain}>LOSSLESS</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <TouchableOpacity onPress={() => setIsLiked(!isLiked)}>
                                        <Ionicons
                                            name={isLiked ? "heart" : "heart-outline"}
                                            size={32}
                                            color={isLiked ? "#FF3B30" : "white"}
                                        />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.progressContainer}>
                                    <Slider
                                        style={{ width: '100%', height: 40 }}
                                        minimumValue={0}
                                        maximumValue={(currentTrack.source === "youtube" ? currentTrack.duration : totalDuration) * 1000}
                                        value={currentTime * 1000}
                                        onSlidingComplete={(value) => seek(value)}
                                        minimumTrackTintColor="#FFF"
                                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                                        thumbTintColor="#FFF"
                                    />
                                    <View style={styles.timeRow}>
                                        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                                        <Text style={styles.timeText}>{formatTime(currentTrack.source === "youtube" ? currentTrack.duration : totalDuration)}</Text>
                                    </View>
                                </View>

                                <View style={styles.controls}>
                                    <TouchableOpacity>
                                        <Ionicons name="play-skip-back" size={42} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={togglePlay} style={styles.playBtnLarge}>
                                        <Ionicons
                                            name={isPlaying ? "pause" : "play"}
                                            size={44}
                                            color="black"
                                            style={!isPlaying ? { marginLeft: 7 } : undefined}
                                        />
                                    </TouchableOpacity>
                                    <TouchableOpacity>
                                        <Ionicons name="play-skip-forward" size={42} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>

                            {/* UP NEXT VIEW */}
                            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: upNextTranslateY }] }]}>
                                <View style={styles.tabHeader}>
                                    <Text style={styles.tabHeading}>Playing Next</Text>
                                    <TouchableOpacity onPress={() => setActiveTab('PLAYER')}>
                                        <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.4)" />
                                    </TouchableOpacity>
                                </View>
                                <FlatList
                                    data={upNextTracks} // USING REAL DATA
                                    keyExtractor={item => item.id.toString()}
                                    contentContainerStyle={styles.upNextList}
                                    showsVerticalScrollIndicator={false}
                                    ListEmptyComponent={
                                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                                            <Text style={{ color: '#aaa' }}>Finding recommendations...</Text>
                                        </View>
                                    }
                                    renderItem={({ item }) => (
                                        <TouchableOpacity 
                                            style={styles.upNextItem}
                                            onPress={() => {
                                                playTrack(item); // Play the suggested track
                                                setActiveTab('PLAYER'); // Go back to the main player view
                                            }}
                                        >
                                            <Image source={{ uri: getCoverUrl(item) }} style={styles.upNextCover} />
                                            <View style={styles.upNextInfo}>
                                                <Text numberOfLines={1} style={styles.upNextTitle}>{item.title}</Text>
                                                <Text numberOfLines={1} style={styles.upNextArtist}>{item.artists[0]?.name}</Text>
                                            </View>
                                            <Ionicons name="play-circle-outline" size={28} color="rgba(255,255,255,0.4)" />
                                        </TouchableOpacity>
                                    )}
                                />
                            </Animated.View>

                            {/* LYRICS VIEW */}
                            <Animated.View
                                style={[
                                    StyleSheet.absoluteFill,
                                    { transform: [{ translateY: lyricsTranslateY }] }
                                ]}
                            >
                                <TouchableOpacity activeOpacity={1} onPress={() => setActiveTab('PLAYER')} style={styles.lyricsHeader}>
                                    <Image source={{ uri: coverUrl }} style={styles.lyricsMiniCover} />
                                    <View style={styles.lyricsMeta}>
                                        <Text numberOfLines={1} style={styles.lyricsHeaderTitle}>{currentTrack.title}</Text>
                                        <Text style={styles.lyricsHeaderArtist}>{currentTrack.artists[0]?.name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={togglePlay}>
                                        <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="white" />
                                    </TouchableOpacity>
                                </TouchableOpacity>

                                {syncedLyrics.length > 0 ? (
                                    <ScrollView
                                        ref={lyricScrollRef}
                                        showsVerticalScrollIndicator={false}
                                        decelerationRate="fast"
                                        contentContainerStyle={{ paddingTop: SCREEN_HEIGHT / 2.5, paddingBottom: SCREEN_HEIGHT / 2 }}
                                    >
                                        {syncedLyrics.map((line, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                activeOpacity={0.8}
                                                onPress={() => seek(line.time * 1000)}
                                                style={{ height: LYRIC_LINE_HEIGHT, justifyContent: 'center' }}
                                            >
                                                <Text
                                                    style={[
                                                        styles.lyricLine,
                                                        index === currentLyricIndex ? styles.lyricActive : styles.lyricInactive
                                                    ]}
                                                >
                                                    {line.text}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <View style={styles.noLyricsContainer}>
                                        <Ionicons name="musical-notes-outline" size={48} color="rgba(255,255,255,0.1)" />
                                        <Text style={styles.noLyricsText}>Lyrics not available</Text>
                                    </View>
                                )}
                            </Animated.View>

                            {/* RELATED VIEW (Placeholder) */}
                            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: relatedTranslateY }], justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="albums-outline" size={64} color="rgba(255,255,255,0.2)" />
                                <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 16, fontWeight: '600' }}>Related content coming soon</Text>
                            </Animated.View>

                        </View>

                        {/* BOTTOM TAB NAV */}
                        <View style={styles.ytFooter}>
                            {['UP NEXT', 'LYRICS', 'RELATED'].map(tab => (
                                <TouchableOpacity
                                    key={tab}
                                    style={styles.ytTabButton}
                                    onPress={() => {
                                        if (activeTab === tab) {
                                            setActiveTab('PLAYER');
                                        } else {
                                            setActiveTab(tab as any);
                                        }
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.ytTabText,
                                            activeTab === tab && { color: 'white', fontWeight: '800' }
                                        ]}
                                    >
                                        {tab}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                    </SafeAreaView>

                    {/* MENU OVERLAY & SHEET */}
                    <Animated.View
                        pointerEvents={isMenuVisible ? "auto" : "none"}
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: 'black', opacity: backdropOpacity, zIndex: 10 }
                        ]}
                    >
                        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setIsMenuVisible(false)} />
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.menuSheet,
                            { transform: [{ translateY: menuTranslateY }], zIndex: 11 }
                        ]}
                    >
                        <View style={styles.menuHandle} />

                        <View style={styles.menuHeader}>
                            <Image source={{ uri: coverUrl }} style={styles.menuCover} />
                            <View style={styles.menuHeaderInfo}>
                                <Text numberOfLines={1} style={styles.menuTitle}>{currentTrack.title}</Text>
                                <Text numberOfLines={1} style={styles.menuArtist}>{currentTrack.artists[0]?.name}</Text>
                            </View>
                        </View>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => { setIsLiked(!isLiked); setIsMenuVisible(false); }}
                        >
                            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#FF3B30" : "white"} />
                            <Text style={styles.menuItemText}>{isLiked ? 'Remove from Favorites' : 'Add to Favorites'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setIsMenuVisible(false)}>
                            <Ionicons name="add-circle-outline" size={24} color="white" />
                            <Text style={styles.menuItemText}>Add to Playlist</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setIsMenuVisible(false)}>
                            <Ionicons name="albums-outline" size={24} color="white" />
                            <Text style={styles.menuItemText}>View Album</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setIsMenuVisible(false)}>
                            <Ionicons name="person-outline" size={24} color="white" />
                            <Text style={styles.menuItemText}>View Artist</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setIsMenuVisible(false)}>
                            <Ionicons name="share-social-outline" size={24} color="white" />
                            <Text style={styles.menuItemText}>Share</Text>
                        </TouchableOpacity>
                    </Animated.View>

                </View>

            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 85,
        width: '100%',
        paddingHorizontal: 12
    },
    miniBar: {
        height: 64,
        backgroundColor: 'rgba(28,28,35,0.98)',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12
    },
    miniCover: {
        width: 44,
        height: 44,
        borderRadius: 8
    },
    miniInfo: {
        flex: 1,
        marginLeft: 14
    },
    miniTitle: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14
    },
    miniArtist: {
        color: '#888',
        fontSize: 12
    },
    miniControl: {
        marginLeft: 10
    },
    fullContainer: {
        flex: 1,
        backgroundColor: 'black'
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 10,
        height: 70
    },
    contentStack: {
        flex: 1,
        overflow: 'hidden'
    },
    mainContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    albumArtWrapper: {
        width: SCREEN_WIDTH * 0.88,
        aspectRatio: 1,
        borderRadius: 12
    },
    mainCover: {
        width: '100%',
        height: '100%',
        borderRadius: 12
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '85%',
        marginTop: 30
    },
    metaText: {
        flex: 1
    },
    mainTitleLarge: {
        color: 'white',
        fontSize: 26,
        fontWeight: 'bold'
    },
    mainArtist: {
        color: '#f5f5f5',
        fontSize: 18
    },
    progressContainer: {
        width: '88%',
        marginTop: 20
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    timeText: {
        color: '#888',
        fontSize: 12
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        width: '80%',
        marginTop: 30
    },
    playBtnLarge: {
        backgroundColor: 'white',
        width: 75,
        height: 75,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center'
    },

    // --- LYRICS STYLES ---
    lyricsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingVertical: 15
    },
    lyricsMiniCover: {
        width: 48,
        height: 48,
        borderRadius: 6
    },
    lyricsMeta: {
        flex: 1,
        marginLeft: 16
    },
    lyricsHeaderTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    lyricsHeaderArtist: {
        color: '#aaa',
        fontSize: 13
    },
    lyricLine: {
        fontSize: 28,
        fontWeight: '800',
        paddingHorizontal: 25,
        lineHeight: 35
    },
    lyricActive: {
        color: 'white'
    },
    lyricInactive: {
        color: 'rgba(255,255,255,0.2)'
    },
    noLyricsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 50
    },
    noLyricsText: {
        color: 'rgba(255,255,255,0.3)',
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600'
    },

    // --- UP NEXT STYLES ---
    tabHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingVertical: 15,
        marginBottom: 10,
    },
    tabHeading: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    upNextList: {
        paddingHorizontal: 20,
        paddingBottom: 50,
    },
    upNextItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 10,
        borderRadius: 12,
    },
    upNextCover: {
        width: 50,
        height: 50,
        borderRadius: 8,
    },
    upNextInfo: {
        flex: 1,
        marginLeft: 15,
    },
    upNextTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    upNextArtist: {
        color: '#aaa',
        fontSize: 13,
    },

    // --- FOOTER ---
    ytFooter: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingVertical: 20
    },
    ytTabButton: {
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    ytTabText: {
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '600',
        fontSize: 14
    },
    metaSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    losslessBadgeMain: {
        backgroundColor: 'rgba(225, 176, 126, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(225, 176, 126, 0.2)',
        marginLeft: 8,
    },
    losslessTextMain: {
        color: '#E1B07E',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },

    // --- MENU STYLES ---
    menuSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1C1C23',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingBottom: 50,
        paddingTop: 12,
        paddingHorizontal: 25,
    },
    menuHandle: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    menuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    menuCover: {
        width: 50,
        height: 50,
        borderRadius: 8,
    },
    menuHeaderInfo: {
        flex: 1,
        marginLeft: 15,
    },
    menuTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    menuArtist: {
        color: '#aaa',
        fontSize: 14,
    },
    menuDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    menuItemText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 18,
    },
});