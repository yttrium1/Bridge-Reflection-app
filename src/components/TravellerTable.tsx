"use client";

import type { TravellerRow } from "@/lib/bridge/types";

export default function TravellerTable({
  travellers,
  pairNumber,
  isEW,
}: {
  travellers: TravellerRow[];
  pairNumber?: number;
  isEW?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden inline-block">
      <table className="text-sm">
        <thead>
          <tr className="bg-[#1a5c2e] text-white">
            <th className="px-2 py-2 text-center">NS</th>
            <th className="px-2 py-2 text-center">EW</th>
            <th className="px-2 py-2 text-left">Contract</th>
            <th className="px-2 py-2 text-center">By</th>
            <th className="px-2 py-2 text-center">M/D</th>
            <th className="px-2 py-2 text-right">N-S</th>
            <th className="px-2 py-2 text-right">E-W</th>
            <th className="px-2 py-2 text-right">MP%</th>
          </tr>
        </thead>
        <tbody>
          {travellers.map((row, i) => {
            const isMyPair =
              pairNumber !== undefined &&
              (row.ns === pairNumber || row.ew === pairNumber);
            const resultDisplay =
              row.result > 0
                ? `+${row.result}`
                : row.result === 0
                ? "="
                : String(row.result);

            // MP% is stored as NS perspective; invert for EW
            const displayMp = isEW ? (100 - row.mp) : row.mp;

            return (
              <tr
                key={i}
                className={`border-t border-gray-100 ${
                  isMyPair
                    ? "bg-yellow-50 font-bold border-l-4 border-l-[#c8a84e]"
                    : i % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50"
                }`}
              >
                <td className="px-2 py-1.5 text-center">{row.ns}</td>
                <td className="px-2 py-1.5 text-center">{row.ew}</td>
                <td className="px-2 py-1.5">{row.contract}</td>
                <td className="px-2 py-1.5 text-center">{row.declarer}</td>
                <td
                  className={`px-2 py-1.5 text-center ${
                    row.result < 0 ? "text-red-600" : row.result > 0 ? "text-blue-600" : ""
                  }`}
                >
                  {resultDisplay}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {row.nsScore !== 0 ? row.nsScore : ""}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {row.ewScore !== 0 ? row.ewScore : ""}
                </td>
                <td className="px-2 py-1.5 text-right">{displayMp.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
