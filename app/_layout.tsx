import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
// import { useEffect } from "react";
import { useColorScheme, View } from "react-native";
// import TrackPlayer, { Capability } from "react-native-track-player";
import Player from "./player";

export default function Layout() {

  const dark = useColorScheme() === "dark";

  // useEffect(() => {
  //   setupPlayer();
  // }, []);

  // const setupPlayer = async () => {
  //   try {

  //     await TrackPlayer.setupPlayer();

  //     await TrackPlayer.updateOptions({
  //       capabilities: [
  //         Capability.Play,
  //         Capability.Pause,
  //         Capability.SkipToNext,
  //         Capability.SkipToPrevious,
  //         Capability.SeekTo,
  //       ],
  //       compactCapabilities: [
  //         Capability.Play,
  //         Capability.Pause,
  //       ],
  //     });

  //   } catch (error) {
  //     console.log("TrackPlayer already initialized");
  //   }
  // };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0F" }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: dark ? "#0B0B0F" : "#FFFFFF",
            borderTopWidth: 0,
            height: 70,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: "#7C6CF2",
          tabBarInactiveTintColor: "#777",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Hidden Player Screen */}
        <Tabs.Screen
          name="player"
          options={{
            href: null,
          }}
        />

      </Tabs>

      {/* Global Player */}
      <Player />

    </View>
  );
}