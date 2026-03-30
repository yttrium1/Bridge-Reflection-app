"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collectionGroup, query, where, getDocs, collection, orderBy } from "firebase/firestore";
import type { TournamentData, BoardData } from "@/lib/bridge/types";

export default function SharedTournamentPage() {
  const params = useParams();
  const token = params.token as string;

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchShared = async () => {
      try {
        // Find tournament by shareToken
        const q = query(
          collectionGroup(db, "tournaments"),
          where("shareToken", "==", token)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setError("共有リンクが見つかりません");
          setLoading(false);
          return;
        }

        const doc = snap.docs[0];
        const data = { id: doc.id, ...doc.data() } as TournamentData;
        setTournament(data);
        setTournamentId(doc.id);

        // Extract ownerUid from path: users/{uid}/tournaments/{id}
        const uid = doc.ref.parent.parent?.id || "";
        setOwnerUid(uid);

        // Fetch boards
        const boardsQuery = query(
          collection(db, "users", uid, "tournaments", doc.id, "boards"),
          orderBy("boardNumber")
        );
        const boardsSnap = await getDocs(boardsQuery);
        setBoards(boardsSnap.docs.map((d) => ({ ...d.data(), _docId: d.id } as BoardData & { _docId: string })));
      } catch (err) {
        console.error("Failed to load shared data:", err);
        setError("データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f1]">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f1]">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-600 mb-2">{error || "データが見つかりません"}</h1>
        </div>
      </div>
    );
  }

  const pairNumber = tournament.pairNumber;

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      <header className="bg-[#1a5c2e] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold">
            {tournament.name}
            {tournament.sessionNumber && ` Session ${tournament.sessionNumber}`}
          </h1>
          <p className="text-xs text-green-200">
            {tournament.date} | ペア番号: {pairNumber}
            {tournament.partnerName && ` | ${tournament.partnerName}`}
            {tournament.ranking && ` | 順位: ${tournament.ranking}`}
            <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">共有ビュー</span>
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {(() => {
          // Group boards by session
          const sessions = new Map<string, (BoardData & { _docId?: string })[]>();
          for (const board of boards) {
            const sn = (board as BoardData & { sessionNumber?: string }).sessionNumber || tournament.sessionNumber || "1";
            if (!sessions.has(sn)) sessions.set(sn, []);
            sessions.get(sn)!.push(board);
          }
          const sessionEntries = Array.from(sessions.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
          const hasSessions = sessionEntries.length > 1;

          const getSessionPairNumber = (sn: string): number => {
            const sessionInfo = tournament.sessions?.find(s => s.sessionNumber === sn);
            return sessionInfo?.pairNumber || tournament.pairNumber;
          };

          return sessionEntries.map(([sn, sessionBoards]) => {
            const sessionPairNumber = getSessionPairNumber(sn);
            return (
              <div key={sn} className={hasSessions ? "mb-6" : ""}>
                {hasSessions && (
                  <h3 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">
                    <span>Session {sn}</span>
                    <span className="text-sm font-normal text-gray-400 ml-3">ペア番号: {sessionPairNumber}</span>
                  </h3>
                )}
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {sessionBoards.map((board) => {
                    const boardDocId = (board as BoardData & { _docId?: string })._docId || String(board.boardNumber);
                    const myResult = board.travellers.find(
                      (t) => t.ns === sessionPairNumber || t.ew === sessionPairNumber
                    );
                    const isNS = myResult?.ns === sessionPairNumber;
                    const rawMp = myResult?.mp;
                    const mp = rawMp !== undefined ? (isNS ? rawMp : 100 - rawMp) : undefined;
                    const resultDisplay = myResult
                      ? myResult.result > 0 ? `+${myResult.result}` : myResult.result === 0 ? "=" : String(myResult.result)
                      : "";

                    return (
                      <Link
                        key={boardDocId}
                        href={`/shared/${token}/boards/${boardDocId}`}
                        className="bg-white rounded-lg shadow-sm px-3 py-2 hover:shadow-md transition-shadow border border-gray-100 block"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#1a5c2e]">#{board.boardNumber}</span>
                              {myResult && (
                                <span className="text-xs text-gray-500">
                                  {myResult.contract} {myResult.declarer}{" "}
                                  <span className={myResult.result < 0 ? "text-red-600" : myResult.result > 0 ? "text-blue-600" : ""}>
                                    {resultDisplay}
                                  </span>
                                </span>
                              )}
                            </div>
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
              </div>
            );
          });
        })()}
      </main>
    </div>
  );
}
