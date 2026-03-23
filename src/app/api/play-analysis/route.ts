import { NextRequest, NextResponse } from "next/server";
import { computePlayAnalysis } from "@/lib/dds-inline";

export async function POST(request: NextRequest) {
  try {
    const { hands, currentTrick, nextPlayer, trump } = await request.json();

    const trumpMap: Record<string, string> = {
      "♠": "S", "♥": "H", "♦": "D", "♣": "C",
      "S": "S", "H": "H", "D": "D", "C": "C", "NT": "NT",
    };
    const trumpSuit = trumpMap[trump] || "NT";

    const result = await computePlayAnalysis(hands, currentTrick, nextPlayer, trumpSuit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Play analysis error:", error);
    return NextResponse.json(
      { error: "プレイ解析に失敗しました" },
      { status: 500 }
    );
  }
}
