import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { colors, layout } from "@/constants/theme";

// Placeholder — built out in AD6.
export default function AdminLeagues() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Leagues" />
      <View style={styles.pad}>
        <Text color="textSecondary">League management coming next.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter },
});
