// DDS calculator at project root for correct module resolution
const { doubleDummySolveTricks } = require("@bridge-tools/dd");
const { StringParser } = require("@bridge-tools/core");

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const { hands, dir, trump } = JSON.parse(input);
    const deal = {};
    for (const d of ["N", "E", "S", "W"]) {
      deal[d] = StringParser.parseHand(hands[d]);
    }
    const tricks = await doubleDummySolveTricks(deal, [], dir, trump);
    process.stdout.write(String(tricks));
  } catch (err) {
    process.stderr.write(String(err.message || err));
    process.exit(1);
  }
});
