// DDS solver using child_process - works in Cloud Run / serverless
// Each calculation runs in an isolated process to avoid WASM state contamination
// Node.js builtins are externalized via next.config.ts webpack config
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Compass = "N" | "E" | "S" | "W";

const LHO: Record<string, string> = { N: "E", E: "S", S: "W", W: "N" };

function handsToStringFormat(hand: Record<string, string[]>): string {
  const suits = ["S", "H", "D", "C"];
  return suits.map(s => {
    const cards = hand[s] || [];
    return cards.map((c: string) => c === "10" ? "T" : c).join("");
  }).join(".");
}

function findCliPath(): string {
  const cliFile = "dds-worker-cli.js";
  const candidates = [
    path.resolve(process.cwd(), cliFile),
    path.resolve(process.cwd(), "..", cliFile),
    path.resolve("/workspace", cliFile),
    path.resolve("/app", cliFile),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch { /* ignore */ }
  }
  return path.resolve(process.cwd(), cliFile);
}

function runCli(data: any): Promise<any> {
  const cliPath = findCliPath();
  return new Promise((resolve, reject) => {
    const child = spawn("node", [cliPath], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`DDS CLI exited with code ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error(`Failed to parse DDS output: ${stdout}`));
        }
      }
    });

    child.on("error", reject);

    // Write input and close stdin
    child.stdin.write(JSON.stringify(data));
    child.stdin.end();
  });
}

/**
 * Full DDS table: 4 directions x 5 denominations = 20 calculations
 * All computed in a single child process with cache clearing between calls
 */
export async function computeDDSTable(
  hands: Record<string, Record<string, string[]>>
): Promise<Record<string, Record<string, number>>> {
  const directions: Compass[] = ["N", "E", "S", "W"];

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

  const response = await runCli({
    mode: "fullTable",
    hands: handStrings,
  });

  return response.result;
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
  const results = await runCli({
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

  const results = await runCli({
    mode: "solve",
    hands: handStrings,
    leader: nextPlayer,
    trump,
    trick,
    partial: true,
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
