import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function handsToStringFormat(hand: Record<string, string[]>): string {
  const suits = ["S", "H", "D", "C"];
  return suits.map(s => {
    const cards = hand[s] || [];
    return cards.map((c: string) => c === "10" ? "T" : c).join("");
  }).join(".");
}

async function solveSingle(hands: Record<string, string>, dir: string, trump: string): Promise<number> {
  const input = JSON.stringify({ hands, dir, trump });
  const escaped = input.replace(/'/g, "'\\''");
  const { stdout } = await execAsync(
    `echo '${escaped}' | node dds-calc.js`,
    { timeout: 15000, cwd: process.cwd() }
  );
  return parseInt(stdout.trim());
}

export async function POST(request: NextRequest) {
  try {
    const { hands } = await request.json();

    const directions = ["N", "E", "S", "W"] as const;
    const handStrings: Record<string, string> = {};
    for (const dir of directions) {
      handStrings[dir] = handsToStringFormat(hands[dir]);
    }

    const denominations = ["C", "D", "H", "S", "NT"];
    const result: Record<string, Record<string, number>> = {
      N: {}, E: {}, S: {}, W: {},
    };

    for (const denom of denominations) {
      const nTricks = await solveSingle(handStrings, "N", denom);
      result.N[denom] = nTricks;
      result.S[denom] = nTricks;
      result.E[denom] = 13 - nTricks;
      result.W[denom] = 13 - nTricks;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("DDS error:", error);
    return NextResponse.json(
      { error: "DDS計算に失敗しました" },
      { status: 500 }
    );
  }
}
