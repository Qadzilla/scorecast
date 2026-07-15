/**
 * ScoreCast design tokens — the single source of truth for color, type,
 * spacing, radius, shadow and motion. See MOBILE_DESIGN_SPEC.md §2 (DS1).
 * Components import from here only; no literal colors in component files.
 *
 * Unified LIGHT theme. Per-competition accents (PL purple / UCL navy) do the
 * theming; green is reserved for action/success. Dark mode is out of scope for
 * V1 but the shape here (flat maps) leaves room to add one later.
 */

export const colors = {
  bg: "#f1f5f9", // screen background (flat)
  surface: "#ffffff", // cards, sheets, tab bar
  surfaceAlt: "#f8fafc", // inset rows, filled inputs, skeleton base
  border: "#e2e8f0", // hairlines, input borders (default)

  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textTertiary: "#94a3b8", // placeholders, timestamps
  textOnBrand: "#ffffff",

  plPurple: "#3d195b",
  plPurpleLight: "#6b2d8a",
  plTint: "#f3eef8", // PL-scoped fills: active segment, rail tints
  uclNavy: "#04065c",
  uclNavyLight: "#1a237e",
  uclTint: "#e9eaf6",

  // #00ff87 (the web neon) fails contrast on white — decorative use only, on
  // purple/navy grounds. This darkened green is the one used for text/CTAs.
  accent: "#00b368",
  accentPressed: "#009457",
  accentTint: "#e6f7ef",
  neon: "#00ff87", // decorative ONLY, never as text/fill on light surfaces

  danger: "#dc2626",
  dangerTint: "#fdecec",
  warning: "#d97706", // deadline < 24h
  warningTint: "#fdf3e3",
} as const;

export type ColorToken = keyof typeof colors;

/** Competition → accent color set. Drives all league-scoped surfaces. */
export const competition = {
  premier_league: {
    main: colors.plPurple,
    light: colors.plPurpleLight,
    tint: colors.plTint,
    label: "Premier League",
  },
  champions_league: {
    main: colors.uclNavy,
    light: colors.uclNavyLight,
    tint: colors.uclTint,
    label: "Champions League",
  },
} as const;

export type CompetitionKey = keyof typeof competition;

/** Plus Jakarta Sans family keys (see fonts.ts for the load map). */
export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

/**
 * Type scale (§2.2). `variant` names map to fontFamily + size/line-height.
 * `numeral`/`numeralLg` must be rendered with tabular figures — components
 * apply `fontVariant: ["tabular-nums"]` (see `tabularNums` below).
 */
export const type = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
  numeral: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 28 },
  numeralLg: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 38 },
} as const;

export type TypeVariant = keyof typeof type;

/** Apply to any Text showing scores/countdowns/points so digits don't jitter. */
export const tabularNums = { fontVariant: ["tabular-nums" as const] };

/** Clamp OS Dynamic Type scaling; layouts must survive 1.4× (§2.2). */
export const MAX_FONT_SCALE = 1.4;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Screen gutter and card padding, called out so screens stay consistent. */
export const layout = {
  gutter: 20,
  cardPadding: 16,
  rowMinHeight: 56,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
  minTouchTarget: 44,
} as const;

export const radius = {
  sm: 10, // inputs, chips
  md: 14, // cards, buttons
  lg: 20, // sheets, hero cards
  pill: 999,
} as const;

/** The single soft card shadow used everywhere. No blur effects in the app. */
export const shadow = {
  card: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3, // Android
  },
} as const;

export const motion = {
  fast: 150, // presses, segment changes (ease-out)
  sheet: 250, // sheet spring
} as const;

export const theme = {
  colors,
  competition,
  fontFamily,
  type,
  tabularNums,
  spacing,
  layout,
  radius,
  shadow,
  motion,
  MAX_FONT_SCALE,
} as const;

export default theme;
