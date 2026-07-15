import { Modal, View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Text } from "./Text";
import { colors, radius, spacing, layout } from "@/constants/theme";

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

// Bottom sheet (spec §3) — surface, top radius 20, grab handle, title header,
// max 85% height, content scrolls. Backdrop tap closes. Used for rules, league
// info, team change, and destructive confirms that need content.
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close sheet">
        {/* Stop propagation so taps inside the sheet don't close it */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          {title ? (
            <Text variant="title" style={styles.title}>
              {title}
            </Text>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "85%",
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: { marginBottom: spacing.lg },
  content: { gap: spacing.md },
});
