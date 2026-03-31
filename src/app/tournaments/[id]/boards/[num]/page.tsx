"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import type { TournamentData, BoardData, EditHistoryEntry } from "@/lib/bridge/types";
import HandDiagram from "@/components/HandDiagram";
import TravellerTable from "@/components/TravellerTable";
import DDSTable from "@/components/DDSTable";
import BiddingBox, { type BiddingEntry } from "@/components/BiddingBox";
import CommentEditor from "@/components/CommentEditor";
import { useDDS } from "@/hooks/useDDS";
import BestLead from "@/components/BestLead";
import PlayAnalyzer from "@/components/PlayAnalyzer";
import { contractToTrump } from "@/lib/bridge/play-utils";

export default function BoardDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const boardNum = params.num as string;

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);

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
        if (tDoc.exists()) {
          setTournament({ id: tDoc.id, ...tDoc.data() } as TournamentData);
        }

        const bDoc = await getDoc(
          doc(
            db,
            "users",
            user.uid,
            "tournaments",
            tournamentId,
            "boards",
            boardNum
          )
        );
        if (bDoc.exists()) {
          const bData = bDoc.data() as BoardData;
          setBoard(bData);
          setFavorite(!!(bData as BoardData & { favorite?: boolean }).favorite);
        }
      } catch (err) {
        console.error("Failed to load board:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, tournamentId, boardNum, router]);

  const saveBidding = useCallback(
    async (bidding: BiddingEntry[]) => {
      if (!user) return;
      const oldValue = board?.bidding ? JSON.stringify(board.bidding) : "";
      const newValue = JSON.stringify(bidding);
      // Only record history if content actually changed
      if (oldValue === newValue) return;
      try {
        const historyEntry: EditHistoryEntry = {
          timestamp: new Date().toISOString(),
          editor: user.email || "Owner",
          field: "bidding",
          oldValue,
          newValue,
        };
        await updateDoc(
          doc(db, "users", user.uid, "tournaments", tournamentId, "boards", boardNum),
          { bidding, editHistory: arrayUnion(historyEntry) }
        );
        setBoard((prev) => prev ? { ...prev, bidding } : prev);
      } catch (err) {
        console.error("Failed to save bidding:", err);
      }
    },
    [user, tournamentId, boardNum, board?.bidding]
  );

  const saveComment = useCallback(
    async (comment: string) => {
      if (!user) return;
      const oldValue = board?.comment || "";
      // Only record history if content actually changed
      if (oldValue === comment) return;
      try {
        const historyEntry: EditHistoryEntry = {
          timestamp: new Date().toISOString(),
          editor: user.email || "Owner",
          field: "comment",
          oldValue,
          newValue: comment,
        };
        await updateDoc(
          doc(db, "users", user.uid, "tournaments", tournamentId, "boards", boardNum),
          { comment, editHistory: arrayUnion(historyEntry) }
        );
        setBoard((prev) => prev ? { ...prev, comment } : prev);
      } catch (err) {
        console.error("Failed to save comment:", err);
      }
    },
    [user, tournamentId, boardNum, board?.comment]
  );

  const toggleFavorite = useCallback(async () => {
    if (!user) return;
    const newVal = !favorite;
    setFavorite(newVal);
    try {
      await updateDoc(
        doc(db, "users", user.uid, "tournaments", tournamentId, "boards", boardNum),
        { favorite: newVal }
      );
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      setFavorite(!newVal);
    }
  }, [user, tournamentId, boardNum, favorite]);

  const { ddsTable: ddsResult, progress: ddsProgress } = useDDS(board?.hands || null, {
    cachedResult: board?.ddsTable || null,
    firestorePath: user ? { uid: user.uid, tournamentId, boardId: boardNum } : undefined,
  });

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f1]">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!board || !tournament) return null;

  const pairNumber = tournament.pairNumber;
  const isIMP = tournament.scoringType === "IMP";
  const isDAT = tournament.scoringType === "DAT";
  const pairId = (tournament as TournamentData & { pairId?: string }).pairId;
  const myResult = isIMP && pairId
    ? board.travellers.find((t) => t.nsId === pairId || t.ewId === pairId)
    : board.travellers.find((t) => t.ns === pairNumber || t.ew === pairNumber);
  const isEW = isIMP && pairId
    ? myResult?.ewId === pairId
    : myResult?.ew === pairNumber;

  // Navigation: handle both "7" (session 1) and "s2-7" (session 2+) formats
  const sessionMatch = boardNum.match(/^s(\d+)-(\d+)$/);
  const sessionPrefix = sessionMatch ? `s${sessionMatch[1]}-` : "";
  const currentNum = sessionMatch ? parseInt(sessionMatch[2]) : parseInt(boardNum);
  const sessionTotal = sessionMatch
    ? (tournament.sessions?.find(s => s.sessionNumber === sessionMatch[1])?.totalBoards ?? tournament.totalBoards)
    : tournament.totalBoards;
  const prevBoard = currentNum > 1 ? `${sessionPrefix}${currentNum - 1}` : null;
  const nextBoard = currentNum < sessionTotal ? `${sessionPrefix}${currentNum + 1}` : null;

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      <header className="bg-[#1a5c2e] text-white shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/tournaments/${tournamentId}`}
              className="hover:text-green-200"
            >
              &larr;
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                Board {currentNum}{sessionMatch ? ` (S${sessionMatch[1]})` : ""}
                <button
                  onClick={toggleFavorite}
                  className="text-xl leading-none hover:scale-110 transition-transform"
                  title={favorite ? "お気に入り解除" : "お気に入り登録"}
                >
                  {favorite ? "⭐" : "☆"}
                </button>
              </h1>
              <p className="text-xs text-green-200">{tournament.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/tournaments"
              className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
            >
              TOP
            </Link>
            {prevBoard && (
              <Link
                href={`/tournaments/${tournamentId}/boards/${prevBoard}`}
                className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
              >
                &larr; Board {currentNum - 1}
              </Link>
            )}
            {nextBoard && (
              <Link
                href={`/tournaments/${tournamentId}/boards/${nextBoard}`}
                className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
              >
                Board {currentNum + 1} &rarr;
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* My Result Summary */}
        {myResult && (
          <div className="bg-[#c8a84e]/10 border border-[#c8a84e]/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {myResult.ns === pairNumber ? (
                      <><span className="font-bold text-gray-900">NS {myResult.ns}</span> vs EW {myResult.ew}</>
                    ) : (
                      <><span className="font-bold text-gray-900">EW {myResult.ew}</span> vs NS {myResult.ns}</>
                    )}
                  </span>
                  {(() => {
                    const decl = myResult.declarer as string;
                    const declIsMyPair = isEW
                      ? (decl === "E" || decl === "W")
                      : (decl === "N" || decl === "S");
                    return (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        declIsMyPair
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {declIsMyPair ? "Play" : "Defense"}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-lg font-bold">
                  {myResult.contract} by {myResult.declarer}{" "}
                  <span
                    className={
                      myResult.result < 0
                        ? "text-red-600"
                        : myResult.result > 0
                        ? "text-blue-600"
                        : ""
                    }
                  >
                    {myResult.result > 0
                      ? `+${myResult.result}`
                      : myResult.result === 0
                      ? "="
                      : myResult.result}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Score</div>
                {(() => {
                  // NS perspective: nsScore is positive when NS scores, ewScore when EW scores
                  // For NS player: show nsScore if >0, else -ewScore
                  // For EW player: show ewScore if >0, else -nsScore
                  const score = isEW
                    ? (myResult.ewScore > 0 ? myResult.ewScore : -myResult.nsScore)
                    : (myResult.nsScore > 0 ? myResult.nsScore : -myResult.ewScore);
                  return (
                    <div className={`text-lg font-bold ${score < 0 ? "text-red-600" : ""}`}>
                      {score}
                    </div>
                  );
                })()}
              </div>
              {/* DDS comparison */}
              {ddsResult && (() => {
                const decl = myResult.declarer as "N" | "E" | "S" | "W";
                const trump = (() => {
                  if (myResult.contract.includes("\u2660")) return "S" as const;
                  if (myResult.contract.includes("\u2665")) return "H" as const;
                  if (myResult.contract.includes("\u2666")) return "D" as const;
                  if (myResult.contract.includes("\u2663")) return "C" as const;
                  return "NT" as const;
                })();
                const contractLevel = parseInt((myResult.contract.match(/^(\d)/) || [])[1] || "0");
                if (contractLevel === 0) return null;
                const ddsTricks = ddsResult[decl]?.[trump];
                if (ddsTricks === undefined) return null;
                const ddsOver = ddsTricks - (contractLevel + 6);
                const ddsDisplay = ddsOver > 0 ? `+${ddsOver}` : ddsOver === 0 ? "=" : String(ddsOver);
                // Normalize result (handle old data where result = made level)
                const actualOver = myResult.result > 0 && myResult.result >= contractLevel
                  ? myResult.result - contractLevel : myResult.result;
                const diff = actualOver - ddsOver;
                if (Math.abs(diff) > 13) return null;
                const diffDisplay = diff > 0 ? `+${diff}` : diff === 0 ? "=" : String(diff);
                // Color based on play/defense perspective
                const declIsMyPair = isEW
                  ? (decl === "E" || decl === "W")
                  : (decl === "N" || decl === "S");
                const colorClass = diff === 0 ? "text-gray-400"
                  : declIsMyPair ? (diff > 0 ? "text-blue-600" : "text-red-600")
                  : (diff > 0 ? "text-red-600" : "text-blue-600");
                // Label based on perspective
                const perspectiveLabel = diff === 0 ? "DD通り"
                  : declIsMyPair
                    ? (diff > 0 ? "プレイ成功" : "プレイ失敗")
                    : (diff < 0 ? "ディフェンス成功" : "ディフェンス失敗");
                return (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">DD予測</div>
                    <div className="text-lg font-bold text-gray-500">{ddsDisplay}</div>
                    <div className={`text-xs font-bold ${colorClass}`}>
                      {perspectiveLabel} {diff !== 0 && `(${diffDisplay})`}
                    </div>
                  </div>
                );
              })()}
              <div className="text-right">
                {isDAT ? (
                  <>
                    <div className="text-sm text-gray-500">DAT</div>
                    {(() => {
                      const datVal = myResult.dat || 0;
                      const myDat = isEW ? -datVal : datVal;
                      return (
                        <div className={`text-2xl font-bold ${myDat > 0 ? "text-blue-600" : myDat < 0 ? "text-red-600" : "text-gray-700"}`}>
                          {myDat > 0 ? "+" : ""}{myDat}
                        </div>
                      );
                    })()}
                  </>
                ) : isIMP ? (
                  <>
                    <div className="text-sm text-gray-500">IMP/T</div>
                    {(() => {
                      const impVal = myResult.impPerTable || 0;
                      // IMP is from NS perspective, flip for EW
                      const myImp = isEW ? -impVal : impVal;
                      return (
                        <div className={`text-2xl font-bold ${myImp > 0 ? "text-blue-600" : myImp < 0 ? "text-red-600" : "text-gray-700"}`}>
                          {myImp > 0 ? "+" : ""}{myImp.toFixed(2)}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <div className="text-sm text-gray-500">MP%</div>
                    {(() => {
                      // MP% is NS perspective (calculated from scores)
                      const mp = isEW ? (100 - myResult.mp) : myResult.mp;
                      return (
                        <div
                          className={`text-2xl font-bold ${
                            mp >= 60
                              ? "text-blue-600"
                              : mp <= 40
                              ? "text-red-600"
                              : "text-gray-700"
                          }`}
                        >
                          {mp.toFixed(1)}%
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hand + DDS/BestLead side by side */}
        <div className="grid lg:grid-cols-2 gap-6">
          <HandDiagram
            hands={board.hands}
            dealer={board.dealer}
            vulnerability={board.vulnerability}
            boardNumber={board.boardNumber}
            myDirections={isEW ? ["E", "W"] : ["N", "S"]}
          />
          <div className="flex flex-col gap-3">
            <DDSTable ddsTable={ddsResult || board.ddsTable} progress={ddsProgress} />
            <BestLead hands={board.hands} contract={myResult?.contract} declarer={myResult?.declarer} />
          </div>
        </div>

        {/* Bidding + Comment below */}
        <div className="grid lg:grid-cols-2 gap-6">
          <BiddingBox
            dealer={board.dealer}
            initialBidding={board.bidding}
            onBiddingChange={saveBidding}
          />
          <CommentEditor
            initialComment={board.comment}
            onCommentChange={saveComment}
          />
        </div>

        {/* Play Analysis */}
        {myResult && myResult.contract && myResult.declarer && (
          <PlayAnalyzer
            hands={board.hands}
            declarer={myResult.declarer as "N" | "E" | "S" | "W"}
            trump={contractToTrump(myResult.contract)}
            contract={myResult.contract + " by " + myResult.declarer}
            myDirections={isEW ? ["E", "W"] : ["N", "S"]}
            bidding={board.bidding}
          />
        )}

        {/* Traveller Table */}
        <TravellerTable travellers={board.travellers} pairNumber={pairNumber} isEW={isEW} scoringType={tournament.scoringType} />

        {/* Bottom Navigation */}
        <div className="flex justify-between items-center pt-4 pb-2">
          {prevBoard ? (
            <Link
              href={`/tournaments/${tournamentId}/boards/${prevBoard}`}
              className="px-4 py-2 rounded-lg bg-[#1a5c2e] text-white text-sm font-medium hover:bg-[#174f27]"
            >
              &larr; Board {currentNum - 1}
            </Link>
          ) : (
            <div />
          )}
          <Link
            href={`/tournaments/${tournamentId}`}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
          >
            一覧に戻る
          </Link>
          {nextBoard ? (
            <Link
              href={`/tournaments/${tournamentId}/boards/${nextBoard}`}
              className="px-4 py-2 rounded-lg bg-[#1a5c2e] text-white text-sm font-medium hover:bg-[#174f27]"
            >
              Board {currentNum + 1} &rarr;
            </Link>
          ) : (
            <div />
          )}
        </div>
      </main>
    </div>
  );
}
