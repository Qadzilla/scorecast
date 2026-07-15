import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Text } from "./Text";
import { colors, radius } from "@/constants/theme";

type TeamCrestProps = {
  name: string;
  code?: string;
  logo?: string | null;
  size?: number;
  /** Tint for the initials-fallback disc (competition color on colored surfaces). */
  fallbackColor?: string;
};

// TeamCrest — expo-image crest with an initials-disc fallback (spec §3). Crests
// from crests.football-data.org are often SVG; expo-image renders SVG natively.
// If the URL is missing or fails to load, we fall back to the code/initials.
export function TeamCrest({ name, code, logo, size = 28, fallbackColor = colors.plPurple }: TeamCrestProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !logo || failed;

  if (showFallback) {
    const initials = (code || name).slice(0, 3).toUpperCase();
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: fallbackColor },
        ]}
        accessibilityLabel={name}
      >
        <Text
          variant="caption"
          color="textOnBrand"
          style={{ fontSize: Math.max(8, size * 0.32) }}
        >
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: logo }}
      style={{ width: size, height: size, borderRadius: radius.sm }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={120}
      onError={() => setFailed(true)}
      accessibilityLabel={name}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});
