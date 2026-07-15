import { useState, useRef } from "react";
import { View, StyleSheet, ScrollView, type TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";
import { Button, type ButtonVariant } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Banner } from "@/components/Banner";
import { EmptyState } from "@/components/EmptyState";
import { Sheet } from "@/components/Sheet";
import { Card } from "@/components/Card";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatTile } from "@/components/StatTile";
import { TeamCrest } from "@/components/TeamCrest";
import { PointsBadge } from "@/components/PointsBadge";
import { CountdownCard } from "@/components/CountdownCard";
import { MatchRow } from "@/components/MatchRow";
import { ScoreInput } from "@/components/ScoreInput";
import { LeaderboardRow } from "@/components/LeaderboardRow";
import type { MatchWithTeams } from "@/types/fixtures";
import { colors, spacing, radius, shadow, layout, competition, type ColorToken, type TypeVariant } from "@/constants/theme";

// MS8 gallery — every DS1–DS4 component in its documented states, plus the DS1
// token sheet. This is the verifiable surface for the component library.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary">{title}</Text>
      <View style={{ marginTop: spacing.md, gap: spacing.md }}>{children}</View>
    </View>
  );
}

const fakeMatch = (over?: Partial<MatchWithTeams>): MatchWithTeams => ({
  id: "m1",
  kickoffTime: new Date(Date.now() + 3 * 3600_000).toISOString(),
  homeScore: null,
  awayScore: null,
  homeRedCards: 0,
  awayRedCards: 0,
  status: "scheduled",
  homeTeam: { id: "t1", name: "Arsenal", shortName: "ARS", code: "ARS", competition: "premier_league" },
  awayTeam: { id: "t2", name: "Chelsea", shortName: "CHE", code: "CHE", competition: "premier_league" },
  ...over,
});

const SWATCHES: ColorToken[] = [
  "bg", "surface", "surfaceAlt", "border", "textPrimary", "textSecondary", "textTertiary",
  "plPurple", "plPurpleLight", "plTint", "uclNavy", "uclNavyLight", "uclTint",
  "accent", "accentPressed", "accentTint", "neon", "danger", "dangerTint", "warning", "warningTint",
];
const TYPE_VARIANTS: TypeVariant[] = [
  "display", "title", "heading", "body", "bodyMedium", "caption", "label", "numeral", "numeralLg",
];
const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "brand", "secondary", "destructive", "ghost"];

export default function GalleryScreen() {
  const [seg, setSeg] = useState<"fixtures" | "predictions" | "table">("fixtures");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [field, setField] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const awayRef = useRef<TextInput>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Component gallery" />
      <ScrollView contentContainerStyle={styles.pad}>
        <Text variant="caption" color="textSecondary">MS8 · DS1–DS4 — MOBILE_DESIGN_SPEC.md</Text>

        <Section title="Buttons (variants × states)">
          {BUTTON_VARIANTS.map((v) => (
            <View key={v} style={styles.rowWrap}>
              <View style={styles.grow}><Button label={v} variant={v} competitionKey="champions_league" /></View>
            </View>
          ))}
          <View style={styles.rowWrap}>
            <View style={styles.grow}><Button label="Loading" loading /></View>
            <View style={styles.grow}><Button label="Disabled" disabled /></View>
          </View>
        </Section>

        <Section title="TextField">
          <TextField label="Username or email" placeholder="you@example.com" value={field} onChangeText={setField} autoCapitalize="none" />
          <TextField label="Password" placeholder="••••••••" secureToggle secureTextEntry />
          <TextField label="With error" value="ab" error="Username must be at least 3 characters" onChangeText={() => {}} />
        </Section>

        <Section title="Banners">
          <Banner kind="error" message="Wrong username or password" onRetry={() => {}} />
          <Banner kind="offline" message="You're offline — showing saved data" />
          <Banner kind="success" message="Predictions submitted" />
          <Banner kind="info" message="Deadline is in 2 hours" />
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            segments={[
              { key: "fixtures", label: "Fixtures" },
              { key: "predictions", label: "Predictions" },
              { key: "table", label: "Table" },
            ]}
            value={seg}
            onChange={setSeg}
            activeColor={competition.premier_league.main}
          />
          <Text variant="caption" color="textSecondary">Active: {seg}</Text>
        </Section>

        <Section title="Countdown cards">
          <CountdownCard competitionKey="premier_league" deadline={new Date(Date.now() + 50 * 3600_000).toISOString()} gameweekName="Gameweek 22" />
          <CountdownCard competitionKey="champions_league" deadline={new Date(Date.now() + 5 * 3600_000).toISOString()} gameweekName="Under 24h → warning" />
          <CountdownCard competitionKey="premier_league" deadline={new Date(Date.now() + 40 * 60_000).toISOString()} gameweekName="Under 1h → danger" />
          <CountdownCard competitionKey="premier_league" deadline={new Date(Date.now() - 3600_000).toISOString()} gameweekName="Passed" />
          <CountdownCard competitionKey="champions_league" deadline={new Date().toISOString()} state="live" gameweekName="Live" />
          <CountdownCard competitionKey="premier_league" deadline={new Date().toISOString()} state="loading" />
        </Section>

        <Section title="Cards & stat tiles">
          <Card railColor={competition.premier_league.main}>
            <Text variant="heading">Kickoff Kings</Text>
            <Text variant="caption" color="textSecondary">12 members</Text>
          </Card>
          <Card onPress={() => {}}>
            <Text variant="body">Pressable card</Text>
          </Card>
          <View style={styles.rowWrap}>
            <StatTile value={148} label="Total pts" />
            <StatTile value={14} label="Best GW" />
            <StatTile value="—" label="Leagues" loading />
          </View>
        </Section>

        <Section title="Match rows">
          <Card>
            <MatchRow match={fakeMatch()} />
            <MatchRow match={fakeMatch({ status: "live", homeScore: 1, awayScore: 0, awayRedCards: 1 })} />
            <MatchRow
              match={fakeMatch({ status: "finished", homeScore: 2, awayScore: 1 })}
              right={<PointsBadge outcome="exact" />}
            />
          </Card>
        </Section>

        <Section title="Points badges">
          <View style={styles.rowWrap}>
            <PointsBadge outcome="exact" />
            <PointsBadge outcome="result" />
            <PointsBadge outcome="incorrect" />
            <PointsBadge outcome="pending" />
          </View>
        </Section>

        <Section title="Score inputs (auto-advance)">
          <View style={styles.scoreRow}>
            <ScoreInput value={home} onChangeText={(v) => { setHome(v); if (v) awayRef.current?.focus(); }} onSubmitEditing={() => awayRef.current?.focus()} />
            <Text variant="numeral" color="textTertiary">:</Text>
            <ScoreInput ref={awayRef} value={away} onChangeText={setAway} />
            <View style={{ width: spacing.lg }} />
            <ScoreInput value="1" onChangeText={() => {}} locked />
            <Text variant="numeral" color="textTertiary">:</Text>
            <ScoreInput value="" onChangeText={() => {}} finalDisplay="2" />
          </View>
        </Section>

        <Section title="Leaderboard rows">
          <Card padded={false} style={{ paddingVertical: spacing.sm }}>
            <LeaderboardRow rank={1} username="zaid" points={148} isChampion competitionKey="premier_league" />
            <LeaderboardRow rank={2} username="sam" points={140} isCurrentUser competitionKey="premier_league" />
            <LeaderboardRow rank={3} username="alex" points={133} competitionKey="premier_league" />
            <LeaderboardRow rank={4} username="jordan" points={121} competitionKey="premier_league" />
          </Card>
        </Section>

        <Section title="Team crests (SVG + fallback)">
          <View style={styles.rowWrap}>
            <TeamCrest name="Arsenal" code="ARS" logo="https://crests.football-data.org/57.svg" size={40} />
            <TeamCrest name="Chelsea" code="CHE" logo="https://crests.football-data.org/61.png" size={40} />
            <TeamCrest name="No Logo FC" code="NLF" logo={null} size={40} fallbackColor={competition.champions_league.main} />
          </View>
          <Text variant="caption" color="textTertiary">First two hit real crest URLs (one SVG); third demonstrates the initials fallback.</Text>
        </Section>

        <Section title="Sheet & empty state">
          <Button label="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
          <Card>
            <EmptyState icon="trophy-outline" title="No leagues yet" subtitle="Ask your league admin for an invite code" actionLabel="Join a league" onAction={() => {}} />
          </Card>
        </Section>

        <Section title="Design tokens (DS1)">
          <View style={styles.swatchGrid}>
            {SWATCHES.map((name) => (
              <View key={name} style={styles.swatchCell}>
                <View style={[styles.swatch, { backgroundColor: colors[name] }]} />
                <Text variant="caption" numberOfLines={1}>{name}</Text>
              </View>
            ))}
          </View>
          {TYPE_VARIANTS.map((v) => (
            <Text key={v} variant={v}>{v === "numeral" || v === "numeralLg" ? "3 : 21 : 09" : `${v} — ScoreCast`}</Text>
          ))}
          <View style={styles.radiusRow}>
            {(["sm", "md", "lg"] as const).map((r) => (
              <View key={r} style={[styles.radiusBox, { borderRadius: radius[r] }, shadow.card]} />
            ))}
          </View>
          <SkeletonLines count={2} />
          <Skeleton width={48} height={48} radius={radius.pill} />
        </Section>
      </ScrollView>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="How to play">
        <Text variant="body" color="textSecondary">Exact score = 3 pts. Correct result = 1 pt. Miss = 0.</Text>
        <Button label="Got it" onPress={() => setSheetOpen(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.sm, paddingBottom: spacing.xxxl },
  section: { marginTop: spacing.xl },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  grow: { flexGrow: 1, flexBasis: "45%" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  swatchCell: { width: 72, gap: 4 },
  swatch: { width: 72, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  radiusRow: { flexDirection: "row", gap: spacing.lg },
  radiusBox: { width: 64, height: 64, backgroundColor: colors.surface },
});
