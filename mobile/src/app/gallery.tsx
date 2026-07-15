import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";
import {
  colors,
  type as typeScale,
  spacing,
  radius,
  shadow,
  layout,
  type ColorToken,
  type TypeVariant,
} from "@/constants/theme";

// DS1 exit criterion: render the token sheet — full palette, all type styles,
// spacing/radius/shadow samples, the Skeleton primitive. As DS2–DS4 land, this
// gallery grows sections for each component in every state.

const SWATCHES: ColorToken[] = [
  "bg", "surface", "surfaceAlt", "border",
  "textPrimary", "textSecondary", "textTertiary",
  "plPurple", "plPurpleLight", "plTint",
  "uclNavy", "uclNavyLight", "uclTint",
  "accent", "accentPressed", "accentTint", "neon",
  "danger", "dangerTint", "warning", "warningTint",
];

const TYPE_VARIANTS: TypeVariant[] = [
  "display", "title", "heading", "body", "bodyMedium",
  "caption", "label", "numeral", "numeralLg",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary">{title}</Text>
      <View style={{ marginTop: spacing.md, gap: spacing.md }}>{children}</View>
    </View>
  );
}

export default function GalleryScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text variant="title">Design tokens</Text>
        <Text variant="caption" color="textSecondary">DS1 foundations — MOBILE_DESIGN_SPEC.md §2</Text>

        <Section title="Color">
          <View style={styles.swatchGrid}>
            {SWATCHES.map((name) => (
              <View key={name} style={styles.swatchCell}>
                <View style={[styles.swatch, { backgroundColor: colors[name] }]} />
                <Text variant="caption" numberOfLines={1}>{name}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Type scale">
          {TYPE_VARIANTS.map((v) => (
            <View key={v} style={styles.typeRow}>
              <Text variant="caption" color="textTertiary" style={styles.typeLabel}>{v}</Text>
              <Text variant={v}>
                {v === "numeral" || v === "numeralLg" ? "3 : 21 : 09" : "ScoreCast 2026"}
              </Text>
            </View>
          ))}
          <Text variant="caption" color="textTertiary">
            {typeScale.numeral.fontSize}px numerals use tabular figures (no jitter).
          </Text>
        </Section>

        <Section title="Spacing">
          <View style={{ gap: spacing.sm }}>
            {(Object.entries(spacing) as [string, number][]).map(([k, v]) => (
              <View key={k} style={styles.spaceRow}>
                <Text variant="caption" color="textTertiary" style={styles.spaceLabel}>{k} · {v}</Text>
                <View style={[styles.spaceBar, { width: v * 4 }]} />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Radius & shadow">
          <View style={styles.radiusRow}>
            {(["sm", "md", "lg"] as const).map((r) => (
              <View key={r} style={styles.radiusCell}>
                <View style={[styles.radiusBox, { borderRadius: radius[r] }, shadow.card]} />
                <Text variant="caption" color="textTertiary">{r} · {radius[r]}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Skeleton">
          <SkeletonLines count={3} />
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
            <Skeleton width={48} height={48} radius={radius.pill} />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <SkeletonLines count={2} />
            </View>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.sm, paddingBottom: spacing.xxxl },
  section: { marginTop: spacing.xl },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  swatchCell: { width: 72, gap: 4 },
  swatch: {
    width: 72,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeRow: { gap: 2 },
  typeLabel: {},
  spaceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  spaceLabel: { width: 64 },
  spaceBar: { height: 12, backgroundColor: colors.accent, borderRadius: 4 },
  radiusRow: { flexDirection: "row", gap: spacing.lg },
  radiusCell: { alignItems: "center", gap: 6 },
  radiusBox: { width: 72, height: 72, backgroundColor: colors.surface },
});
