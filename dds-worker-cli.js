#!/usr/bin/env node
// DDS CLI Worker - runs as a separate process via stdin/stdout
// Reads JSON from stdin, outputs JSON to stdout

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

function clearBridgeToolsCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes("bridge-tools")) {
      delete require.cache[key];
    }
  });
}

async function run() {
  // Read input from stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const { mode, hands, leader, trump, trick, partial } = input;

  if (mode === "fullTable") {
    const LHO = { N: "E", E: "S", S: "W", W: "N" };
    const directions = ["N", "E", "S", "W"];
    const denominations = ["C", "D", "H", "S", "NT"];
    const result = { N: {}, E: {}, S: {}, W: {} };

    // Validate hands before processing
    for (const d of directions) {
      if (!hands[d] || typeof hands[d] !== "string") {
        process.stderr.write("DDS CLI error: Invalid hand for " + d + ": " + JSON.stringify(hands[d]));
        process.exit(1);
      }
    }

    for (const denom of denominations) {
      for (const decl of directions) {
        clearBridgeToolsCache();
        const { doubleDummySolveTricks } = require("@bridge-tools/dd");
        const { StringParser } = require("@bridge-tools/core");

        const deal = {};
        for (const d of directions) {
          deal[d] = StringParser.parseHand(hands[d]);
        }
        const leaderDir = LHO[decl];
        const leaderTricks = await doubleDummySolveTricks(deal, [], leaderDir, denom);
        result[decl][denom] = 13 - leaderTricks;
      }
    }

    process.stdout.write(JSON.stringify({ type: "fullTable", result }));
  } else if (mode === "solveTricks") {
    const { doubleDummySolveTricks } = require("@bridge-tools/dd");
    const { StringParser } = require("@bridge-tools/core");

    const deal = {};
    for (const d of ["N", "E", "S", "W"]) {
      deal[d] = StringParser.parseHand(hands[d]);
    }
    const result = await doubleDummySolveTricks(deal, [], leader, trump);
    process.stdout.write(JSON.stringify(result));
  } else if (mode === "solve") {
    const { doubleDummySolve } = require("@bridge-tools/dd");
    const { StringParser } = require("@bridge-tools/core");

    const deal = {};
    for (const d of ["N", "E", "S", "W"]) {
      if (partial) {
        deal[d] = parseHandToCards(hands[d]);
      } else {
        deal[d] = StringParser.parseHand(hands[d]);
      }
    }
    const trickCards = trick || [];
    const results = await doubleDummySolve(deal, trickCards, leader, trump);
    process.stdout.write(JSON.stringify(results.map(r => ({
      card: { suit: r.card.suit, rank: r.card.rank },
      result: r.result,
    }))));
  }
}

run().catch(err => {
  process.stderr.write("DDS CLI error: " + err.message);
  process.exit(1);
});
