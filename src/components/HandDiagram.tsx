"use client";

import type { BoardHands } from "@/lib/bridge/types";

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  S: { symbol: "\u2660", color: "text-[#1e3a5f]" },
  H: { symbol: "\u2665", color: "text-[#c0392b]" },
  D: { symbol: "\u2666", color: "text-[#d4740e]" },
  C: { symbol: "\u2663", color: "text-[#1a7a3a]" },
};

function HandDisplay({ hand, label, compact, isMe }: { hand: { S: string[]; H: string[]; D: string[]; C: string[] }; label: string; compact?: boolean; isMe?: boolean }) {
  return (
    <div className="leading-snug">
      <div className={`font-bold mb-0.5 ${compact ? "text-[11px]" : "text-xs"} ${isMe ? "text-yellow-600" : "text-gray-400"}`}>
        {label}{isMe && !compact && " ★"}
      </div>
      {(["S", "H", "D", "C"] as const).map((suit) => (
        <div key={suit} className="flex items-center gap-0.5 whitespace-nowrap">
          <span className={`font-bold ${SUIT_SYMBOLS[suit].color} ${compact ? "text-sm" : "text-lg"}`}>
            {SUIT_SYMBOLS[suit].symbol}
          </span>
          <span className={`font-mono tracking-tighter ${compact ? "text-xs" : "text-base"}`}>
            {hand[suit].length > 0 ? hand[suit].join("") : "\u2014"}
          </span>
        </div>
      ))}
    </div>
  );
}

function isVulDirection(dir: string, vulnerability: string): boolean {
  if (vulnerability === "Both") return true;
  if (vulnerability === "None") return false;
  if (vulnerability === "NS") return dir === "N" || dir === "S";
  if (vulnerability === "EW") return dir === "E" || dir === "W";
  return false;
}

export default function HandDiagram({
  hands,
  dealer,
  vulnerability,
  boardNumber,
  compact,
  myDirections,
}: {
  hands: BoardHands;
  dealer: string;
  vulnerability: string;
  boardNumber?: number;
  compact?: boolean;
  myDirections?: string[];
}) {
  const vulDisplay = vulnerability === "None" ? "なし" :
    vulnerability === "NS" ? "N-S" :
    vulnerability === "EW" ? "E-W" : "Both";

  const isMyDir = (d: string) => myDirections?.includes(d) ?? false;

  const compassDir = (d: string) => {
    const vul = isVulDirection(d, vulnerability);
    const mine = isMyDir(d);
    return (
      <span className={`${vul ? "text-red-600" : "text-[#1a5c2e]"} ${mine ? "font-black" : ""}`}>
        {d}
      </span>
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${compact ? "p-3" : "p-5"}`}>
      <div className={`grid grid-cols-3 grid-rows-3 ${compact ? "gap-1" : "gap-2"} ${compact ? "max-w-xs" : "max-w-md"} mx-auto`}>
        {/* Board number + info (top-left) */}
        <div className="col-start-1 row-start-1 flex flex-col justify-center">
          {boardNumber && (
            <div className={`font-bold text-[#1a5c2e] ${compact ? "text-base mb-0.5" : "text-2xl mb-1"}`}>#{boardNumber}</div>
          )}
          <div className={`text-gray-500 leading-relaxed ${compact ? "text-[10px]" : "text-xs"}`}>
            <div>Dl: <strong>{dealer[0]}</strong></div>
            <div>Vul: <strong>{compact ? (vulDisplay === "なし" ? "-" : vulDisplay) : vulDisplay}</strong></div>
          </div>
        </div>
        {/* North */}
        <div className="col-start-2 row-start-1 flex justify-center">
          <HandDisplay hand={hands.N} label="N" compact={compact} isMe={isMyDir("N")} />
        </div>
        {/* West */}
        <div className="col-start-1 row-start-2 flex items-center">
          <HandDisplay hand={hands.W} label="W" compact={compact} isMe={isMyDir("W")} />
        </div>
        {/* Center compass */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <div className={`border-2 border-[#1a5c2e] rounded-lg flex items-center justify-center bg-[#f0f7f2] ${compact ? "w-10 h-10" : "w-18 h-18"}`}>
            <div className={`text-center leading-tight font-bold ${compact ? "text-[8px] px-1 py-0.5" : "text-xs px-3 py-2"}`}>
              <div>{compassDir("N")}</div>
              <div>{compassDir("W")}&nbsp;{compassDir("E")}</div>
              <div>{compassDir("S")}</div>
            </div>
          </div>
        </div>
        {/* East */}
        <div className="col-start-3 row-start-2 flex items-center justify-end">
          <HandDisplay hand={hands.E} label="E" compact={compact} isMe={isMyDir("E")} />
        </div>
        {/* South */}
        <div className="col-start-2 row-start-3 flex justify-center">
          <HandDisplay hand={hands.S} label="S" compact={compact} isMe={isMyDir("S")} />
        </div>
      </div>
    </div>
  );
}
