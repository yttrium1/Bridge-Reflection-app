// DDS Worker Thread - isolated WASM execution
const { parentPort, workerData } = require("worker_threads");
const { doubleDummySolve, doubleDummySolveTricks } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

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

async function run() {
  const { mode, hands, leader, trump, trick, partial } = workerData;

  const deal = {};
  for (const d of ["N", "E", "S", "W"]) {
    if (partial) {
      deal[d] = parseHandToCards(hands[d]);
    } else {
      deal[d] = StringParser.parseHand(hands[d]);
    }
  }

  if (mode === "solveTricks") {
    const result = await doubleDummySolveTricks(deal, [], leader, trump);
    parentPort.postMessage(result);
  } else if (mode === "solve") {
    const trickCards = trick || [];
    const results = await doubleDummySolve(deal, trickCards, leader, trump);
    parentPort.postMessage(results.map(r => ({
      card: { suit: r.card.suit, rank: r.card.rank },
      result: r.result,
    })));
  }
}

run().catch(err => {
  console.error("DDS Worker error:", err);
  process.exit(1);
});
