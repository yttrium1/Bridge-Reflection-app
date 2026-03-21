"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collectionGroup, query, where, getDocs, collection, doc, getDoc } from "firebase/firestore";
import type { TournamentData, BoardData } from "@/lib/bridge/types";
import HandDiagram from "@/components/HandDiagram";
import TravellerTable from "@/components/TravellerTable";
import DDSTable from "@/components/DDSTable";
import BestLead from "@/components/BestLead";
import { useDDS } from "@/hooks/useDDS";

export default function SharedBoardPage() {
  const params = useParams();
  const token = params.token as string;
  const boardNum = params.num as string;

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);

  const ddsResult = useDDS(board?.hands || null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(
          collectionGroup(db, "tournaments"),
          where("shareToken", "==", token)
        );
        const snap = await getDocs(q);
        if (snap.empty) { setLoading(false); return; }

        const tDoc = snap.docs[0];
        const tData = { id: tDoc.id, ...tDoc.data() } as TournamentData;
        setTournament(tData);

        const uid = tDoc.ref.parent.parent?.id || "";
        const bDoc = await getDoc(
          doc(db, "users", uid, "tournaments", tDoc.id, "boards", boardNum)
        );
        if (bDoc.exists()) {
          setBoard(bDoc.data() as BoardData);
        }
      } catch (err) {
        console.error("Failed to load shared board:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, boardNum]);

  if (loading) {
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

  const prevBoard = parseInt(boardNum) > 1 ? parseInt(boardNum) - 1 : null;
  const nextBoard = parseInt(boardNum) < tournament.totalBoards ? parseInt(boardNum) + 1 : null;

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      <header className="bg-[#1a5c2e] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/shared/${token}`} className="hover:text-green-200">&larr;</Link>
            <div>
              <h1 className="text-lg font-bold">Board {boardNum}</h1>
              <p className="text-xs text-green-200">
                {tournament.name}
                <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">共有</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {prevBoard && (
              <Link href={`/shared/${token}/boards/${prevBoard}`} className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
                &larr; B{prevBoard}
              </Link>
            )}
            {nextBoard && (
              <Link href={`/shared/${token}/boards/${nextBoard}`} className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
                B{nextBoard} &rarr;
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
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
                  <span className={myResult.result < 0 ? "text-red-600" : myResult.result > 0 ? "text-blue-600" : ""}>
                    {myResult.result > 0 ? `+${myResult.result}` : myResult.result === 0 ? "=" : myResult.result}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">MP%</div>
                {(() => {
                  const mp = isEW ? (100 - myResult.mp) : myResult.mp;
                  return (
                    <div className={`text-2xl font-bold ${mp >= 60 ? "text-blue-600" : mp <= 40 ? "text-red-600" : "text-gray-700"}`}>
                      {mp.toFixed(1)}%
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

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

        {board.comment && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-600 mb-2">コメント</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{board.comment}</p>
          </div>
        )}

        <TravellerTable travellers={board.travellers} pairNumber={pairNumber} isEW={isEW} />
      </main>
    </div>
  );
}
