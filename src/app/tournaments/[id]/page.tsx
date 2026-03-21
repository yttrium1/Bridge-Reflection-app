"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc, updateDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import type { TournamentData, BoardData } from "@/lib/bridge/types";
import { useDDS } from "@/hooks/useDDS";

function getContractLevel(contract: string): number {
  const m = contract.match(/^(\d)/);
  return m ? parseInt(m[1]) : 0;
}

function getTrump(contract: string): "C" | "D" | "H" | "S" | "NT" {
  if (contract.includes("\u2660")) return "S";
  if (contract.includes("\u2665")) return "H";
  if (contract.includes("\u2666")) return "D";
  if (contract.includes("\u2663")) return "C";
  if (contract.includes("NT")) return "NT";
  return "NT";
}

// Convert result to over/under tricks (handles both old rawResult and new format)
function normalizeResult(result: number, contractLevel: number): number {
  // If result > 7 or result equals contractLevel, it's likely old format (rawResult = made level)
  if (result > 0 && result >= contractLevel) return result - contractLevel;
  return result;
}

function BoardCardDD({ board, pairNumber }: { board: BoardData; pairNumber: number }) {
  const ddsResult = useDDS(board.hands);
  const myResult = board.travellers.find(
    (t) => t.ns === pairNumber || t.ew === pairNumber
  );
  if (!myResult || !ddsResult) return null;

  const trump = getTrump(myResult.contract);
  const decl = myResult.declarer as "N" | "E" | "S" | "W";
  const contractLevel = getContractLevel(myResult.contract);
  if (contractLevel === 0) return null;

  const ddsTricks = ddsResult[decl]?.[trump];
  if (ddsTricks === undefined) return null;

  const ddsOver = ddsTricks - (contractLevel + 6);
  const actualOver = normalizeResult(myResult.result, contractLevel);
  const diff = actualOver - ddsOver;
  if (Math.abs(diff) > 13) return null; // sanity check

  const diffDisplay = diff > 0 ? `+${diff}` : diff === 0 ? "=" : String(diff);

  // Color: playing side → +blue/-red, defense side → +red/-blue
  const isNS = myResult.ns === pairNumber;
  const declIsMyPair = isNS
    ? (decl === "N" || decl === "S")
    : (decl === "E" || decl === "W");
  const colorClass = diff === 0
    ? "text-gray-400"
    : declIsMyPair
      ? (diff > 0 ? "text-blue-600" : "text-red-600")
      : (diff > 0 ? "text-red-600" : "text-blue-600");

  return (
    <span className={`text-xs ${colorClass}`}>
      DD{diffDisplay}
    </span>
  );
}

export default function TournamentDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const tDoc = await getDoc(
          doc(db, "users", user.uid, "tournaments", tournamentId)
        );
        if (!tDoc.exists()) {
          router.push("/tournaments");
          return;
        }
        setTournament({ id: tDoc.id, ...tDoc.data() } as TournamentData);

        const boardsQuery = query(
          collection(db, "users", user.uid, "tournaments", tournamentId, "boards"),
          orderBy("boardNumber")
        );
        const boardsSnap = await getDocs(boardsQuery);
        setBoards(boardsSnap.docs.map((d) => d.data() as BoardData));
      } catch (err) {
        console.error("Failed to load tournament:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, tournamentId, router]);

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f1]">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!user || !tournament) return;
    if (!window.confirm("この大会データを削除しますか？")) return;
    try {
      // Delete all boards first
      const boardsSnap = await getDocs(
        collection(db, "users", user.uid, "tournaments", tournamentId, "boards")
      );
      for (const d of boardsSnap.docs) {
        await deleteDoc(d.ref);
      }
      // Delete tournament
      await deleteDoc(doc(db, "users", user.uid, "tournaments", tournamentId));
      router.push("/tournaments");
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  if (!tournament) return null;

  const pairNumber = tournament.pairNumber;

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      <header className="bg-[#1a5c2e] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tournaments" className="hover:text-green-200">&larr;</Link>
            <div>
              <h1 className="text-lg font-bold">
                {tournament.name}
                {tournament.sessionNumber && ` Session ${tournament.sessionNumber}`}
              </h1>
              <p className="text-xs text-green-200">
                {tournament.date} | ペア番号: {pairNumber}
                {tournament.partnerName && ` | ${tournament.partnerName}`}
                {tournament.ranking && ` | 順位: ${tournament.ranking}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!user || !tournament) return;
                let shareToken = tournament.shareToken;
                if (!shareToken) {
                  // Generate token
                  shareToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                    .map(b => b.toString(16).padStart(2, "0")).join("");
                  await updateDoc(
                    doc(db, "users", user.uid, "tournaments", tournamentId),
                    { shareToken, ownerUid: user.uid }
                  );
                  setTournament({ ...tournament, shareToken, ownerUid: user.uid });
                }
                const url = `${window.location.origin}/shared/${shareToken}`;
                await navigator.clipboard.writeText(url);
                alert("共有リンクをコピーしました:\n" + url);
              }}
              className="text-xs px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white transition"
            >
              {tournament.shareToken ? "リンクをコピー" : "共有リンク発行"}
            </button>
            <button
              onClick={handleDelete}
              className="text-xs px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 transition"
            >
              削除
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {boards.map((board) => {
            const myResult = board.travellers.find(
              (t) => t.ns === pairNumber || t.ew === pairNumber
            );
            const isNS = myResult?.ns === pairNumber;
            const score = myResult
              ? isNS
                ? (myResult.nsScore > 0 ? myResult.nsScore : -myResult.ewScore)
                : (myResult.ewScore > 0 ? myResult.ewScore : -myResult.nsScore)
              : null;
            const rawMp = myResult?.mp;
            const mp = rawMp !== undefined ? (isNS ? rawMp : 100 - rawMp) : undefined;
            const resultDisplay = myResult
              ? myResult.result > 0 ? `+${myResult.result}` : myResult.result === 0 ? "=" : String(myResult.result)
              : "";

            return (
              <Link
                key={board.boardNumber}
                href={`/tournaments/${tournamentId}/boards/${board.boardNumber}`}
                className="bg-white rounded-lg shadow-sm px-3 py-2 hover:shadow-md transition-shadow border border-gray-100 block"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#1a5c2e]">B{board.boardNumber}</span>
                      {myResult && (
                        <span className="text-xs text-gray-500">
                          {myResult.contract} {myResult.declarer}{" "}
                          <span className={myResult.result < 0 ? "text-red-600" : myResult.result > 0 ? "text-blue-600" : ""}>
                            {resultDisplay}
                          </span>
                        </span>
                      )}
                    </div>
                    {myResult && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span>{score}</span>
                        <BoardCardDD board={board} pairNumber={pairNumber} />
                      </div>
                    )}
                  </div>
                  {mp !== undefined && (
                    <div className={`text-sm font-bold shrink-0 ${mp >= 60 ? "text-blue-600" : mp <= 40 ? "text-red-600" : "text-gray-500"}`}>
                      {mp.toFixed(0)}%
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
