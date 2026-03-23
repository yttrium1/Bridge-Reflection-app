import { NextRequest, NextResponse } from "next/server";
import { computeDDSTable } from "@/lib/dds-inline";

export async function POST(request: NextRequest) {
  try {
    const { hands } = await request.json();
    const result = await computeDDSTable(hands);
    return NextResponse.json(result);
  } catch (error) {
    console.error("DDS error:", error);
    return NextResponse.json(
      { error: "DDS計算に失敗しました" },
      { status: 500 }
    );
  }
}
