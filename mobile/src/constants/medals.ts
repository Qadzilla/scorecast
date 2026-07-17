// Medal colors for paid leaderboard positions — shared by the leaderboard rank
// circles and the prize pool card so they always match. 1st/2nd/3rd are the
// classic podium metals; 2nd-last ("dodged the spoon") gets a distinct yellow.
export const medalColors = {
  gold: "#E3B23C",
  silver: "#B9C2CC",
  bronze: "#C08457",
  yellow: "#FAD21E",
} as const;

export type Medal = keyof typeof medalColors;
