import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { Button } from "./Button";
import { colors, spacing } from "@/constants/theme";

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// EmptyState — centered icon + one-liner + optional CTA (spec §3).
export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={48} color={colors.textTertiary} />
      <Text variant="heading" center style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" color="textSecondary" center>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.sm },
  title: { marginTop: spacing.sm },
  action: { marginTop: spacing.lg, alignSelf: "stretch" },
});
