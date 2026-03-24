"use client";

import { useState, useEffect } from "react";
import type { BoardHands, DDSTable } from "@/lib/bridge/types";

export function useDDS(hands: BoardHands | null): DDSTable | null {
  const [ddsTable, setDdsTable] = useState<DDSTable | null>(null);

  useEffect(() => {
    if (!hands) return;

    // Check if hands have actual cards and exactly 13 per hand
    const cardCount = (h: typeof hands.N) => h.S.length + h.H.length + h.D.length + h.C.length;
    const hasCards = cardCount(hands.N) > 0;
    if (!hasCards) return;
    const allValid = ["N", "E", "S", "W"].every(d => cardCount(hands[d as keyof typeof hands]) === 13);
    if (!allValid) return;

    const controller = new AbortController();

    async function fetchDDS() {
      try {
        const response = await fetch("/api/dds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hands }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("DDS API error");

        const result = await response.json();
        setDdsTable(result as DDSTable);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("DDS calculation failed:", err);
        }
      }
    }

    fetchDDS();

    return () => controller.abort();
  }, [hands]);

  return ddsTable;
}
