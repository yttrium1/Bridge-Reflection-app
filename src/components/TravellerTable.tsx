"use client";

import type { TravellerRow, ScoringType } from "@/lib/bridge/types";

export default function TravellerTable({
  travellers,
  pairNumber,
  isEW,
  scoringType,
}: {
  travellers: TravellerRow[];
  pairNumber?: number;
  isEW?: boolean;
  scoringType?: ScoringType;
}) {
  const isDat = scoringType === "DAT";
  const isIMP = scoringType === "IMP";

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
            {isDat && <th className="px-2 py-2 text-center">OL</th>}
            <th className="px-2 py-2 text-right">{isDat ? "PLUS" : "N-S"}</th>
            <th className="px-2 py-2 text-right">{isDat ? "MINUS" : "E-W"}</th>
            <th className="px-2 py-2 text-right">
              {isDat ? "DAT" : isIMP ? "IMP" : "MP%"}
            </th>
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

            // Score column display
            let scoreDisplay: string;
            if (isDat) {
              const dat = row.dat || 0;
              const myDat = isEW ? -dat : dat;
              scoreDisplay = myDat > 0 ? `+${myDat}` : myDat === 0 ? "0" : String(myDat);
            } else if (isIMP) {
              const impVal = row.impPerTable || row.imp || 0;
              const myImp = isEW ? -impVal : impVal;
              scoreDisplay = myImp > 0 ? `+${myImp.toFixed(1)}` : myImp === 0 ? "0" : myImp.toFixed(1);
            } else {
              const displayMp = isEW ? (100 - row.mp) : row.mp;
              scoreDisplay = displayMp.toFixed(1);
            }

            // PLUS/MINUS for DAT format
            const plusScore = row.nsScore > 0 ? row.nsScore : 0;
            const minusScore = row.nsScore < 0 ? Math.abs(row.nsScore) : (row.ewScore > 0 ? row.ewScore : 0);

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
                <td className="px-2 py-1.5 text-center">{row.nsId || row.ns}</td>
                <td className="px-2 py-1.5 text-center">{row.ewId || row.ew}</td>
                <td className="px-2 py-1.5">{row.contract}</td>
                <td className="px-2 py-1.5 text-center">{row.declarer}</td>
                <td
                  className={`px-2 py-1.5 text-center ${
                    row.result < 0 ? "text-red-600" : row.result > 0 ? "text-blue-600" : ""
                  }`}
                >
                  {resultDisplay}
                </td>
                {isDat && (
                  <td className="px-2 py-1.5 text-center text-xs">{row.openingLead || ""}</td>
                )}
                <td className="px-2 py-1.5 text-right">
                  {isDat
                    ? (plusScore > 0 ? plusScore : "")
                    : (row.nsScore !== 0 ? row.nsScore : "")}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {isDat
                    ? (minusScore > 0 ? minusScore : "")
                    : (row.ewScore !== 0 ? row.ewScore : "")}
                </td>
                <td className={`px-2 py-1.5 text-right ${
                  isDat
                    ? ((row.dat || 0) > 0 ? "text-blue-600" : (row.dat || 0) < 0 ? "text-red-600" : "")
                    : ""
                }`}>
                  {scoreDisplay}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
