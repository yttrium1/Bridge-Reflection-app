// Best Lead calculator at project root for correct module resolution
const { doubleDummySolve } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

const NEXT_PLAYER = { N: "E", E: "S", S: "W", W: "N" };

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const { hands, declarer, trump } = JSON.parse(input);
    const deal = {};
    for (const d of ["N", "E", "S", "W"]) {
      deal[d] = StringParser.parseHand(hands[d]);
    }
    const leader = NEXT_PLAYER[declarer];
    const results = await doubleDummySolve(deal, [], leader, trump);
    const maxTricks = Math.max(...results.map(r => r.result));
    const bestLeads = results
      .filter(r => r.result === maxTricks)
      .map(r => ({ card: r.card.suit + r.card.rank, suit: r.card.suit, rank: r.card.rank, tricks: r.result }));
    process.stdout.write(JSON.stringify({ leader, bestLeads, maxDefenseTricks: maxTricks }));
  } catch (err) {
    process.stderr.write(String(err.message || err));
    process.exit(1);
  }
});
