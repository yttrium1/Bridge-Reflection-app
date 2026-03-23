// Inline DDS solver - no child_process, works in Cloud Run / serverless
/* eslint-disable @typescript-eslint/no-explicit-any */
const { doubleDummySolve, doubleDummySolveTricks } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

type Compass = "N" | "E" | "S" | "W";
type SuitOrNT = "S" | "H" | "D" | "C" | "NT";

const LHO: Record<string, string> = { N: "E", E: "S", S: "W", W: "N" };

interface Card {
  suit: string;
  rank: string;
}

interface DDSResult {
  card: Card;
  result: number;
}

function handsToStringFormat(hand: Record<string, string[]>): string {
  const suits = ["S", "H", "D", "C"];
  return suits.map(s => {
    const cards = hand[s] || [];
    return cards.map((c: string) => c === "10" ? "T" : c).join("");
  }).join(".");
}

function parseHandToCards(handStr: string): Card[] {
  const suits = ["S", "H", "D", "C"];
  const parts = handStr.split(".");
  const cards: Card[] = [];
  for (let i = 0; i < 4; i++) {
    const suitStr = parts[i] || "";
    for (const ch of suitStr) {
      cards.push({ suit: suits[i], rank: ch });
    }
  }
  return cards;
}

/**
 * Full DDS table: 4 directions x 5 denominations = 20 calculations
 * Each done sequentially to avoid WASM state issues
 */
export async function computeDDSTable(
  hands: Record<string, Record<string, string[]>>
): Promise<Record<string, Record<string, number>>> {
  const directions: Compass[] = ["N", "E", "S", "W"];
  const denominations: SuitOrNT[] = ["C", "D", "H", "S", "NT"];

  const handStrings: Record<string, string> = {};
  for (const dir of directions) {
    handStrings[dir] = handsToStringFormat(hands[dir]);
  }

  // Validate 13 cards per hand
  for (const dir of directions) {
    const count = handStrings[dir].replace(/\./g, "").length;
    if (count !== 13) {
      throw new Error(`${dir} has ${count} cards (need 13)`);
    }
  }

  const result: Record<string, Record<string, number>> = {
    N: {}, E: {}, S: {}, W: {},
  };

  // Sequential to avoid WASM contamination
  for (const denom of denominations) {
    for (const declarer of directions) {
      const deal: any = {};
      for (const d of directions) {
        deal[d] = StringParser.parseHand(handStrings[d]);
      }
      const leader = LHO[declarer] as Compass;
      const leaderTricks = await doubleDummySolveTricks(deal, [], leader, denom);
      result[declarer][denom] = 13 - leaderTricks;
    }
  }

  return result;
}

/**
 * Best lead analysis
 */
export async function computeBestLead(
  hands: Record<string, Record<string, string[]>>,
  declarer: string,
  trump: string
): Promise<{
  leader: string;
  bestLeads: { card: string; suit: string; rank: string; tricks: number }[];
  maxDefenseTricks: number;
}> {
  const directions: Compass[] = ["N", "E", "S", "W"];
  const handStrings: Record<string, string> = {};
  for (const dir of directions) {
    handStrings[dir] = handsToStringFormat(hands[dir]);
  }

  const deal: any = {};
  for (const d of directions) {
    deal[d] = StringParser.parseHand(handStrings[d]);
  }

  const leader = LHO[declarer];
  const results: DDSResult[] = await doubleDummySolve(deal, [], leader, trump);
  const maxTricks = Math.max(...results.map((r: DDSResult) => r.result));
  const bestLeads = results
    .filter((r: DDSResult) => r.result === maxTricks)
    .map((r: DDSResult) => ({
      card: r.card.suit + r.card.rank,
      suit: r.card.suit,
      rank: r.card.rank === "T" ? "10" : r.card.rank,
      tricks: r.result,
    }));

  return { leader, bestLeads, maxDefenseTricks: maxTricks };
}

/**
 * Play analysis - works with partial hands (< 13 cards)
 */
export async function computePlayAnalysis(
  hands: Record<string, Record<string, string[]>>,
  currentTrick: { suit: string; rank: string }[],
  nextPlayer: string,
  trump: string
): Promise<{
  analysis: { suit: string; rank: string; tricks: number }[];
  maxTricks: number;
}> {
  const directions: Compass[] = ["N", "E", "S", "W"];
  const handStrings: Record<string, string> = {};
  for (const dir of directions) {
    handStrings[dir] = handsToStringFormat(hands[dir]);
  }

  // Use custom parser for partial hands
  const deal: any = {};
  for (const d of directions) {
    deal[d] = parseHandToCards(handStrings[d]);
  }

  const trick = (currentTrick || []).map(c => ({
    suit: c.suit,
    rank: c.rank === "10" ? "T" : c.rank,
  }));

  const results: DDSResult[] = await doubleDummySolve(deal, trick, nextPlayer, trump);

  const analysis = results.map((r: DDSResult) => ({
    suit: r.card.suit,
    rank: r.card.rank === "T" ? "10" : r.card.rank,
    tricks: r.result,
  }));

  const suitOrder: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
  const rankOrder: Record<string, number> = {
    A: 0, K: 1, Q: 2, J: 3, "10": 4, T: 4, "9": 5, "8": 6, "7": 7, "6": 8, "5": 9, "4": 10, "3": 11, "2": 12,
  };
  analysis.sort((a, b) => {
    if (b.tricks !== a.tricks) return b.tricks - a.tricks;
    if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
    return rankOrder[a.rank] - rankOrder[b.rank];
  });

  const maxTricks = analysis.length > 0 ? analysis[0].tricks : 0;
  return { analysis, maxTricks };
}
