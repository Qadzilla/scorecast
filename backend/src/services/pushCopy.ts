// NS1 — notification copy (PUSH_SPEC.md §2), kept in one place so it's
// translatable later. Pure functions; no I/O.

export type PushKind = "deadline_24h" | "deadline_1h" | "results" | "gw_complete";

export interface PushMessage {
  title: string;
  body: string;
}

const pts = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;

export const pushCopy = {
  deadline24h(gwNumber: number, matchCount: number, leagueName: string, deadlineHHmm: string): PushMessage {
    return {
      title: `⏳ GW${gwNumber} locks tomorrow`,
      body: `${matchCount} matches to predict in ${leagueName} — deadline ${deadlineHHmm}.`,
    };
  },
  deadline1h(gwNumber: number, leagueName: string): PushMessage {
    return {
      title: "⏰ 1 hour left",
      body: `Lock in your GW${gwNumber} predictions for ${leagueName}.`,
    };
  },
  // One scored match.
  resultSingle(home: string, homeScore: number, away: string, awayScore: number, earned: number): PushMessage {
    return {
      title: "ScoreCast",
      body: `FT: ${home} ${homeScore}–${awayScore} ${away} — you scored ${pts(earned)}.`,
    };
  },
  // Several matches scored in one tick (per league).
  resultBatch(count: number, totalEarned: number): PushMessage {
    return {
      title: "ScoreCast",
      body: `${count} results in — you scored ${pts(totalEarned)} this round.`,
    };
  },
  gwComplete(gwNumber: number, leagueName: string, rank: string, gwPoints: number): PushMessage {
    return {
      title: `GW${gwNumber} done`,
      body: `You finished ${rank} in ${leagueName} on ${pts(gwPoints)}.`,
    };
  },
};
