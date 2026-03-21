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

function runBestLeadSolver(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const solverPath = path.join(process.cwd(), "best-lead-calc.js");
    const child = spawn("node", [solverPath], { timeout: 30000 });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });

    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Process exited with code ${code}`));
    });

    child.on("error", reject);

    child.stdin.write(input);
    child.stdin.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const { hands, declarer, trump } = await request.json();

    const directions = ["N", "E", "S", "W"] as const;
    const handStrings: Record<string, string> = {};
    for (const dir of directions) {
      handStrings[dir] = handsToStringFormat(hands[dir]);
    }

    // Convert trump: contract suit symbol to DDS format
    const trumpMap: Record<string, string> = {
      "\u2660": "S", "\u2665": "H", "\u2666": "D", "\u2663": "C",
      "S": "S", "H": "H", "D": "D", "C": "C", "NT": "NT",
    };
    const trumpSuit = trumpMap[trump] || "NT";

    const stdout = await runBestLeadSolver(JSON.stringify({
      hands: handStrings,
      declarer,
      trump: trumpSuit,
    }));

    return NextResponse.json(JSON.parse(stdout));
  } catch (error) {
    console.error("Best lead error:", error);
    return NextResponse.json(
      { error: "ベストリード計算に失敗しました" },
      { status: 500 }
    );
  }
}
