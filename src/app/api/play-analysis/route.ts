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
    const { hands, currentTrick, nextPlayer, trump } = await request.json();

    const directions = ["N", "E", "S", "W"] as const;
    const handStrings: Record<string, string> = {};
    for (const dir of directions) {
      handStrings[dir] = handsToStringFormat(hands[dir]);
    }

    const trumpMap: Record<string, string> = {
      "♠": "S", "♥": "H", "♦": "D", "♣": "C",
      "S": "S", "H": "H", "D": "D", "C": "C", "NT": "NT",
    };
    const trumpSuit = trumpMap[trump] || "NT";

    const input = JSON.stringify({
      hands: handStrings,
      currentTrick: currentTrick || [],
      nextPlayer,
      trump: trumpSuit,
    });
    const escaped = input.replace(/'/g, "'\\''");
    const { stdout, stderr } = await execAsync(
      `echo '${escaped}' | node play-analysis-calc.js`,
      { timeout: 30000, cwd: process.cwd() }
    );

    if (stderr) {
      console.warn("Play analysis warning:", stderr);
    }

    return NextResponse.json(JSON.parse(stdout));
  } catch (error) {
    console.error("Play analysis error:", error);
    return NextResponse.json(
      { error: "プレイ解析に失敗しました" },
      { status: 500 }
    );
  }
}
