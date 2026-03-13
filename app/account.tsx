import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Account() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color="#555" />
                </View>
                <Text style={styles.name}>Sajal Chitlangia</Text>
                <Text style={styles.email}>Premium Member</Text>
            </View>

            <View style={styles.menu}>
                <TouchableOpacity style={styles.menuItem}>
                    <Ionicons name="settings-outline" size={22} color="white" />
                    <Text style={styles.menuText}>Settings</Text>
                    <Ionicons name="chevron-forward" size={20} color="#555" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <Ionicons name="headset-outline" size={22} color="white" />
                    <Text style={styles.menuText}>Audio Quality</Text>
                    <Text style={styles.menuValue}>Lossless</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0B0B0F", padding: 20 },
    header: { alignItems: "center", marginTop: 60, marginBottom: 40 },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#1A1A22",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16
    },
    name: { color: "white", fontSize: 24, fontWeight: "bold" },
    email: { color: "#7C6CF2", fontSize: 14, marginTop: 4, fontWeight: "600" },
    menu: { marginTop: 20 },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#14141A",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12
    },
    menuText: { color: "white", flex: 1, marginLeft: 12, fontSize: 16 },
    menuValue: { color: "#7C6CF2", fontSize: 14 },
});