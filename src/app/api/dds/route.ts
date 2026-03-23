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

async function solveSingle(hands: Record<string, string>, declarer: string, trump: string): Promise<number> {
  const input = JSON.stringify({ hands, declarer, trump });
  const escaped = input.replace(/'/g, "'\\''");
  const { stdout, stderr } = await execAsync(
    `echo '${escaped}' | node dds-calc.js`,
    { timeout: 30000, cwd: process.cwd() }
  );
  if (stderr) {
    console.warn(`DDS warning for ${declarer}-${trump}:`, stderr);
  }
  const tricks = parseInt(stdout.trim());
  if (isNaN(tricks) || tricks < 0 || tricks > 13) {
    throw new Error(`Invalid DDS result for ${declarer}-${trump}: "${stdout.trim()}"`);
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

    const denominations = ["C", "D", "H", "S", "NT"];
    const result: Record<string, Record<string, number>> = {
      N: {}, E: {}, S: {}, W: {},
    };

    // Run all 20 calculations in parallel (separate processes to avoid WASM state contamination)
    const tasks: Promise<void>[] = [];
    for (const denom of denominations) {
      for (const declarer of directions) {
        tasks.push(
          solveSingle(handStrings, declarer, denom).then(tricks => {
            result[declarer][denom] = tricks;
          })
        );
      }
    }
    await Promise.all(tasks);

    return NextResponse.json(result);
  } catch (error) {
    console.error("DDS error:", error);
    return NextResponse.json(
      { error: "DDS計算に失敗しました" },
      { status: 500 }
    );
  }
}
