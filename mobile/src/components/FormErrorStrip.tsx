import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { brand } from "@/constants/brand";
import { spacing, radius, fontFamily } from "@/constants/theme";

// Inline auth error — a soft red-tinted strip on the light ground (the light
// Banner primitive doesn't fit the blueprint palette).
export function FormErrorStrip({ kind, message }: { kind: "error" | "offline"; message: string }) {
  return (
    <View style={styles.strip}>
      <Ionicons
        name={kind === "offline" ? "cloud-offline-outline" : "alert-circle-outline"}
        size={16}
        color={brand.danger}
      />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: "rgba(192,73,46,0.1)",
  },
  text: { flex: 1, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: brand.danger },
});
