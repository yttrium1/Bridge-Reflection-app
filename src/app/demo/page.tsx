"use client";

import { useCallback } from "react";
import HandDiagram from "@/components/HandDiagram";
import TravellerTable from "@/components/TravellerTable";
import DDSTable from "@/components/DDSTable";
import BiddingBox, { type BiddingEntry } from "@/components/BiddingBox";
import CommentEditor from "@/components/CommentEditor";
import { useDDS } from "@/hooks/useDDS";
import BestLead from "@/components/BestLead";
import type { BoardHands, TravellerRow } from "@/lib/bridge/types";

const MOCK_HANDS: BoardHands = {
  N: { S: ["9", "8", "3", "2"], H: ["A", "9"], D: ["K", "J"], C: ["A", "Q", "J", "8", "2"] },
  E: { S: ["A", "10", "7"], H: ["Q", "J", "10", "7", "6", "5", "2"], D: ["A", "5"], C: ["3"] },
  S: { S: ["K", "Q", "J", "6", "5"], H: ["K", "4"], D: ["8", "7", "6", "3", "2"], C: ["K"] },
  W: { S: ["4"], H: ["8", "3"], D: ["Q", "10", "9", "4"], C: ["10", "9", "7", "6", "5", "4"] },
};

const MOCK_TRAVELLERS: TravellerRow[] = [
  { ns: 22, ew: 10, contract: "3NT", declarer: "S", result: 1, nsScore: 430, ewScore: 0, mp: 95.45 },
  { ns: 3, ew: 15, contract: "3NT", declarer: "N", result: 1, nsScore: 430, ewScore: 0, mp: 95.45 },
  { ns: 24, ew: 12, contract: "4\u2660", declarer: "S", result: 0, nsScore: 420, ewScore: 0, mp: 59.09 },
  { ns: 7, ew: 19, contract: "4\u2660", declarer: "S", result: 0, nsScore: 420, ewScore: 0, mp: 59.09 },
  { ns: 9, ew: 21, contract: "4\u2660", declarer: "S", result: 0, nsScore: 420, ewScore: 0, mp: 59.09 },
  { ns: 20, ew: 8, contract: "3NT", declarer: "S", result: 0, nsScore: 400, ewScore: 0, mp: 27.27 },
  { ns: 11, ew: 23, contract: "4\u2660", declarer: "S", result: -1, nsScore: 0, ewScore: 50, mp: 9.09 },
  { ns: 5, ew: 17, contract: "4\u2660", declarer: "S", result: -1, nsScore: 0, ewScore: 50, mp: 9.09 },
];


export default function DemoPage() {
  const ddsResult = useDDS(MOCK_HANDS);

  const handleBiddingChange = useCallback((newBidding: BiddingEntry[]) => {
    console.log("Bidding:", newBidding);
  }, []);

  const handleCommentChange = useCallback((comment: string) => {
    console.log("Comment:", comment);
  }, []);

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      {/* Header */}
      <header className="bg-[#1a5c2e] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-green-200 cursor-pointer">&larr;</span>
            <div>
              <h1 className="text-lg font-bold">Board 3</h1>
              <p className="text-xs text-green-200">第33回渡辺杯 フライトA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
              &larr; Board 2
            </button>
            <button className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
              Board 4 &rarr;
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* My Result Summary */}
        <div className="bg-[#c8a84e]/10 border border-[#c8a84e]/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">NS 7 vs EW 19</span>
              <div className="text-lg font-bold">
                4{"\u2660"} by S{" "}
                <span className="text-gray-700">=</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Score</div>
              <div className="text-lg font-bold">420</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">MP%</div>
              <div className="text-2xl font-bold text-blue-600">59.1%</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <HandDiagram hands={MOCK_HANDS} dealer="North" vulnerability="EW" boardNumber={3} />
            <DDSTable ddsTable={ddsResult} />
            <BestLead hands={MOCK_HANDS} contract={"4\u2660"} declarer="S" />
          </div>
          <div className="space-y-6">
            <BiddingBox dealer="North" initialBidding={null} onBiddingChange={handleBiddingChange} />
            <CommentEditor initialComment={null} onCommentChange={handleCommentChange} />
          </div>
        </div>

        <TravellerTable travellers={MOCK_TRAVELLERS} pairNumber={7} />
      </main>
    </div>
  );
}
