import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontFamily } from "@/constants/theme";

// Two tabs — leagues ARE the app; account is the only other top-level
// destination (MOBILE_DESIGN_SPEC.md §4.5). Everything else is pushed/modal.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Leagues",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "trophy" : "trophy-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
