"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import type { BoardData } from "@/lib/bridge/types";

export default function NewTournamentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pairNumber, setPairNumber] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [ranking, setRanking] = useState("");
  const [sessionNumber, setSessionNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");
    setProgress("fitsys.jpからデータを取得中...");

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "スクレイピングに失敗しました");
      }

      const data = await response.json();
      setProgress(`${data.boards.length}ボードを取得しました。保存中...`);

      // Save to Firestore
      const tournamentRef = doc(collection(db, "users", user.uid, "tournaments"));
      await setDoc(tournamentRef, {
        sourceUrl: url,
        tournamentCode: data.tournamentCode,
        eventId: data.eventId,
        name: data.tournamentName,
        date: data.tournamentDate,
        pairNumber: parseInt(pairNumber.replace(/[^0-9]/g, "")) || 0,
        ...(pairNumber.match(/[A-Za-z]/) && { pairId: pairNumber.toUpperCase() }),
        ...(partnerName && { partnerName }),
        ...(ranking && { ranking }),
        ...(sessionNumber && { sessionNumber }),
        totalBoards: data.totalBoards,
        scoringType: data.scoringType || "MP",
        createdAt: serverTimestamp(),
      });

      // Save boards
      const boardsCol = collection(
        db,
        "users",
        user.uid,
        "tournaments",
        tournamentRef.id,
        "boards"
      );

      for (const board of data.boards as BoardData[]) {
        await setDoc(doc(boardsCol, String(board.boardNumber)), {
          boardNumber: board.boardNumber,
          dealer: board.dealer,
          vulnerability: board.vulnerability,
          hands: board.hands,
          travellers: board.travellers,
          ddsTable: null,
          bidding: null,
          comment: null,
        });
      }

      setProgress("保存完了！");
      router.push(`/tournaments/${tournamentRef.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      <header className="bg-[#1a5c2e] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/tournaments" className="hover:text-green-200">&larr;</Link>
          <h1 className="text-lg font-bold">大会データのインポート</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm p-8 space-y-6"
        >
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              大会結果URL（fitsys.jp）
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="http://www.fitsys.jp/JtosResultPage/WrpTrvView.aspx?CC=..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              fitsys.jpの「Traveling Score」ページのURLを入力してください
            </p>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                自分のペア番号
              </label>
              <input
                type="text"
                value={pairNumber}
                onChange={(e) => setPairNumber(e.target.value)}
                required
                placeholder="例: 7 または A01"
                className="w-40 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-1">MP形式: 数字のみ / IMP形式: A01等</p>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                パートナー名
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="例: 田中太郎"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] text-sm"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                セッション（任意）
              </label>
              <input
                type="text"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
                placeholder="例: 1"
                className="w-24 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                順位（任意）
              </label>
              <input
                type="text"
                value={ranking}
                onChange={(e) => setRanking(e.target.value)}
                placeholder="例: 3/12"
                className="w-32 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {progress && !error && (
            <div className="text-sm text-[#1a5c2e] bg-green-50 rounded-lg px-4 py-3 flex items-center gap-2">
              {loading && (
                <div className="w-4 h-4 border-2 border-[#1a5c2e] border-t-transparent rounded-full animate-spin" />
              )}
              {progress}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1a5c2e] hover:bg-[#2d8a4e] text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "取得中..." : "データを取得"}
          </button>
        </form>
      </main>
    </div>
  );
}
