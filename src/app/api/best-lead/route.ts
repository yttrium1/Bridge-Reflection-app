import { NextRequest, NextResponse } from "next/server";
import { computeBestLead } from "@/lib/dds-inline";

export async function POST(request: NextRequest) {
  try {
    const { hands, declarer, trump } = await request.json();

    const trumpMap: Record<string, string> = {
      "♠": "S", "♥": "H", "♦": "D", "♣": "C",
      "S": "S", "H": "H", "D": "D", "C": "C", "NT": "NT",
    };
    const trumpSuit = trumpMap[trump] || "NT";

    const result = await computeBestLead(hands, declarer, trumpSuit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Best lead error:", error);
    return NextResponse.json(
      { error: "ベストリード計算に失敗しました" },
      { status: 500 }
    );
  }
}
