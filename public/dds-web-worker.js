// DDS Web Worker - runs DDS calculations in browser using WASM
// Self-contained: no external dependencies except compiled.js WASM module

// --- Utility functions (from @bridge-tools/core) ---
function positiveModulo(a, modulus) {
  let m = a % modulus;
  if (m < 0) m += modulus;
  return m;
}

const COMPASS_TO_NUMBER = { N: 0, E: 1, S: 2, W: 3 };
const NUMBER_TO_COMPASS = { 0: "N", 1: "E", 2: "S", 3: "W" };

function rotateClockwise(initial, steps) {
  return NUMBER_TO_COMPASS[positiveModulo(COMPASS_TO_NUMBER[initial] + steps, 4)];
}
function rotateAnticlockwise(initial, steps) {
  return rotateClockwise(initial, -steps);
}

// --- Card/Suit converters (from @bridge-tools/dd) ---
const SUIT_TO_DDS = { S: 0, H: 1, D: 2, C: 3 };
const DDS_TO_SUIT = { 0: "S", 1: "H", 2: "D", 3: "C" };
const RANK_TO_DDS = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14, "10": 10 };
const DDS_TO_RANK = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "T", 11: "J", 12: "Q", 13: "K", 14: "A" };
const COMPASS_TO_DDS = { N: 0, E: 1, S: 2, W: 3 };
const TRUMP_TO_DDS = { S: 0, H: 1, D: 2, C: 3, NT: 4 };
const CARDS_IN_HAND = 13;
const BYTES_PER_INT = 4;
const INTS_PER_RESULT = 3;

function convertCardToDDS(card) {
  if (!card) return { rank: 0, suit: 0 };
  return { rank: RANK_TO_DDS[card.rank], suit: SUIT_TO_DDS[card.suit] };
}

function convertCardFromDDS(card) {
  return { rank: DDS_TO_RANK[card.rank], suit: DDS_TO_SUIT[card.suit] };
}

function parseHandToCards(handStr) {
  const suits = ["S", "H", "D", "C"];
  const parts = handStr.split(".");
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const suitStr = parts[i] || "";
    for (const ch of suitStr) {
      cards.push({ suit: suits[i], rank: ch });
    }
  }
  return cards;
}

function stringifyHand(hand) {
  const rankOrder = { A: 0, K: 1, Q: 2, J: 3, T: 4, "10": 4, "9": 5, "8": 6, "7": 7, "6": 8, "5": 9, "4": 10, "3": 11, "2": 12 };
  const bySuit = { S: [], H: [], D: [], C: [] };
  for (const card of hand) {
    if (bySuit[card.suit]) bySuit[card.suit].push(card.rank);
  }
  return ["S", "H", "D", "C"].map(s =>
    bySuit[s].sort((a, b) => (rankOrder[a] || 99) - (rankOrder[b] || 99)).join("")
  ).join(".");
}

function convertDealToDDS(deal) {
  return "N:" + stringifyHand(deal.N) + " " + stringifyHand(deal.E) + " " + stringifyHand(deal.S) + " " + stringifyHand(deal.W);
}

function cardBelow(card) {
  const rankList = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const idx = rankList.indexOf(card.rank);
  if (idx <= 0) return null;
  return { suit: card.suit, rank: rankList[idx - 1] };
}

function handContainsCard(hand, card) {
  return hand.some(c => c.suit === card.suit && c.rank === card.rank);
}

// --- WASM Module Management ---
let wasmModule = null;

async function loadWasm() {
  if (wasmModule) return wasmModule;

  // Import the Emscripten-generated module
  importScripts("/wasm/compiled.js");

  // create_dds_module is now available globally
  wasmModule = await create_dds_module({
    locateFile: (path) => {
      if (path.endsWith(".wasm")) return "/wasm/compiled.wasm";
      return path;
    }
  });
  wasmModule._dds_init();
  return wasmModule;
}

async function resetWasm() {
  wasmModule = null;
  return loadWasm();
}

// --- DDS Solve Functions ---
async function doubleDummySolve(deal, trick, toPlay, trump) {
  const instance = await loadWasm();
  const dealStr = convertDealToDDS(deal);
  const dealStringPointer = instance.allocateUTF8(dealStr);
  const resultPointer = instance._malloc(CARDS_IN_HAND * INTS_PER_RESULT * BYTES_PER_INT);
  for (let i = 0; i < CARDS_IN_HAND; i++) {
    instance.setValue(resultPointer + i * BYTES_PER_INT, -1, "i32");
  }

  const card0 = convertCardToDDS(trick[0]);
  const card1 = convertCardToDDS(trick[1]);
  const card2 = convertCardToDDS(trick[2]);
  const ddsTrump = TRUMP_TO_DDS[trump];
  const ddsDirection = COMPASS_TO_DDS[rotateAnticlockwise(toPlay, trick.length)];

  instance._dds_solve_board(
    ddsTrump, ddsDirection,
    card0.suit, card0.rank,
    card1.suit, card1.rank,
    card2.suit, card2.rank,
    dealStringPointer, resultPointer
  );

  const retval = [];
  for (let i = 0; i < CARDS_IN_HAND; i++) {
    const currentIndex = resultPointer + i * BYTES_PER_INT * INTS_PER_RESULT;
    const rank = instance.getValue(currentIndex, "i32");
    const suit = instance.getValue(currentIndex + BYTES_PER_INT, "i32");
    const tricks = instance.getValue(currentIndex + 2 * BYTES_PER_INT, "i32");
    if (rank === -1 || rank === 0) break;
    const card = convertCardFromDDS({ rank, suit });
    retval.push({ card, result: tricks });
    let eq = cardBelow(card);
    while (eq) {
      if (!handContainsCard(deal[toPlay], eq)) break;
      retval.push({ card: eq, result: tricks });
      eq = cardBelow(eq);
    }
  }

  instance._free(resultPointer);
  instance._free(dealStringPointer);
  return retval;
}

async function doubleDummySolveTricks(deal, trick, toPlay, trump) {
  const solutions = await doubleDummySolve(deal, trick, toPlay, trump);
  let maxTricks = 0;
  solutions.forEach(({ result }) => { if (result > maxTricks) maxTricks = result; });
  return maxTricks;
}

// --- Message Handler ---
const LHO = { N: "E", E: "S", S: "W", W: "N" };

self.onmessage = async function(e) {
  const { id, mode, hands, leader, trump, trick, declarer } = e.data;

  try {
    if (mode === "fullTable") {
      const directions = ["N", "E", "S", "W"];
      const denominations = ["C", "D", "H", "S", "NT"];
      const result = { N: {}, E: {}, S: {}, W: {} };

      for (const denom of denominations) {
        for (const decl of directions) {
          // Reset WASM for each cell to avoid state contamination
          await resetWasm();
          const deal = {};
          for (const d of directions) deal[d] = parseHandToCards(hands[d]);
          const leaderDir = LHO[decl];
          const leaderTricks = await doubleDummySolveTricks(deal, [], leaderDir, denom);
          result[decl][denom] = 13 - leaderTricks;
        }
      }

      self.postMessage({ id, result });
    } else if (mode === "solve") {
      await resetWasm();
      const deal = {};
      for (const d of ["N", "E", "S", "W"]) deal[d] = parseHandToCards(hands[d]);
      const trickCards = (trick || []).map(c => ({
        suit: c.suit,
        rank: c.rank === "10" ? "T" : c.rank,
      }));
      const results = await doubleDummySolve(deal, trickCards, leader, trump);
      self.postMessage({
        id,
        result: results.map(r => ({
          card: { suit: r.card.suit, rank: r.card.rank },
          result: r.result,
        })),
      });
    } else if (mode === "solveTricks") {
      await resetWasm();
      const deal = {};
      for (const d of ["N", "E", "S", "W"]) deal[d] = parseHandToCards(hands[d]);
      const result = await doubleDummySolveTricks(deal, [], leader, trump);
      self.postMessage({ id, result });
    }
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};
