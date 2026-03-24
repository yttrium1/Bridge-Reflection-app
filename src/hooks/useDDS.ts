"use client";

import { useState, useEffect, useRef } from "react";
import type { BoardHands, DDSTable } from "@/lib/bridge/types";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export function useDDS(
  hands: BoardHands | null,
  options?: {
    cachedResult?: DDSTable | null;
    firestorePath?: { uid: string; tournamentId: string; boardId: string };
  }
): DDSTable | null {
  const [ddsTable, setDdsTable] = useState<DDSTable | null>(
    options?.cachedResult || null
  );
  const hasComputed = useRef(false);

  // Use cached result if available
  useEffect(() => {
    if (options?.cachedResult) {
      setDdsTable(options.cachedResult);
      hasComputed.current = true;
    }
  }, [options?.cachedResult]);

  const uid = options?.firestorePath?.uid;
  const tournamentId = options?.firestorePath?.tournamentId;
  const boardId = options?.firestorePath?.boardId;

  useEffect(() => {
    // Skip if already have result
    if (hasComputed.current || ddsTable) return;
    if (!hands) return;

    const cardCount = (h: typeof hands.N) =>
      h.S.length + h.H.length + h.D.length + h.C.length;
    if (cardCount(hands.N) === 0) return;
    if (!["N", "E", "S", "W"].every(d => cardCount(hands[d as keyof typeof hands]) === 13)) return;

    hasComputed.current = true;
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

        const result = (await response.json()) as DDSTable;
        setDdsTable(result);

        // Cache in Firestore
        if (uid && tournamentId && boardId) {
          try {
            await updateDoc(
              doc(db, "users", uid, "tournaments", tournamentId, "boards", boardId),
              { ddsTable: result }
            );
          } catch (e) {
            console.warn("Failed to cache DDS:", e);
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("DDS calculation failed:", err);
          hasComputed.current = false;
        }
      }
    }

    fetchDDS();
    return () => controller.abort();
  }, [hands, ddsTable, uid, tournamentId, boardId]);

  return ddsTable;
}
