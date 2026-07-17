import { View, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { SectionTitle } from "@/components/SectionTitle";
import { PredictionRow } from "@/components/PredictionRow";
import { TeamCrest } from "@/components/TeamCrest";
import { SkeletonLines } from "@/components/Skeleton";
import { Banner } from "@/components/Banner";
import { usePlayerPredictions } from "@/lib/queries";
import { colors, spacing, layout, radius, fontFamily } from "@/constants/theme";
import { brand } from "@/constants/brand";

const DIM = "#8ba0b6";

export default function PlayerPredictionsScreen() {
  const { leagueId, gameweekId, userId, username, teamLogo, gwLabel } =
    useLocalSearchParams<{ leagueId: string; gameweekId?: string; userId: string; username: string; teamLogo?: string; gwLabel?: string }>();

  const preds = usePlayerPredictions(leagueId, gameweekId, userId);

  const list = preds.data?.predictions ?? [];
  const settled = list.filter((p) => p.points != null);
  const gwPoints = settled.reduce((s, p) => s + (p.points ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader title={username ?? "Player"} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Player hero */}
        <View style={styles.hero}>
          <TeamCrest name={username ?? ""} logo={teamLogo || null} size={44} fallbackColor={colors.accent} />
          <View style={styles.heroText}>
            <Text style={styles.heroName} numberOfLines={1}>{username}</Text>
            <Text style={styles.heroSub}>{gwLabel ?? "This gameweek"}</Text>
          </View>
          {settled.length > 0 ? (
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum} tabular>{gwPoints}</Text>
              <Text style={styles.heroStatLabel}>Pts</Text>
            </View>
          ) : null}
        </View>

        {preds.isLoading ? (
          <View style={{ paddingTop: spacing.md }}><SkeletonLines count={4} /></View>
        ) : preds.isError ? (
          <Banner kind="error" message="Couldn't load these predictions." />
        ) : list.length === 0 ? (
          preds.data?.hasHidden ? (
            <View style={styles.locked}>
              <Ionicons name="eye-off-outline" size={26} color={colors.textTertiary} />
              <Text variant="heading" center style={{ marginTop: spacing.sm }}>Predictions hidden</Text>
              <Text variant="caption" color="textSecondary" center>
                {username} kept their picks hidden until the deadline.
              </Text>
            </View>
          ) : (
            <View style={styles.locked}>
              <Ionicons name="remove-circle-outline" size={26} color={colors.textTertiary} />
              <Text variant="heading" center style={{ marginTop: spacing.sm }}>No predictions</Text>
              <Text variant="caption" color="textSecondary" center>
                {username} hasn't predicted this gameweek.
              </Text>
            </View>
          )
        ) : (
          <View style={styles.section}>
            <SectionTitle label="Predictions" />
            <Card padded={false}>
              {list.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.duration(240).delay(i * 40)}>
                  <PredictionRow p={p} first={i === 0} />
                </Animated.View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.xl },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: brand.navy,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2c4056",
    padding: layout.cardPadding,
  },
  heroText: { flex: 1, gap: 2 },
  heroName: { fontFamily: fontFamily.bold, fontSize: 19, color: colors.textOnBrand },
  heroSub: { fontFamily: fontFamily.regular, fontSize: 13, color: DIM },
  heroStat: { alignItems: "flex-end" },
  heroStatNum: { fontFamily: fontFamily.extrabold, fontSize: 22, color: colors.textOnBrand },
  heroStatLabel: { fontFamily: fontFamily.semibold, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: DIM },
  section: { gap: spacing.md },
  locked: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.xs, paddingHorizontal: spacing.lg },
});
