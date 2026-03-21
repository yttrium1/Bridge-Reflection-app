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

export async function POST(request: NextRequest) {
  try {
    const { hands, declarer, trump } = await request.json();

    const directions = ["N", "E", "S", "W"] as const;
    const handStrings: Record<string, string> = {};
    for (const dir of directions) {
      handStrings[dir] = handsToStringFormat(hands[dir]);
    }

    const trumpMap: Record<string, string> = {
      "\u2660": "S", "\u2665": "H", "\u2666": "D", "\u2663": "C",
      "S": "S", "H": "H", "D": "D", "C": "C", "NT": "NT",
    };
    const trumpSuit = trumpMap[trump] || "NT";

    const input = JSON.stringify({
      hands: handStrings,
      declarer,
      trump: trumpSuit,
    });
    const escaped = input.replace(/'/g, "'\\''");
    const { stdout } = await execAsync(
      `echo '${escaped}' | node best-lead-calc.js`,
      { timeout: 30000, cwd: process.cwd() }
    );

    return NextResponse.json(JSON.parse(stdout));
  } catch (error) {
    console.error("Best lead error:", error);
    return NextResponse.json(
      { error: "ベストリード計算に失敗しました" },
      { status: 500 }
    );
  }
}
