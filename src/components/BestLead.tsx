"use client";

import { useState, useEffect } from "react";
import type { BoardHands } from "@/lib/bridge/types";

const SUIT_DISPLAY: Record<string, { symbol: string; color: string }> = {
  S: { symbol: "\u2660", color: "text-[#1e3a5f]" },
  H: { symbol: "\u2665", color: "text-[#c0392b]" },
  D: { symbol: "\u2666", color: "text-[#d4740e]" },
  C: { symbol: "\u2663", color: "text-[#1a7a3a]" },
};

interface BestLeadResult {
  leader: string;
  bestLeads: { card: string; suit: string; rank: string; tricks: number }[];
  maxDefenseTricks: number;
}

export default function BestLead({
  hands,
  contract,
  declarer,
}: {
  hands: BoardHands | null;
  contract: string | undefined;
  declarer: string | undefined;
}) {
  const [result, setResult] = useState<BestLeadResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hands || !contract || !declarer) return;

    // Extract trump suit from contract (e.g., "4♠" -> "S", "3NT" -> "NT")
    let trump = "NT";
    if (contract.includes("\u2660")) trump = "S";
    else if (contract.includes("\u2665")) trump = "H";
    else if (contract.includes("\u2666")) trump = "D";
    else if (contract.includes("\u2663")) trump = "C";

    const controller = new AbortController();
    setLoading(true);

    fetch("/api/best-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hands, declarer, trump }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.bestLeads) setResult(data);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Best lead error:", err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [hands, contract, declarer]);

  if (!contract || !declarer) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-600 mb-2">Best Lead</h3>
      {loading ? (
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[#1a5c2e] border-t-transparent rounded-full animate-spin" />
          計算中...
        </div>
      ) : result ? (
        <div>
          <div className="text-xs text-gray-500 mb-2">
            リーダー: <strong>{result.leader}</strong> | ディフェンス最大: <strong>{result.maxDefenseTricks}トリック</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...result.bestLeads].sort((a, b) => {
              const suitOrder = ["S", "H", "D", "C"];
              const rankOrder = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
              const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
              if (suitDiff !== 0) return suitDiff;
              return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
            }).map((lead, i) => {
              const suitInfo = SUIT_DISPLAY[lead.suit];
              return (
                <div
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <span className={`text-lg font-bold ${suitInfo?.color || ""}`}>
                    {suitInfo?.symbol || lead.suit}
                  </span>
                  <span className="font-mono font-bold text-sm">
                    {lead.rank === "T" ? "10" : lead.rank}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400">データなし</div>
      )}
    </div>
  );
}
