import { useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { SolidButton } from "@/components/SolidButton";
import { FormErrorStrip } from "@/components/FormErrorStrip";
import { TeamCrest } from "@/components/TeamCrest";
import { Skeleton } from "@/components/Skeleton";
import { useTeams, useSetFavoriteTeam } from "@/lib/queries";
import { haptics } from "@/utils/haptics";
import type { Team } from "@/types/fixtures";
import { brand } from "@/constants/brand";
import { spacing, layout, radius, fontFamily } from "@/constants/theme";

const NUM_COLS = 3;
const SELECTED_TINT = "rgba(89,128,166,0.12)"; // brand.line @ 12%

// Team-select onboarding gate. Shown once, to signed-in users without a
// favorite team; the root gate forces it and releases to tabs once one is set.
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
    setFavorite.mutate(selected.id);
  };

  const renderTeam = ({ item }: { item: Team }) => {
    const isSel = selected?.id === item.id;
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
        <TeamCrest name={item.name} code={item.code} logo={item.logo} size={44} fallbackColor={brand.ink} />
        <Text center numberOfLines={1} style={styles.cellLabel}>
          {item.shortName || item.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.headline}>Pick your team.</Text>
          <Text style={styles.subhead}>
            {selected ? selected.name : "This personalizes your ScoreCast."}
          </Text>
        </View>

        {isError ? (
          <View style={styles.pad}>
            <FormErrorStrip kind="offline" message="Couldn't load teams. Pull to retry." />
            <Pressable onPress={() => refetch()} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
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
            <FormErrorStrip kind="error" message="Couldn't save your team. Try again." />
          ) : null}
          <SolidButton label="Continue" onPress={onContinue} disabled={!selected} loading={setFavorite.isPending} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.paper },
  safe: { flex: 1 },
  header: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
  headline: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: brand.ink },
  subhead: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: brand.muted },
  pad: { paddingHorizontal: layout.gutter, gap: spacing.md },
  retry: { alignSelf: "flex-start" },
  retryText: { fontFamily: fontFamily.semibold, fontSize: 15, color: brand.line },
  grid: { paddingHorizontal: layout.gutter, gap: spacing.md, paddingBottom: spacing.xl },
  rowGap: { gap: spacing.md },
  cell: {
    flex: 1 / NUM_COLS,
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "#e3e9f1",
    backgroundColor: "#ffffff",
  },
  cellSelected: { borderColor: brand.line, backgroundColor: SELECTED_TINT },
  cellLabel: { maxWidth: "100%", fontFamily: fontFamily.medium, fontSize: 12, color: brand.muted },
  footer: { padding: layout.gutter, gap: spacing.md, borderTopWidth: 1, borderTopColor: "#e3e9f1" },
});
