// Play Analysis calculator - analyzes optimal cards for current position
const { doubleDummySolve } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const { hands, currentTrick, nextPlayer, trump } = JSON.parse(input);

    // Parse hands (remaining cards for each player)
    const deal = {};
    for (const d of ["N", "E", "S", "W"]) {
      deal[d] = StringParser.parseHand(hands[d]);
    }

    // Parse current trick cards
    const trick = (currentTrick || []).map(c => ({
      suit: c.suit,
      rank: c.rank === "10" ? "T" : c.rank,
    }));

    // Get analysis for all playable cards
    const results = await doubleDummySolve(deal, trick, nextPlayer, trump);

    // Format results: each card with trick count
    const analysis = results.map(r => ({
      suit: r.card.suit,
      rank: r.card.rank === "T" ? "10" : r.card.rank,
      tricks: r.result,
    }));

    // Sort by tricks descending, then by suit (S,H,D,C), then by rank
    const suitOrder = { S: 0, H: 1, D: 2, C: 3 };
    const rankOrder = { A: 0, K: 1, Q: 2, J: 3, "10": 4, T: 4, "9": 5, "8": 6, "7": 7, "6": 8, "5": 9, "4": 10, "3": 11, "2": 12 };
    analysis.sort((a, b) => {
      if (b.tricks !== a.tricks) return b.tricks - a.tricks;
      if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
      return rankOrder[a.rank] - rankOrder[b.rank];
    });

    const maxTricks = analysis.length > 0 ? analysis[0].tricks : 0;

    process.stdout.write(JSON.stringify({ analysis, maxTricks }));
  } catch (err) {
    process.stderr.write(String(err.message || err));
    process.exit(1);
  }
});
