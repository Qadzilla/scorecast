import { colors } from "./theme";

// Semantic aliases for the blueprint auth screens. These re-export the shared
// theme tokens (single source of truth) under blueprint-friendly names, so the
// auth flow and the rest of the app can never drift.
export const brand = {
  paper: colors.bg, // light cool ground
  ink: colors.textPrimary, // brand navy — primary text / solid CTA
  line: colors.accent, // mid-blue — focus, accents, links
  muted: colors.textSecondary, // secondary text
  faint: colors.textTertiary, // labels, placeholders, resting rule
  onInk: colors.textOnBrand, // off-white — text on navy
  danger: colors.danger,
  navy: "#1d2d3d", // the icon's dark ground (splash, dark surfaces)
} as const;
