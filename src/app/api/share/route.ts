import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { uid, tournamentId } = await request.json();
    if (!uid || !tournamentId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Generate a share token
    const token = crypto.randomBytes(16).toString("hex");

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Share error:", error);
    return NextResponse.json({ error: "共有リンクの生成に失敗しました" }, { status: 500 });
  }
}
