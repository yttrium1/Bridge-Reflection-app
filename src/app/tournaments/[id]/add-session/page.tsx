"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, setDoc, arrayUnion } from "firebase/firestore";
import type { BoardData } from "@/lib/bridge/types";

export default function AddSessionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id: tournamentId } = useParams();
  const [url, setUrl] = useState("");
  const [pairNumber, setPairNumber] = useState("");
  const [sessionNumber, setSessionNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tournamentId) return;

    if (!sessionNumber.trim()) {
      setError("セッション番号を入力してください");
      return;
    }

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

      const tid = tournamentId as string;
      const tournamentRef = doc(db, "users", user.uid, "tournaments", tid);

      // Get current tournament to update totalBoards
      const tournamentSnap = await getDoc(tournamentRef);
      const currentData = tournamentSnap.data();
      const currentTotal = currentData?.totalBoards || 0;

      // Add session info to tournament
      await updateDoc(tournamentRef, {
        totalBoards: currentTotal + data.boards.length,
        sessions: arrayUnion({
          sessionNumber: sessionNumber.trim(),
          sourceUrl: url,
          pairNumber: parseInt(pairNumber),
          totalBoards: data.boards.length,
        }),
      });

      // Save boards with session prefix
      const boardsCol = collection(db, "users", user.uid, "tournaments", tid, "boards");

      for (const board of data.boards as BoardData[]) {
        const boardDocId = `s${sessionNumber}-${board.boardNumber}`;
        await setDoc(doc(boardsCol, boardDocId), {
          boardNumber: board.boardNumber,
          dealer: board.dealer,
          vulnerability: board.vulnerability,
          hands: board.hands,
          travellers: board.travellers,
          ddsTable: null,
          bidding: null,
          comment: null,
          sessionNumber: sessionNumber.trim(),
          pairNumber: parseInt(pairNumber),
        });
      }

      setProgress("保存完了！");
      router.push(`/tournaments/${tid}`);
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
          <Link href={`/tournaments/${tournamentId}`} className="hover:text-green-200">&larr;</Link>
          <h1 className="text-lg font-bold">セッション追加</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm p-8 space-y-6"
        >
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              セッションのURL（fitsys.jp）
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="http://www.fitsys.jp/JtosResultPage/WrpTrvView.aspx?CC=..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] text-sm"
            />
          </div>

          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                セッション番号
              </label>
              <input
                type="text"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
                required
                placeholder="例: 2"
                className="w-24 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                ペア番号
              </label>
              <input
                type="number"
                value={pairNumber}
                onChange={(e) => setPairNumber(e.target.value)}
                required
                min="1"
                placeholder="例: 7"
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
            {loading ? "取得中..." : "セッションを追加"}
          </button>
        </form>
      </main>
    </div>
  );
}
