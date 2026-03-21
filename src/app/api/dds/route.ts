import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

function handsToStringFormat(hand: Record<string, string[]>): string {
  const suits = ["S", "H", "D", "C"];
  return suits.map(s => {
    const cards = hand[s] || [];
    return cards.map((c: string) => c === "10" ? "T" : c).join("");
  }).join(".");
}

function solveSingle(hands: Record<string, string>, dir: string, trump: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const singlePath = path.join(process.cwd(), "dds-calc.js");
    const child = spawn("node", [singlePath], {
      timeout: 15000,
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      if (code === 0) resolve(parseInt(stdout));
      else reject(new Error(stderr || `exit ${code}`));
    });
    child.on("error", reject);
    child.stdin.write(JSON.stringify({ hands, dir, trump }));
    child.stdin.end();
  });
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

    // Each trump in a separate process to avoid WASM corruption
    // Only solve for North, derive others
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
