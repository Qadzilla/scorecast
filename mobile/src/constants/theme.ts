/**
 * ScoreCast design tokens — the single source of truth for color, type,
 * spacing, radius, shadow and motion.
 *
 * The "blueprint" system, derived from the app icon. The icon is dark (navy
 * ground, off-white mark); the in-app experience is the inverse — a light cool
 * paper ground, brand-navy ink, and mid-blue accents. `src/constants/brand.ts`
 * re-exports these as semantic aliases for the auth screens.
 *
 * NOTE: the `plPurple` / `uclNavy` / `neon` token NAMES are legacy — their
 * VALUES are now blueprint navy/blues (rename is a later cleanup).
 */

export const colors = {
  bg: "#f2f6fb", // light cool paper ground
  surface: "#ffffff", // cards, sheets, tab bar
  surfaceAlt: "#eef2f7", // inset rows, filled inputs, skeleton base
  border: "#e3e9f1", // hairlines, input borders (default)

  textPrimary: "#1d2d3d", // brand navy (ink)
  textSecondary: "#5a6b7e",
  textTertiary: "#93a3b4", // placeholders, timestamps, labels
  textOnBrand: "#eef6ff", // off-white — text on navy

  plPurple: "#1d2d3d", // navy — PL main, crest discs, avatars
  plPurpleLight: "#5980a6", // mid-blue — PL light
  plTint: "#e6edf4", // PL-scoped fills: active segment, rail tints
  uclNavy: "#33547a", // steel-blue — UCL main
  uclNavyLight: "#6d92bb",
  uclTint: "#e9eef6",

  accent: "#5980a6", // mid-blue — actions, links, focus
  accentPressed: "#4a6c8f",
  accentTint: "#e4ecf5",
  neon: "#b5d9fd", // bright line-blue — decorative only (on navy)

  danger: "#c0492e",
  dangerTint: "#f7e6e0",
  warning: "#d97706", // deadline < 24h (warm, deliberately pops on the cool palette)
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

/**
 * Font families (see fonts.ts for the load map). Inter across the whole app.
 * `mono` / `monoBold` are kept as aliases (they point at Inter) so components
 * that referenced them keep working — there is no separate mono face.
 */
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  mono: "Inter_600SemiBold",
  monoBold: "Inter_700Bold",
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

// Squared, small radii — echoing the icon's hard-edged square score boxes and
// ruled/technical feel. Straight lines over soft pills.
export const radius = {
  sm: 4, // inputs, chips, otp boxes
  md: 8, // cards, buttons
  lg: 12, // sheets
  pill: 999, // circles only (dots, avatars, skeleton discs)
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
