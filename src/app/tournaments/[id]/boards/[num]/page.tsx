"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { TournamentData, BoardData } from "@/lib/bridge/types";
import HandDiagram from "@/components/HandDiagram";
import TravellerTable from "@/components/TravellerTable";
import DDSTable from "@/components/DDSTable";
import BiddingBox, { type BiddingEntry } from "@/components/BiddingBox";
import CommentEditor from "@/components/CommentEditor";
import { useDDS } from "@/hooks/useDDS";
import BestLead from "@/components/BestLead";

export default function BoardDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const boardNum = params.num as string;

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
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
          setBoard(bDoc.data() as BoardData);
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
      try {
        await updateDoc(
          doc(
            db,
            "users",
            user.uid,
            "tournaments",
            tournamentId,
            "boards",
            boardNum
          ),
          { bidding }
        );
      } catch (err) {
        console.error("Failed to save bidding:", err);
      }
    },
    [user, tournamentId, boardNum]
  );

  const saveComment = useCallback(
    async (comment: string) => {
      if (!user) return;
      try {
        await updateDoc(
          doc(
            db,
            "users",
            user.uid,
            "tournaments",
            tournamentId,
            "boards",
            boardNum
          ),
          { comment }
        );
      } catch (err) {
        console.error("Failed to save comment:", err);
      }
    },
    [user, tournamentId, boardNum]
  );

  const ddsResult = useDDS(board?.hands || null);

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f1]">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!board || !tournament) return null;

  const pairNumber = tournament.pairNumber;
  const myResult = board.travellers.find(
    (t) => t.ns === pairNumber || t.ew === pairNumber
  );
  const isEW = myResult ? myResult.ew === pairNumber : false;

  // Navigation
  const prevBoard = parseInt(boardNum) > 1 ? parseInt(boardNum) - 1 : null;
  const nextBoard =
    parseInt(boardNum) < tournament.totalBoards
      ? parseInt(boardNum) + 1
      : null;

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      <header className="bg-[#1a5c2e] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/tournaments/${tournamentId}`}
              className="hover:text-green-200"
            >
              &larr;
            </Link>
            <div>
              <h1 className="text-lg font-bold">Board {boardNum}</h1>
              <p className="text-xs text-green-200">{tournament.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {prevBoard && (
              <Link
                href={`/tournaments/${tournamentId}/boards/${prevBoard}`}
                className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
              >
                &larr; Board {prevBoard}
              </Link>
            )}
            {nextBoard && (
              <Link
                href={`/tournaments/${tournamentId}/boards/${nextBoard}`}
                className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
              >
                Board {nextBoard} &rarr;
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
                <span className="text-sm text-gray-600">
                  {myResult.ns === pairNumber
                    ? `NS ${myResult.ns} vs EW ${myResult.ew}`
                    : `EW ${myResult.ew} vs NS ${myResult.ns}`}
                </span>
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
                return (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">DD</div>
                    <div className="text-lg font-bold text-gray-500">{ddsDisplay}</div>
                    <div className={`text-xs ${colorClass}`}>
                      vs実際: {diffDisplay}
                    </div>
                  </div>
                );
              })()}
              <div className="text-right">
                <div className="text-sm text-gray-500">MP%</div>
                {(() => {
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
          />
          <div className="flex flex-col gap-3">
            <DDSTable ddsTable={ddsResult || board.ddsTable} />
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

        {/* Traveller Table */}
        <TravellerTable travellers={board.travellers} pairNumber={pairNumber} isEW={isEW} />
      </main>
    </div>
  );
}
