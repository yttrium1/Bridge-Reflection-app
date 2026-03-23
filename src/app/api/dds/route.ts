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
    const { hands } = await request.json();

    const directions = ["N", "E", "S", "W"] as const;
    const handStrings: Record<string, string> = {};
    for (const dir of directions) {
      handStrings[dir] = handsToStringFormat(hands[dir]);
    }

    // Validate all hands have 13 cards
    for (const dir of directions) {
      const cardCount = handStrings[dir].replace(/\./g, "").length;
      if (cardCount !== 13) {
        return NextResponse.json(
          { error: `${dir}のハンドが${cardCount}枚です（13枚必要）` },
          { status: 400 }
        );
      }
    }

    // Single process: compute full 20-cell DDA table
    const input = JSON.stringify({ hands: handStrings, mode: "full" });
    const escaped = input.replace(/'/g, "'\\''");
    const { stdout, stderr } = await execAsync(
      `echo '${escaped}' | node dds-calc.js`,
      { timeout: 60000, cwd: process.cwd() }
    );

    if (stderr) {
      console.warn("DDS stderr:", stderr);
    }

    const result = JSON.parse(stdout.trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error("DDS error:", error);
    return NextResponse.json(
      { error: "DDS計算に失敗しました" },
      { status: 500 }
    );
  }
}
