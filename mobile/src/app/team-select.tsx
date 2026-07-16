import { useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { TeamCrest } from "@/components/TeamCrest";
import { Skeleton } from "@/components/Skeleton";
import { useTeams, useSetFavoriteTeam } from "@/lib/queries";
import { haptics } from "@/utils/haptics";
import type { Team } from "@/types/fixtures";
import { colors, spacing, layout, radius, competition } from "@/constants/theme";

const NUM_COLS = 3;

// Team-select onboarding gate (MOBILE_PLAN.md §5.4). Shown once, to signed-in
// users without a favorite team; the root gate forces it and releases to tabs
// once a team is set. Picking a team is the whole job of this screen.
export default function TeamSelectScreen() {
  const { data: teams, isLoading, isError, refetch } = useTeams();
  const setFavorite = useSetFavoriteTeam();
  const [selected, setSelected] = useState<Team | null>(null);

  const sorted = useMemo(
    () => (teams ? [...teams].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [teams]
  );

  const onContinue = () => {
    if (!selected) return;
    haptics.success();
    // The root gate redirects to (tabs) once favoriteTeam is set + invalidated.
    setFavorite.mutate(selected.id);
  };

  const renderTeam = ({ item }: { item: Team }) => {
    const isSel = selected?.id === item.id;
    const fallback =
      item.competition === "champions_league" ? competition.champions_league.main : competition.premier_league.main;
    return (
      <Pressable
        style={[styles.cell, isSel && styles.cellSelected]}
        onPress={() => {
          haptics.select();
          setSelected(item);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSel }}
      >
        <TeamCrest name={item.name} code={item.code} logo={item.logo} size={44} fallbackColor={fallback} />
        <Text variant="caption" center numberOfLines={1} style={styles.cellLabel}>
          {item.shortName || item.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text variant="title">Pick your team</Text>
        <Text variant="body" color="textSecondary">
          {selected ? `${selected.name} — tap Continue` : "This personalizes your ScoreCast."}
        </Text>
      </View>

      {isError ? (
        <View style={styles.pad}>
          <Banner kind="offline" message="Couldn't load teams." onRetry={() => refetch()} />
        </View>
      ) : isLoading ? (
        <View style={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={styles.cell}>
              <Skeleton width={44} height={44} radius={radius.pill} />
              <Skeleton width={40} height={10} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={sorted}
          renderItem={renderTeam}
          keyExtractor={(t) => t.id}
          numColumns={NUM_COLS}
          columnWrapperStyle={styles.rowGap}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        {setFavorite.isError ? (
          <Banner kind="error" message="Couldn't save your team. Try again." />
        ) : null}
        <Button
          label="Continue"
          onPress={onContinue}
          disabled={!selected}
          loading={setFavorite.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: layout.gutter, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.xs },
  pad: { paddingHorizontal: layout.gutter },
  grid: { paddingHorizontal: layout.gutter, gap: spacing.md, paddingBottom: spacing.xl },
  rowGap: { gap: spacing.md },
  cell: {
    flex: 1 / NUM_COLS,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
  },
  cellSelected: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  cellLabel: { maxWidth: "100%" },
  footer: { padding: layout.gutter, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
