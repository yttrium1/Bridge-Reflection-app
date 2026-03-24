import { NextRequest, NextResponse } from "next/server";
import { computeDDSTable } from "@/lib/dds-inline";

export async function POST(request: NextRequest) {
  try {
    const { hands } = await request.json();
    const result = await computeDDSTable(hands);
    return NextResponse.json(result);
  } catch (error) {
    console.error("DDS error:", error);
    console.error("CWD:", process.cwd());
    console.error("__dirname:", __dirname);
    return NextResponse.json(
      { error: "DDS計算に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
