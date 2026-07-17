import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { colors, layout } from "@/constants/theme";

// Placeholder — built out in AD5.
export default function AdminGrants() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="League creators" />
      <View style={styles.pad}>
        <Text color="textSecondary">Grant management coming next.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter },
});
