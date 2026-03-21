// Best Lead Solver - calculates the best opening lead for defense
// Input: {"hands": {"N":"...", "E":"...", "S":"...", "W":"..."}, "declarer": "S", "trump": "S"}
// The opening leader is to the left of declarer (clockwise)
// Output: {"bestLeads": [{"card":"HK","tricks":5}, ...], "leader":"W"}

const { doubleDummySolve } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

const NEXT_PLAYER = { N: "E", E: "S", S: "W", W: "N" };

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const data = JSON.parse(input);
    const { hands, declarer, trump } = data;

    const deal = {};
    for (const dir of ["N", "E", "S", "W"]) {
      deal[dir] = StringParser.parseHand(hands[dir]);
    }

    // Opening leader is to the left of declarer
    const leader = NEXT_PLAYER[declarer];

    // Get all possible leads and their trick results
    const results = await doubleDummySolve(deal, [], leader, trump);

    // results is array of { card: {suit, rank}, result: number }
    // result = tricks the LEADER's side can take
    // Find maximum tricks for defense
    const maxTricks = Math.max(...results.map(r => r.result));

    const bestLeads = results
      .filter(r => r.result === maxTricks)
      .map(r => ({
        card: r.card.suit + r.card.rank,
        suit: r.card.suit,
        rank: r.card.rank,
        tricks: r.result,
      }));

    process.stdout.write(JSON.stringify({
      leader,
      bestLeads,
      maxDefenseTricks: maxTricks,
    }));
  } catch (err) {
    process.stderr.write(err.message || String(err));
    process.exit(1);
  }
});
