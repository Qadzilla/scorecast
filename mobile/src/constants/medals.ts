// Medal colors for paid leaderboard positions — shared by the leaderboard rank
// circles and the prize pool card so they always match. 1st/2nd/3rd are the
// classic podium metals; 2nd-last ("dodged the spoon") gets a distinct orange
// (kept well clear of the gold).
export const medalColors = {
  gold: "#E3B23C",
  silver: "#B9C2CC",
  bronze: "#C08457",
  orange: "#EC7E2D",
} as const;

export type Medal = keyof typeof medalColors;
