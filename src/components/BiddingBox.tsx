"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { BidEntry, Direction } from "@/lib/bridge/types";

const SUITS = [
  { key: "C", symbol: "\u2663", color: "bg-white border border-gray-200 hover:bg-gray-50", text: "text-[#1a7a3a]" },
  { key: "D", symbol: "\u2666", color: "bg-white border border-gray-200 hover:bg-gray-50", text: "text-[#d4740e]" },
  { key: "H", symbol: "\u2665", color: "bg-white border border-gray-200 hover:bg-gray-50", text: "text-[#c0392b]" },
  { key: "S", symbol: "\u2660", color: "bg-white border border-gray-200 hover:bg-gray-50", text: "text-[#1e3a5f]" },
  { key: "NT", symbol: "NT", color: "bg-white border border-gray-200 hover:bg-gray-50", text: "text-gray-700" },
];

const LEVELS = [1, 2, 3, 4, 5, 6, 7];
const DIRECTIONS_ORDER: Direction[] = ["W", "N", "E", "S"];

function getBidRank(bid: string): number {
  if (bid === "P" || bid === "X" || bid === "XX") return -1;
  const level = parseInt(bid[0]);
  const suitOrder = ["C", "D", "H", "S", "NT"];
  const suit = bid.substring(1);
  const suitIdx = suitOrder.indexOf(suit);
  return level * 10 + suitIdx;
}

export interface BiddingEntry extends BidEntry {
  comment?: string;
}

export default function BiddingBox({
  dealer,
  initialBidding,
  onBiddingChange,
}: {
  dealer: string;
  initialBidding: BiddingEntry[] | null;
  onBiddingChange: (bidding: BiddingEntry[]) => void;
}) {
  const [bidding, setBidding] = useState<BiddingEntry[]>(initialBidding || []);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const commentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIdx !== null && commentRef.current) {
      commentRef.current.focus();
    }
  }, [editingIdx]);

  const dealerDir = (dealer[0] as Direction) || "N";
  const dealerIdx = DIRECTIONS_ORDER.indexOf(dealerDir);

  const getCurrentSeat = useCallback((): Direction => {
    const offset = (dealerIdx + bidding.length) % 4;
    return DIRECTIONS_ORDER[offset];
  }, [bidding.length, dealerIdx]);

  const getLastRealBid = useCallback((): string | null => {
    for (let i = bidding.length - 1; i >= 0; i--) {
      if (bidding[i].bid !== "P" && bidding[i].bid !== "X" && bidding[i].bid !== "XX") {
        return bidding[i].bid;
      }
    }
    return null;
  }, [bidding]);

  const canDouble = useCallback((): boolean => {
    if (bidding.length === 0) return false;
    const lastNonPass = [...bidding].reverse().find((b) => b.bid !== "P");
    if (!lastNonPass) return false;
    if (lastNonPass.bid === "X" || lastNonPass.bid === "XX") return false;
    const currentSeat = getCurrentSeat();
    const isOpponent =
      (DIRECTIONS_ORDER.indexOf(lastNonPass.seat) % 2) !==
      (DIRECTIONS_ORDER.indexOf(currentSeat) % 2);
    return isOpponent && lastNonPass.bid !== "P";
  }, [bidding, getCurrentSeat]);

  const canRedouble = useCallback((): boolean => {
    if (bidding.length === 0) return false;
    const lastNonPass = [...bidding].reverse().find((b) => b.bid !== "P");
    if (!lastNonPass || lastNonPass.bid !== "X") return false;
    const currentSeat = getCurrentSeat();
    const isOpponent =
      (DIRECTIONS_ORDER.indexOf(lastNonPass.seat) % 2) !==
      (DIRECTIONS_ORDER.indexOf(currentSeat) % 2);
    return isOpponent;
  }, [bidding, getCurrentSeat]);

  const isBidValid = useCallback(
    (level: number, suit: string): boolean => {
      const lastReal = getLastRealBid();
      if (!lastReal) return true;
      const newRank = getBidRank(`${level}${suit}`);
      const lastRank = getBidRank(lastReal);
      return newRank > lastRank;
    },
    [getLastRealBid]
  );

  const addBid = (bid: string) => {
    const seat = getCurrentSeat();
    const newBidding = [...bidding, { seat, bid }];
    setBidding(newBidding);
    onBiddingChange(newBidding);
  };

  const undoLastBid = () => {
    if (bidding.length === 0) return;
    const newBidding = bidding.slice(0, -1);
    setBidding(newBidding);
    onBiddingChange(newBidding);
    setEditingIdx(null);
  };

  const saveComment = (idx: number) => {
    const newBidding = [...bidding];
    newBidding[idx] = { ...newBidding[idx], comment: commentInput || undefined };
    setBidding(newBidding);
    onBiddingChange(newBidding);
    setEditingIdx(null);
    setCommentInput("");
  };

  const startEditing = (idx: number) => {
    setEditingIdx(idx);
    setCommentInput(bidding[idx].comment || "");
  };

  const isComplete = (() => {
    if (bidding.length < 4) return false;
    const lastThree = bidding.slice(-3);
    const hasRealBid = bidding.some((b) => b.bid !== "P");
    return hasRealBid && lastThree.every((b) => b.bid === "P");
  })();

  // Build history rows with original indices
  const renderHistory = () => {
    const rows: ({ entry: BiddingEntry | null; idx: number | null })[][] = [];
    const firstRow: ({ entry: BiddingEntry | null; idx: number | null })[] = [];
    for (let i = 0; i < dealerIdx; i++) firstRow.push({ entry: null, idx: null });

    let currentRow = firstRow;
    bidding.forEach((entry, idx) => {
      currentRow.push({ entry, idx });
      if (currentRow.length === 4) {
        rows.push(currentRow);
        currentRow = [];
      }
    });
    if (currentRow.length > 0) rows.push(currentRow);
    return rows;
  };

  const formatBid = (bid: string): React.ReactElement => {
    if (bid === "P") return <span className="text-gray-400">Pass</span>;
    if (bid === "X") return <span className="text-red-600 font-bold">X</span>;
    if (bid === "XX") return <span className="text-blue-600 font-bold">XX</span>;

    const level = bid[0];
    const suit = bid.substring(1);
    const suitInfo = SUITS.find((s) => s.key === suit);
    if (!suitInfo) return <span>{bid}</span>;

    const suitColor =
      suit === "C" ? "text-[#1a7a3a]" :
      suit === "D" ? "text-[#d4740e]" :
      suit === "H" ? "text-[#c0392b]" :
      suit === "S" ? "text-[#1e3a5f]" :
      "text-gray-800";

    return (
      <span>
        {level}
        <span className={`font-bold ${suitColor}`}>{suitInfo.symbol}</span>
      </span>
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingIdx !== null) return; // Don't capture keys when editing comment
    if (isComplete) return;
    const key = e.key.toUpperCase();
    if (key === "P") { addBid("P"); e.preventDefault(); }
    else if (key === "X" && canDouble()) { addBid("X"); e.preventDefault(); }
    else if (key === "Z" && e.ctrlKey && bidding.length > 0) { undoLastBid(); e.preventDefault(); }
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-600">Bidding</h3>
        <button
          onClick={undoLastBid}
          disabled={bidding.length === 0}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Undo
        </button>
      </div>

      {/* Bidding History */}
      <div className="mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {DIRECTIONS_ORDER.map((d) => (
                <th
                  key={d}
                  className={`px-2 py-1 text-center w-1/4 ${
                    d === dealerDir ? "text-[#1a5c2e] font-bold" : "text-gray-500"
                  }`}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderHistory().map((row, i) => (
              <tr key={i} className="border-t border-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1 text-center relative">
                    {cell.entry && cell.idx !== null ? (
                      <span
                        className={`cursor-pointer inline-block ${
                          cell.entry.comment ? "border-b-2 border-dashed border-[#c8a84e]" : ""
                        } group relative`}
                        onClick={() => startEditing(cell.idx!)}
                      >
                        {formatBid(cell.entry.bid)}
                        {cell.entry.comment && (
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {cell.entry.comment}
                          </span>
                        )}
                      </span>
                    ) : ""}
                  </td>
                ))}
                {Array.from({ length: 4 - row.length }).map((_, j) => (
                  <td key={`pad-${j}`} className="px-2 py-1"></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comment input for selected bid */}
      {editingIdx !== null && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">
            {formatBid(bidding[editingIdx].bid)} のコメント:
          </div>
          <div className="flex gap-1">
            <input
              ref={commentRef}
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveComment(editingIdx);
                if (e.key === "Escape") { setEditingIdx(null); setCommentInput(""); }
              }}
              placeholder="コメントを入力..."
              className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#1a5c2e]"
            />
            <button
              onClick={() => saveComment(editingIdx)}
              className="text-xs px-2 py-1 bg-[#1a5c2e] text-white rounded hover:bg-[#2d8a4e]"
            >
              OK
            </button>
            <button
              onClick={() => { setEditingIdx(null); setCommentInput(""); }}
              className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              &#x2715;
            </button>
          </div>
        </div>
      )}

      {/* Bidding Input Grid */}
      {!isComplete && (
        <div>
          <div className="text-xs text-gray-500 mb-2">
            {getCurrentSeat()} のビッド:
          </div>
          <div className="grid grid-cols-5 gap-1 mb-2">
            {LEVELS.map((level) =>
              SUITS.map((suit) => {
                const valid = isBidValid(level, suit.key);
                return (
                  <button
                    key={`${level}${suit.key}`}
                    onClick={() => addBid(`${level}${suit.key}`)}
                    disabled={!valid}
                    className={`text-xs px-1 py-1.5 rounded font-bold transition-colors ${
                      valid
                        ? `${suit.color} ${suit.text} cursor-pointer`
                        : "bg-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    {level}{suit.symbol}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => addBid("P")}
              className="flex-1 text-xs py-1.5 rounded bg-gray-200 hover:bg-gray-300 font-bold text-gray-600"
            >
              Pass
            </button>
            <button
              onClick={() => addBid("X")}
              disabled={!canDouble()}
              className="flex-1 text-xs py-1.5 rounded bg-red-100 hover:bg-red-200 font-bold text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              X
            </button>
            <button
              onClick={() => addBid("XX")}
              disabled={!canRedouble()}
              className="flex-1 text-xs py-1.5 rounded bg-blue-100 hover:bg-blue-200 font-bold text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              XX
            </button>
          </div>
          <div className="text-[10px] text-gray-400 mt-2">
            キーボード: P=Pass, X=Double, Ctrl+Z=Undo
          </div>
        </div>
      )}
    </div>
  );
}
