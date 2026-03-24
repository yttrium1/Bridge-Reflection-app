"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, deleteDoc, updateDoc, collection, getDocs, orderBy, query, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { TournamentData, BoardData } from "@/lib/bridge/types";
import { useDDS } from "@/hooks/useDDS";
import HandDiagram from "@/components/HandDiagram";

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
  const [uploadingPdf, setUploadingPdf] = useState(false);

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
        setBoards(boardsSnap.docs.map((d) => ({ ...d.data(), _docId: d.id } as BoardData & { _docId: string })));
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

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !tournament) return;
    setUploadingPdf(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/tournaments/${tournamentId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      await updateDoc(
        doc(db, "users", user.uid, "tournaments", tournamentId),
        { pdfUrls: arrayUnion(downloadUrl) }
      );
      setTournament({ ...tournament, pdfUrls: [...(tournament.pdfUrls || []), downloadUrl] });
    } catch (err) {
      console.error("PDF upload failed:", err);
      alert("PDFのアップロードに失敗しました");
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
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
          <div className="flex gap-2 flex-wrap justify-end">
            <Link
              href={`/tournaments/${tournamentId}/add-session`}
              className="text-xs px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white transition"
            >
              + セッション追加
            </Link>
            <label className="text-xs px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white transition cursor-pointer">
              {uploadingPdf ? "アップロード中..." : "PDF アップロード"}
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
                disabled={uploadingPdf}
              />
            </label>
            <button
              onClick={async () => {
                if (!user || !tournament) return;
                let shareToken = tournament.shareToken;
                if (!shareToken) {
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
        {/* PDF Results Button */}
        <div className="mb-4 flex gap-2 flex-wrap items-center">
          {tournament.pdfUrls && tournament.pdfUrls.length > 0 ? (
            tournament.pdfUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-lg bg-[#1a5c2e] text-white hover:bg-[#2d8a4e] transition inline-flex items-center gap-1.5 font-bold"
              >
                📄 結果{tournament.pdfUrls!.length > 1 ? ` ${i + 1}` : ""}
              </a>
            ))
          ) : (
            <span className="text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-400 border border-gray-200 inline-flex items-center gap-1.5">
              📄 結果未アップロード
            </span>
          )}
        </div>
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

          // Get pair number for each session
          const getSessionPairNumber = (sn: string): number => {
            const sessionInfo = tournament.sessions?.find(s => s.sessionNumber === sn);
            return sessionInfo?.pairNumber || tournament.pairNumber;
          };

          return sessionEntries.map(([sn, sessionBoards]) => {
            const sessionPairNumber = getSessionPairNumber(sn);
            const isIMP = tournament.scoringType === "IMP";
            const pairId = (tournament as TournamentData & { pairId?: string }).pairId;

            // Calculate session average
            const sessionScores: number[] = [];
            for (const board of sessionBoards) {
              const myResult = isIMP && pairId
                ? board.travellers.find((t) => t.nsId === pairId || t.ewId === pairId)
                : board.travellers.find((t) => t.ns === sessionPairNumber || t.ew === sessionPairNumber);
              if (!myResult) continue;
              const isNS = isIMP && pairId
                ? myResult.nsId === pairId
                : myResult.ns === sessionPairNumber;

              if (isIMP && myResult.impPerTable !== undefined) {
                sessionScores.push(myResult.impPerTable);
              } else if (!isIMP && myResult.mp !== undefined) {
                sessionScores.push(isNS ? myResult.mp : 100 - myResult.mp);
              }
            }
            const avgScore = sessionScores.length > 0
              ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
              : null;

            return (
              <div key={sn} className={hasSessions ? "mb-8" : ""}>
                {hasSessions && (
                  <h3 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1 flex items-center gap-3">
                    <span>Session {sn}</span>
                    <span className="text-sm font-normal text-gray-400">ペア番号: {sessionPairNumber}</span>
                    {avgScore !== null && (
                      <span className={`text-sm font-bold ml-auto ${
                        isIMP
                          ? (avgScore > 0 ? "text-blue-600" : avgScore < 0 ? "text-red-600" : "text-gray-500")
                          : (avgScore >= 55 ? "text-blue-600" : avgScore <= 45 ? "text-red-600" : "text-gray-500")
                      }`}>
                        平均: {isIMP ? `${avgScore > 0 ? "+" : ""}${avgScore.toFixed(2)} IMP` : `${avgScore.toFixed(1)}%`}
                      </span>
                    )}
                  </h3>
                )}
                {!hasSessions && avgScore !== null && (
                  <div className={`mb-3 text-sm font-bold ${
                    isIMP
                      ? (avgScore > 0 ? "text-blue-600" : avgScore < 0 ? "text-red-600" : "text-gray-500")
                      : (avgScore >= 55 ? "text-blue-600" : avgScore <= 45 ? "text-red-600" : "text-gray-500")
                  }`}>
                    平均: {isIMP ? `${avgScore > 0 ? "+" : ""}${avgScore.toFixed(2)} IMP` : `${avgScore.toFixed(1)}%`}
                  </div>
                )}
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {sessionBoards.map((board) => {
                    const boardDocId = (board as BoardData & { _docId?: string })._docId || String(board.boardNumber);
                    const myResult = isIMP && pairId
                      ? board.travellers.find(
                          (t) => t.nsId === pairId || t.ewId === pairId
                        )
                      : board.travellers.find(
                          (t) => t.ns === sessionPairNumber || t.ew === sessionPairNumber
                        );
                    const isNS = isIMP && pairId
                      ? myResult?.nsId === pairId
                      : myResult?.ns === sessionPairNumber;
                    const score = myResult
                      ? isNS
                        ? (myResult.nsScore > 0 ? myResult.nsScore : -myResult.ewScore)
                        : (myResult.ewScore > 0 ? myResult.ewScore : -myResult.nsScore)
                      : null;
                    const rawMp = myResult?.mp;
                    const mp = rawMp !== undefined && !isIMP ? (isNS ? rawMp : 100 - rawMp) : undefined;
                    const resultDisplay = myResult
                      ? myResult.result > 0 ? `+${myResult.result}` : myResult.result === 0 ? "=" : String(myResult.result)
                      : "";

                    return (
                      <Link
                        key={boardDocId}
                        href={`/tournaments/${tournamentId}/boards/${boardDocId}`}
                        className="bg-white rounded-lg shadow-sm px-3 py-2 hover:shadow-md transition-shadow border border-gray-100 block"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#1a5c2e]">#{board.boardNumber}</span>
                              {myResult && (() => {
                                const decl = myResult.declarer as string;
                                const declIsMyPair = isNS
                                  ? (decl === "N" || decl === "S")
                                  : (decl === "E" || decl === "W");
                                return (
                                  <>
                                    <span className={`text-[10px] font-bold px-1 rounded ${declIsMyPair ? "text-blue-600 bg-blue-50" : "text-orange-600 bg-orange-50"}`}>
                                      {declIsMyPair ? "Play" : "Defense"}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {myResult.contract} {myResult.declarer}{" "}
                                      <span className={myResult.result < 0 ? "text-red-600" : myResult.result > 0 ? "text-blue-600" : ""}>
                                        {resultDisplay}
                                      </span>
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                            {myResult && (
                              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                <span>{score}</span>
                                <BoardCardDD board={board} pairNumber={sessionPairNumber} />
                              </div>
                            )}
                          </div>
                          {mp !== undefined && !isIMP && (
                            <div className={`text-sm font-bold shrink-0 ${mp >= 60 ? "text-blue-600" : mp <= 40 ? "text-red-600" : "text-gray-500"}`}>
                              {mp.toFixed(0)}%
                            </div>
                          )}
                          {isIMP && myResult?.impPerTable !== undefined && (
                            <div className={`text-sm font-bold shrink-0 ${myResult.impPerTable > 0 ? "text-blue-600" : myResult.impPerTable < 0 ? "text-red-600" : "text-gray-500"}`}>
                              {myResult.impPerTable > 0 ? "+" : ""}{myResult.impPerTable.toFixed(2)}
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

        {/* Hand Records */}
        <h3 className="text-lg font-bold text-gray-700 mt-8 mb-4">Hand Records</h3>
        {(() => {
          const hrSessions = new Map<string, (BoardData & { _docId?: string })[]>();
          for (const board of boards) {
            const sn = (board as BoardData & { sessionNumber?: string }).sessionNumber || tournament.sessionNumber || "1";
            if (!hrSessions.has(sn)) hrSessions.set(sn, []);
            hrSessions.get(sn)!.push(board);
          }
          const hrEntries = Array.from(hrSessions.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
          const hasMultiple = hrEntries.length > 1;

          return hrEntries.map(([sn, sessionBoards]) => (
            <div key={`hr-${sn}`} className={hasMultiple ? "mb-6" : ""}>
              {hasMultiple && (
                <h4 className="text-sm font-bold text-gray-500 mb-2">Session {sn}</h4>
              )}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {sessionBoards.map((board) => {
                  const boardDocId = (board as BoardData & { _docId?: string })._docId || String(board.boardNumber);
                  return (
                    <Link
                      key={`hand-${boardDocId}`}
                      href={`/tournaments/${tournamentId}/boards/${boardDocId}`}
                      className="block hover:shadow-md transition-shadow"
                    >
                      <HandDiagram
                        hands={board.hands}
                        dealer={board.dealer}
                        vulnerability={board.vulnerability}
                        boardNumber={board.boardNumber}
                        compact
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ));
        })()}

        {/* Edit History */}
        {(() => {
          // Collect all edit history entries from all boards
          const allHistory: { boardNumber: number; entry: { timestamp: string; editor: string; field: string } }[] = [];
          boards.forEach((board) => {
            if (board.editHistory) {
              board.editHistory.forEach((entry) => {
                allHistory.push({ boardNumber: board.boardNumber, entry });
              });
            }
          });
          allHistory.sort((a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime());

          if (allHistory.length === 0) return null;

          return (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-700 mb-4">編集履歴</h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {allHistory.slice(0, 50).map((item, i) => (
                    <div key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(item.entry.timestamp).toLocaleString("ja-JP")}
                      </span>
                      <span>
                        <span className="font-medium">{item.entry.editor}</span>
                        {" が "}
                        <Link
                          href={`/tournaments/${tournamentId}/boards/${item.boardNumber}`}
                          className="text-[#1a5c2e] font-bold hover:underline"
                        >
                          #{item.boardNumber}
                        </Link>
                        {" に"}
                        {item.entry.field === "bidding" ? "ビッディング" : "コメント"}
                        {"を追加しました"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
