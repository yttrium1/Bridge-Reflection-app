"use client";

import Link from "next/link";
import type { BoardData, TournamentData } from "@/lib/bridge/types";

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  S: { symbol: "\u2660", color: "text-[#1e3a5f]" },
  H: { symbol: "\u2665", color: "text-[#c0392b]" },
  D: { symbol: "\u2666", color: "text-[#d4740e]" },
  C: { symbol: "\u2663", color: "text-[#1a7a3a]" },
};

function getTrump(contract: string): "C" | "D" | "H" | "S" | "NT" {
  if (contract.includes("\u2660")) return "S";
  if (contract.includes("\u2665")) return "H";
  if (contract.includes("\u2666")) return "D";
  if (contract.includes("\u2663")) return "C";
  return "NT";
}

interface AnalysisRow {
  boardNumber: number;
  boardDocId: string;
  contract: string;
  declarer: string;
  result: number;
  ddTricks: number;
  ddDiff: number;
  role: "Play" | "Defense";
  sessionNumber?: string;
}

export default function WeaknessAnalysis({
  boards,
  tournament,
  tournamentId,
  boardLinkPrefix,
}: {
  boards: (BoardData & { _docId?: string })[];
  tournament: TournamentData;
  tournamentId: string;
  boardLinkPrefix?: string;
}) {
  const linkBase = boardLinkPrefix || `/tournaments/${tournamentId}/boards`;
  const pairNumber = tournament.pairNumber;
  const isIMP = tournament.scoringType === "IMP";
  const pairId = (tournament as TournamentData & { pairId?: string }).pairId;

  const analysis: AnalysisRow[] = [];

  for (const board of boards) {
    if (!board.ddsTable) continue;

    const myResult = isIMP && pairId
      ? board.travellers.find((t) => t.nsId === pairId || t.ewId === pairId)
      : board.travellers.find((t) => t.ns === pairNumber || t.ew === pairNumber);
    if (!myResult || !myResult.contract) continue;

    const isEW = isIMP && pairId
      ? myResult.ewId === pairId
      : myResult.ew === pairNumber;

    const trump = getTrump(myResult.contract);
    const decl = myResult.declarer;
    if (!decl || !["N", "E", "S", "W"].includes(decl)) continue;

    const ddTricks = board.ddsTable[decl as keyof typeof board.ddsTable]?.[trump];
    if (ddTricks === undefined) continue;

    const contractLevel = parseInt(myResult.contract.replace(/[^0-9]/g, "")) || 0;
    const requiredTricks = contractLevel + 6;
    const actualTricks = requiredTricks + myResult.result;
    const ddDiff = actualTricks - ddTricks;

    const isDeclarerSide =
      (["N", "S"].includes(decl) && !isEW) ||
      (["E", "W"].includes(decl) && isEW);

    analysis.push({
      boardNumber: board.boardNumber,
      boardDocId: (board as BoardData & { _docId?: string })._docId || String(board.boardNumber),
      contract: myResult.contract,
      declarer: decl,
      result: myResult.result,
      ddTricks,
      ddDiff,
      role: isDeclarerSide ? "Play" : "Defense",
      sessionNumber: (board as BoardData & { sessionNumber?: string }).sessionNumber,
    });
  }

  if (analysis.length === 0) return null;

  // Stats
  const playBoards = analysis.filter(a => a.role === "Play");
  const defenseBoards = analysis.filter(a => a.role === "Defense");

  const avgDiff = (arr: AnalysisRow[]) =>
    arr.length > 0 ? arr.reduce((s, a) => s + a.ddDiff, 0) / arr.length : 0;

  const playAvg = avgDiff(playBoards);
  const defenseAvg = avgDiff(defenseBoards);

  // Worst boards: Play未達 or Defense超え（相手にやられた）
  const worstBoards = [...analysis]
    .filter(a => (a.role === "Play" && a.ddDiff <= -1) || (a.role === "Defense" && a.ddDiff >= 1))
    .sort((a, b) => {
      const aScore = a.role === "Play" ? a.ddDiff : -a.ddDiff;
      const bScore = b.role === "Play" ? b.ddDiff : -b.ddDiff;
      return aScore - bScore;
    })
    .slice(0, 8);

  // Best boards: Play超え or Defense未達（うまくいった）
  const bestBoards = [...analysis]
    .filter(a => (a.role === "Play" && a.ddDiff >= 1) || (a.role === "Defense" && a.ddDiff <= -1))
    .sort((a, b) => {
      const aScore = a.role === "Play" ? a.ddDiff : -a.ddDiff;
      const bScore = b.role === "Play" ? b.ddDiff : -b.ddDiff;
      return bScore - aScore;
    })
    .slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
      <h3 className="text-sm font-bold text-gray-700 mb-4">弱点分析</h3>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400">分析済み</div>
          <div className="text-lg font-bold text-gray-700">{analysis.length}ボード</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400">Play平均</div>
          <div className={`text-lg font-bold ${playAvg >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {playAvg >= 0 ? "+" : ""}{playAvg.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-400">{playBoards.length}ボード</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400">Defense平均</div>
          <div className={`text-lg font-bold ${defenseAvg >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {defenseAvg >= 0 ? "+" : ""}{defenseAvg.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-400">{defenseBoards.length}ボード</div>
        </div>
      </div>

      {/* Worst boards */}
      {worstBoards.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-red-600 mb-2">反省ボード</div>
          <div className="space-y-1">
            {worstBoards.map((b) => (
              <Link
                key={b.boardDocId}
                href={`${linkBase}/${b.boardDocId}`}
                className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-red-50 transition"
              >
                <span className="font-bold text-gray-700 w-8">#{b.boardNumber}</span>
                <span className="text-gray-500 w-16">
                  {b.contract.replace(/[♠♥♦♣]/g, (m) => {
                    const s = m === "\u2660" ? "S" : m === "\u2665" ? "H" : m === "\u2666" ? "D" : "C";
                    return SUIT_SYMBOLS[s]?.symbol || m;
                  })} {b.declarer}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${b.role === "Play" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                  {b.role}
                </span>
                <span className="text-red-600 font-bold ml-auto">
                  {b.role === "Play" ? `DD${b.ddDiff}` : `DD+${b.ddDiff}`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Best boards */}
      {bestBoards.length > 0 && (
        <div>
          <div className="text-xs font-bold text-blue-600 mb-2">好プレイボード</div>
          <div className="space-y-1">
            {bestBoards.map((b) => (
              <Link
                key={b.boardDocId}
                href={`${linkBase}/${b.boardDocId}`}
                className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-blue-50 transition"
              >
                <span className="font-bold text-gray-700 w-8">#{b.boardNumber}</span>
                <span className="text-gray-500 w-16">
                  {b.contract} {b.declarer}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${b.role === "Play" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                  {b.role}
                </span>
                <span className="text-blue-600 font-bold ml-auto">
                  {b.role === "Play" ? `DD+${b.ddDiff}` : `DD${b.ddDiff}`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
