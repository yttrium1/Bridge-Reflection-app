// DDS calculator - single calculation per process to avoid WASM state contamination
const { doubleDummySolveTricks } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const { hands, declarer, trump } = JSON.parse(input);
    const deal = {};
    for (const d of ["N", "E", "S", "W"]) {
      deal[d] = StringParser.parseHand(hands[d]);
    }

    // Leader is the LHO of the declarer
    const LHO = { N: "E", E: "S", S: "W", W: "N" };
    const leader = LHO[declarer];

    // Returns tricks for the leader's side
    const leaderTricks = await doubleDummySolveTricks(deal, [], leader, trump);
    // Declarer's tricks = 13 - leader's side tricks
    const declarerTricks = 13 - leaderTricks;

    process.stdout.write(String(declarerTricks));
  } catch (err) {
    process.stderr.write(String(err.message || err));
    process.exit(1);
  }
});
