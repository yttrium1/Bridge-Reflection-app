// DDS calculator - computes full 20-cell DDA table in a single process
const { doubleDummySolveTricks } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

const LHO = { N: "E", E: "S", S: "W", W: "N" };

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const { hands, mode, dir, trump } = JSON.parse(input);
    const deal = {};
    for (const d of ["N", "E", "S", "W"]) {
      deal[d] = StringParser.parseHand(hands[d]);
    }

    if (mode === "full") {
      // Full DDA table: 4 declarers × 5 denominations = 20 calculations
      const denoms = ["C", "D", "H", "S", "NT"];
      const result = { N: {}, E: {}, S: {}, W: {} };

      for (const denom of denoms) {
        for (const declarer of ["N", "E", "S", "W"]) {
          const leader = LHO[declarer];
          const leaderTricks = await doubleDummySolveTricks(deal, [], leader, denom);
          result[declarer][denom] = 13 - leaderTricks;
        }
      }

      process.stdout.write(JSON.stringify(result));
    } else {
      // Single calculation (for best lead etc.)
      const tricks = await doubleDummySolveTricks(deal, [], dir, trump);
      process.stdout.write(String(tricks));
    }
  } catch (err) {
    process.stderr.write(String(err.message || err));
    process.exit(1);
  }
});
