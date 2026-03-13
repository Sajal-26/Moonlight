import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMusicStore } from '../store/useMusicStore';

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
        currentLyricIndex
    } = useMusicStore();

    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'UP NEXT' | 'LYRICS' | 'RELATED'>('UP NEXT');
    const [isLiked, setIsLiked] = useState(false);

    const lyricScrollRef = useRef<ScrollView>(null);

    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: activeTab === 'LYRICS' ? 1 : 0,
            friction: 8,
            tension: 40,
            useNativeDriver,
        }).start();
    }, [activeTab]);

    // PERFECT AUTO CENTER SCROLL
    useEffect(() => {

        if (activeTab === 'LYRICS' && currentLyricIndex !== -1) {

            const scrollPos = currentLyricIndex * LYRIC_LINE_HEIGHT;

            lyricScrollRef.current?.scrollTo({
                y: scrollPos,
                animated: true,
            });
        }

    }, [currentLyricIndex, activeTab]);

    if (!currentTrack) return null;

    const coverUrl = `https://resources.tidal.com/images/${currentTrack.album.cover?.replace(/-/g, '/')}/640x640.jpg`;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const playerTranslateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -SCREEN_HEIGHT],
    });

    const lyricsTranslateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_HEIGHT, 0],
    });

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

                            <TouchableOpacity>
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
                                                    <Text style={styles.losslessTextMain}>
                                                        LOSSLESS
                                                    </Text>
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
                                        maximumValue={totalDuration * 1000}
                                        value={currentTime * 1000}
                                        onSlidingComplete={(value) => seek(value)}
                                        minimumTrackTintColor="#FFF"
                                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                                        thumbTintColor="#FFF"
                                    />

                                    <View style={styles.timeRow}>

                                        <Text style={styles.timeText}>
                                            {formatTime(currentTime)}
                                        </Text>

                                        <Text style={styles.timeText}>
                                            {formatTime(totalDuration)}
                                        </Text>

                                    </View>

                                </View>

                                <View style={styles.controls}>

                                    <TouchableOpacity>
                                        <Ionicons name="play-skip-back" size={42} color="white" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={togglePlay}
                                        style={styles.playBtnLarge}
                                    >
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

                            {/* LYRICS VIEW */}

                            <Animated.View
                                style={[
                                    StyleSheet.absoluteFill,
                                    { transform: [{ translateY: lyricsTranslateY }] }
                                ]}
                            >

                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={() => setActiveTab('UP NEXT')}
                                    style={styles.lyricsHeader}
                                >

                                    <Image source={{ uri: coverUrl }} style={styles.lyricsMiniCover} />

                                    <View style={styles.lyricsMeta}>
                                        <Text numberOfLines={1} style={styles.lyricsHeaderTitle}>
                                            {currentTrack.title}
                                        </Text>

                                        <Text style={styles.lyricsHeaderArtist}>
                                            {currentTrack.artists[0]?.name}
                                        </Text>
                                    </View>

                                    <TouchableOpacity onPress={togglePlay}>
                                        <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="white" />
                                    </TouchableOpacity>

                                </TouchableOpacity>

                                <ScrollView
                                    ref={lyricScrollRef}
                                    showsVerticalScrollIndicator={false}
                                    decelerationRate="fast"
                                    contentContainerStyle={{
                                        paddingTop: SCREEN_HEIGHT / 2,
                                        paddingBottom: SCREEN_HEIGHT / 2
                                    }}
                                >

                                    {syncedLyrics.map((line, index) => (

                                        <TouchableOpacity
                                            key={index}
                                            activeOpacity={0.8}
                                            onPress={() => seek(line.time * 1000)}
                                            style={{
                                                height: LYRIC_LINE_HEIGHT,
                                                justifyContent: 'center'
                                            }}
                                        >

                                            <Text
                                                style={[
                                                    styles.lyricLine,
                                                    index === currentLyricIndex
                                                        ? styles.lyricActive
                                                        : styles.lyricInactive
                                                ]}
                                            >
                                                {line.text}
                                            </Text>

                                        </TouchableOpacity>

                                    ))}

                                </ScrollView>

                            </Animated.View>

                        </View>

                        <View style={styles.ytFooter}>

                            {['UP NEXT', 'LYRICS', 'RELATED'].map(tab => (

                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(tab as any)}
                                >

                                    <Text
                                        style={[
                                            styles.ytTabText,
                                            activeTab === tab && { color: 'white' }
                                        ]}
                                    >
                                        {tab}
                                    </Text>

                                </TouchableOpacity>

                            ))}

                        </View>

                    </SafeAreaView>

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

    lyricsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingVertical: 15
    },

    lyricsMiniCover: {
        width: 48,
        height: 48
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

    ytFooter: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingVertical: 20
    },

    ytTabText: {
        color: 'rgba(255,255,255,0.4)',
        fontWeight: 'bold',
        fontSize: 13
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

});