import { Text, View } from "react-native";
// import TrackPlayer from 'react-native-track-player';

// TrackPlayer.registerPlaybackService(() =>
//   require('../services/playbackService')
// );

export default function Home() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0f0f0f",
      }}
    >
      <Text style={{ color: "white", fontSize: 24 }}>
        🌙 Moonlight
      </Text>
    </View>
  );
}