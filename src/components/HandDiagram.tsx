"use client";

import type { BoardHands } from "@/lib/bridge/types";

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  S: { symbol: "\u2660", color: "text-[#1e3a5f]" },
  H: { symbol: "\u2665", color: "text-[#c0392b]" },
  D: { symbol: "\u2666", color: "text-[#d4740e]" },
  C: { symbol: "\u2663", color: "text-[#1a7a3a]" },
};

function HandDisplay({ hand, label }: { hand: { S: string[]; H: string[]; D: string[]; C: string[] }; label: string }) {
  return (
    <div className="leading-snug">
      <div className="font-bold text-xs text-gray-400 mb-0.5">{label}</div>
      {(["S", "H", "D", "C"] as const).map((suit) => (
        <div key={suit} className="flex items-center gap-1 whitespace-nowrap">
          <span className={`text-lg font-bold ${SUIT_SYMBOLS[suit].color}`}>
            {SUIT_SYMBOLS[suit].symbol}
          </span>
          <span className="font-mono text-base tracking-tight">
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
}: {
  hands: BoardHands;
  dealer: string;
  vulnerability: string;
  boardNumber?: number;
}) {
  const vulDisplay = vulnerability === "None" ? "なし" :
    vulnerability === "NS" ? "N-S" :
    vulnerability === "EW" ? "E-W" : "Both";

  const compassDir = (d: string) => {
    const vul = isVulDirection(d, vulnerability);
    return <span className={vul ? "text-red-600" : "text-[#1a5c2e]"}>{d}</span>;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="grid grid-cols-3 grid-rows-3 gap-2 max-w-md mx-auto">
        {/* Board number + info (top-left) */}
        <div className="col-start-1 row-start-1 flex flex-col justify-center">
          {boardNumber && (
            <div className="text-2xl font-bold text-[#1a5c2e] mb-1">#{boardNumber}</div>
          )}
          <div className="text-xs text-gray-500 leading-relaxed">
            <div>Dealer: <strong>{dealer}</strong></div>
            <div>Vul: <strong>{vulDisplay}</strong></div>
          </div>
        </div>
        {/* North */}
        <div className="col-start-2 row-start-1 flex justify-center">
          <HandDisplay hand={hands.N} label="North" />
        </div>
        {/* West */}
        <div className="col-start-1 row-start-2 flex items-center">
          <HandDisplay hand={hands.W} label="West" />
        </div>
        {/* Center compass */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <div className="w-18 h-18 border-2 border-[#1a5c2e] rounded-lg flex items-center justify-center bg-[#f0f7f2]">
            <div className="text-xs text-center leading-tight font-bold px-3 py-2">
              <div>{compassDir("N")}</div>
              <div>{compassDir("W")}&nbsp;&nbsp;{compassDir("E")}</div>
              <div>{compassDir("S")}</div>
            </div>
          </div>
        </div>
        {/* East */}
        <div className="col-start-3 row-start-2 flex items-center justify-end">
          <HandDisplay hand={hands.E} label="East" />
        </div>
        {/* South */}
        <div className="col-start-2 row-start-3 flex justify-center">
          <HandDisplay hand={hands.S} label="South" />
        </div>
      </div>
    </div>
  );
}
