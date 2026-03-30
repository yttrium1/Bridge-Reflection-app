// Client-side DDS computation using Web Worker
// Runs DDS calculations in the browser, eliminating server-side WASM issues

/* eslint-disable @typescript-eslint/no-explicit-any */

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
// Progress callbacks for fullTable mode
const progressCallbacks = new Map<number, (progress: { completed: number; total: number; partial: any }) => void>();

function getWorker(): Worker {
  if (typeof window === "undefined") throw new Error("Web Worker only available in browser");
  if (!worker) {
    worker = new Worker("/dds-web-worker.js");
    worker.onmessage = (e) => {
      const { id, result, error, progress } = e.data;
      if (progress) {
        const cb = progressCallbacks.get(id);
        if (cb) cb(progress);
        return;
      }
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        progressCallbacks.delete(id);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(result);
        }
      }
    };
    worker.onerror = (e) => {
      console.error("DDS Worker error:", e);
      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error("Worker error: " + e.message));
        pendingRequests.delete(id);
      }
      // Recreate worker
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function sendToWorker(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timeoutMs = 120000; // 2 minutes
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("DDS calculation timed out"));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });

    try {
      getWorker().postMessage({ id, ...data });
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function handsToStringFormat(hand: Record<string, string[]>): string {
  const suits = ["S", "H", "D", "C"];
  return suits.map(s => {
    const cards = hand[s] || [];
    return cards.map((c: string) => c === "10" ? "T" : c).join("");
  }).join(".");
}

/**
 * Compute full DDS table (20 cells) in Web Worker
 */
export async function computeDDSTableClient(
  hands: Record<string, Record<string, string[]>>,
  onProgress?: (progress: { completed: number; total: number; partial: Record<string, Record<string, number>> }) => void,
): Promise<Record<string, Record<string, number>>> {
  const handStrings: Record<string, string> = {};
  for (const dir of ["N", "E", "S", "W"]) {
    handStrings[dir] = handsToStringFormat(hands[dir]);
  }

  // Validate
  for (const dir of ["N", "E", "S", "W"]) {
    const count = handStrings[dir].replace(/\./g, "").length;
    if (count !== 13) {
      throw new Error(`${dir} has ${count} cards (need 13)`);
    }
  }

  // Register progress callback
  const id = requestId + 1; // next id that sendToWorker will use
  if (onProgress) {
    progressCallbacks.set(id, onProgress);
  }

  return sendToWorker({ mode: "fullTable", hands: handStrings });
}

const LHO: Record<string, string> = { N: "E", E: "S", S: "W", W: "N" };

/**
 * Compute best lead in Web Worker
 */
export async function computeBestLeadClient(
  hands: Record<string, Record<string, string[]>>,
  declarer: string,
  trump: string
): Promise<{
  leader: string;
  bestLeads: { card: string; suit: string; rank: string; tricks: number }[];
  maxDefenseTricks: number;
}> {
  const handStrings: Record<string, string> = {};
  for (const dir of ["N", "E", "S", "W"]) {
    handStrings[dir] = handsToStringFormat(hands[dir]);
  }

  const leader = LHO[declarer];
  const results = await sendToWorker({
    mode: "solve",
    hands: handStrings,
    leader,
    trump,
  });

  const maxTricks = Math.max(...results.map((r: any) => r.result));
  const bestLeads = results
    .filter((r: any) => r.result === maxTricks)
    .map((r: any) => ({
      card: r.card.suit + r.card.rank,
      suit: r.card.suit,
      rank: r.card.rank === "T" ? "10" : r.card.rank,
      tricks: r.result,
    }));

  return { leader, bestLeads, maxDefenseTricks: maxTricks };
}

/**
 * Compute play analysis in Web Worker
 */
export async function computePlayAnalysisClient(
  hands: Record<string, Record<string, string[]>>,
  currentTrick: { suit: string; rank: string }[],
  nextPlayer: string,
  trump: string
): Promise<{
  analysis: { suit: string; rank: string; tricks: number }[];
  maxTricks: number;
}> {
  const handStrings: Record<string, string> = {};
  for (const dir of ["N", "E", "S", "W"]) {
    handStrings[dir] = handsToStringFormat(hands[dir]);
  }

  const trick = (currentTrick || []).map(c => ({
    suit: c.suit,
    rank: c.rank === "10" ? "T" : c.rank,
  }));

  const results = await sendToWorker({
    mode: "solve",
    hands: handStrings,
    leader: nextPlayer,
    trump,
    trick,
  });

  const analysis = results.map((r: any) => ({
    suit: r.card.suit,
    rank: r.card.rank === "T" ? "10" : r.card.rank,
    tricks: r.result,
  }));

  const suitOrder: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
  const rankOrder: Record<string, number> = {
    A: 0, K: 1, Q: 2, J: 3, "10": 4, T: 4, "9": 5, "8": 6, "7": 7, "6": 8, "5": 9, "4": 10, "3": 11, "2": 12,
  };
  analysis.sort((a: any, b: any) => {
    if (b.tricks !== a.tricks) return b.tricks - a.tricks;
    if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
    return rankOrder[a.rank] - rankOrder[b.rank];
  });

  const maxTricks = analysis.length > 0 ? analysis[0].tricks : 0;
  return { analysis, maxTricks };
}
