// DDS solver using Worker Threads - works in Cloud Run / serverless
// Each calculation runs in an isolated Worker to avoid WASM state contamination
import { Worker } from "worker_threads";
import path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Compass = "N" | "E" | "S" | "W";
type SuitOrNT = "S" | "H" | "D" | "C" | "NT";

const LHO: Record<string, string> = { N: "E", E: "S", S: "W", W: "N" };

function handsToStringFormat(hand: Record<string, string[]>): string {
  const suits = ["S", "H", "D", "C"];
  return suits.map(s => {
    const cards = hand[s] || [];
    return cards.map((c: string) => c === "10" ? "T" : c).join("");
  }).join(".");
}

function getWorkerPath(): string {
  // In development: use project root
  // In production (Cloud Run): use relative to cwd
  return path.resolve(process.cwd(), "dds-worker.js");
}

function runInWorker(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(getWorkerPath(), { workerData: data });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

/**
 * Full DDS table: 4 directions x 5 denominations = 20 calculations
 * Each runs in separate Worker Thread for WASM isolation
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

  // Run all 20 in parallel, each in its own Worker
  const tasks: Promise<void>[] = [];
  for (const denom of denominations) {
    for (const declarer of directions) {
      const leader = LHO[declarer];
      tasks.push(
        runInWorker({
          mode: "solveTricks",
          hands: handStrings,
          leader,
          trump: denom,
        }).then((leaderTricks: number) => {
          result[declarer][denom] = 13 - leaderTricks;
        })
      );
    }
  }
  await Promise.all(tasks);

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

  const leader = LHO[declarer];
  const results = await runInWorker({
    mode: "solve",
    hands: handStrings,
    leader,
    trump,
  });

  const maxTricks = Math.max(...results.map((r: any) => r.result));
  const bestLeads = results
    .filter((r: any) => r.result === maxTricks)
    .map((r: any) => ({
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

  const trick = (currentTrick || []).map(c => ({
    suit: c.suit,
    rank: c.rank === "10" ? "T" : c.rank,
  }));

  const results = await runInWorker({
    mode: "solve",
    hands: handStrings,
    leader: nextPlayer,
    trump,
    trick,
    partial: true, // use custom parser for < 13 cards
  });

  const analysis = results.map((r: any) => ({
    suit: r.card.suit,
    rank: r.card.rank === "T" ? "10" : r.card.rank,
    tricks: r.result,
  }));

  const suitOrder: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
  const rankOrder: Record<string, number> = {
    A: 0, K: 1, Q: 2, J: 3, "10": 4, T: 4, "9": 5, "8": 6, "7": 7, "6": 8, "5": 9, "4": 10, "3": 11, "2": 12,
  };
  analysis.sort((a: any, b: any) => {
    if (b.tricks !== a.tricks) return b.tricks - a.tricks;
    if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
    return rankOrder[a.rank] - rankOrder[b.rank];
  });

  const maxTricks = analysis.length > 0 ? analysis[0].tricks : 0;
  return { analysis, maxTricks };
}
