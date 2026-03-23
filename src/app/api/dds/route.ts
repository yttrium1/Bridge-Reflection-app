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
  const { stdout, stderr } = await execAsync(
    `echo '${escaped}' | node dds-calc.js`,
    { timeout: 15000, cwd: process.cwd() }
  );
  if (stderr) {
    console.warn(`DDS warning for ${dir}-${trump}:`, stderr);
  }
  const tricks = parseInt(stdout.trim());
  if (isNaN(tricks) || tricks < 0 || tricks > 13) {
    throw new Error(`Invalid DDS result for ${dir}-${trump}: "${stdout.trim()}"`);
  }
  return tricks;
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

    // Solve all 20 combinations (4 directions × 5 denominations) independently
    // Run each denomination's 4 directions in parallel for speed
    for (const denom of denominations) {
      const [nTricks, eTricks, sTricks, wTricks] = await Promise.all([
        solveSingle(handStrings, "N", denom),
        solveSingle(handStrings, "E", denom),
        solveSingle(handStrings, "S", denom),
        solveSingle(handStrings, "W", denom),
      ]);
      result.N[denom] = nTricks;
      result.E[denom] = eTricks;
      result.S[denom] = sTricks;
      result.W[denom] = wTricks;
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
