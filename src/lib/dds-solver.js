// DDS solver - spawns separate process per trump to avoid WASM state corruption
const { spawn } = require("child_process");
const path = require("path");

// Find project root (where node_modules is)
const projectRoot = path.resolve(__dirname, "../..");

function solveSingle(hands, dir, trump) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(__dirname, "dds-single.js")], {
      timeout: 15000,
      cwd: projectRoot,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      if (code === 0) resolve(parseInt(stdout));
      else reject(new Error(stderr || `exit ${code}`));
    });
    child.on("error", reject);
    child.stdin.write(JSON.stringify({ hands, dir, trump }));
    child.stdin.end();
  });
}

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const hands = JSON.parse(input);
    const denominations = ["C", "D", "H", "S", "NT"];
    const result = { N: {}, E: {}, S: {}, W: {} };

    for (const denom of denominations) {
      const nTricks = await solveSingle(hands, "N", denom);
      result.N[denom] = nTricks;
      result.S[denom] = nTricks;
      result.E[denom] = 13 - nTricks;
      result.W[denom] = 13 - nTricks;
    }

    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stderr.write(String(err.message || err));
    process.exit(1);
  }
});
