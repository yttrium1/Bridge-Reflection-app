#!/usr/bin/env node
// Single DDS calculation - one process per cell to avoid WASM state issues
// Input: JSON via stdin with {hands, leader, trump} or {hands, leader, trump, trick, partial}
// Output: JSON result to stdout

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
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const { hands, leader, trump, trick, mode } = input;

  const { doubleDummySolveTricks, doubleDummySolve } = require("@bridge-tools/dd");

  const deal = {};
  for (const d of ["N", "E", "S", "W"]) {
    deal[d] = parseHandToCards(hands[d]);
  }

  if (mode === "solve") {
    const trickCards = trick || [];
    const results = await doubleDummySolve(deal, trickCards, leader, trump);
    process.stdout.write(JSON.stringify(results.map(r => ({
      card: { suit: r.card.suit, rank: r.card.rank },
      result: r.result,
    }))));
  } else {
    const result = await doubleDummySolveTricks(deal, [], leader, trump);
    process.stdout.write(JSON.stringify(result));
  }
}

run().catch(err => {
  process.stderr.write("DDS calc error: " + err.message);
  process.exit(1);
});
