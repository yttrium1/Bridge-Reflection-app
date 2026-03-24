import { NextRequest, NextResponse } from "next/server";
import { computeDDSTable } from "@/lib/dds-inline";

function validateHands(hands: Record<string, Record<string, string[]>>): string | null {
  for (const dir of ["N", "E", "S", "W"]) {
    if (!hands[dir]) return `Missing hand for ${dir}`;
    const h = hands[dir];
    const total = (h.S?.length || 0) + (h.H?.length || 0) + (h.D?.length || 0) + (h.C?.length || 0);
    if (total !== 13) return `${dir} has ${total} cards (need 13)`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { hands } = await request.json();

    const err = validateHands(hands);
    if (err) {
      return NextResponse.json(
        { error: "不正なハンドデータです", details: err },
        { status: 400 }
      );
    }

    const result = await computeDDSTable(hands);
    return NextResponse.json(result);
  } catch (error) {
    console.error("DDS error:", error);
    return NextResponse.json(
      { error: "DDS計算に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
