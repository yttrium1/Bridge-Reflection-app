"use client";

import type { DDSTable as DDSTableType } from "@/lib/bridge/types";

const SUIT_DISPLAY = [
  { key: "C" as const, symbol: "\u2663", color: "text-[#1a7a3a]" },
  { key: "D" as const, symbol: "\u2666", color: "text-[#d4740e]" },
  { key: "H" as const, symbol: "\u2665", color: "text-[#c0392b]" },
  { key: "S" as const, symbol: "\u2660", color: "text-[#1e3a5f]" },
  { key: "NT" as const, symbol: "NT", color: "text-gray-800" },
];

const DIRECTIONS = ["N", "S", "E", "W"] as const;

export default function DDSTable({ ddsTable }: { ddsTable: DDSTableType | null }) {
  if (!ddsTable) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-600 mb-2">Double Dummy Analysis</h3>
        <div className="text-xs text-gray-400 text-center py-4">
          計算中...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-600 mb-2">Double Dummy Analysis</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#1a5c2e]">
            <th className="px-2 py-1"></th>
            {SUIT_DISPLAY.map((s) => (
              <th key={s.key} className={`px-2 py-1 text-center font-bold ${s.color}`}>
                {s.symbol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIRECTIONS.map((dir) => (
            <tr key={dir} className="border-t border-gray-100">
              <td className="px-2 py-1 font-bold text-[#1a5c2e]">{dir}</td>
              {SUIT_DISPLAY.map((s) => {
                const tricks = ddsTable[dir][s.key];
                return (
                  <td
                    key={s.key}
                    className={`px-2 py-1 text-center font-mono ${
                      tricks >= 7 ? "text-blue-700 font-bold" : "text-gray-600"
                    }`}
                  >
                    {tricks}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
