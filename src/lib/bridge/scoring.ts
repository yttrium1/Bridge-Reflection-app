import type { Denomination, Vulnerability } from "./types";

function isVulnerable(declarer: string, vulnerability: Vulnerability): boolean {
  if (vulnerability === "Both") return true;
  if (vulnerability === "None") return false;
  if (vulnerability === "NS") return declarer === "N" || declarer === "S";
  if (vulnerability === "EW") return declarer === "E" || declarer === "W";
  return false;
}

function trickValue(denomination: Denomination): number {
  if (denomination === "C" || denomination === "D") return 20;
  return 30; // H, S, NT
}

export function calculateScore(
  denomination: Denomination,
  level: number,
  tricks: number,
  declarer: string,
  vulnerability: Vulnerability,
  doubled: boolean = false,
  redoubled: boolean = false
): number {
  const bid = level + 6;
  const made = tricks - bid;
  const vul = isVulnerable(declarer, vulnerability);

  if (made < 0) {
    // Down
    const down = -made;
    if (redoubled) {
      if (vul) {
        return -(down === 1 ? 400 : 400 + (down - 1) * 600);
      } else {
        if (down === 1) return -200;
        if (down === 2) return -600;
        if (down === 3) return -1000;
        return -1000 + (down - 3) * 600;
      }
    }
    if (doubled) {
      if (vul) {
        return -(down === 1 ? 200 : 200 + (down - 1) * 300);
      } else {
        if (down === 1) return -100;
        if (down === 2) return -300;
        if (down === 3) return -500;
        return -500 + (down - 3) * 300;
      }
    }
    return vul ? down * -100 : down * -50;
  }

  // Made
  let score = 0;

  // Contract tricks
  const baseTrickValue = trickValue(denomination);
  let contractPoints = level * baseTrickValue;
  if (denomination === "NT") contractPoints += 10; // first trick bonus for NT
  if (doubled) contractPoints *= 2;
  if (redoubled) contractPoints *= 4;
  score += contractPoints;

  // Game/partscore bonus
  if (contractPoints >= 100) {
    score += vul ? 500 : 300; // game bonus
  } else {
    score += 50; // partscore bonus
  }

  // Slam bonus
  if (level === 6) score += vul ? 750 : 500;
  if (level === 7) score += vul ? 1500 : 1000;

  // Overtricks
  if (made > 0) {
    if (redoubled) {
      score += made * (vul ? 400 : 200);
    } else if (doubled) {
      score += made * (vul ? 200 : 100);
    } else {
      score += made * baseTrickValue;
    }
  }

  // Insult bonus for making doubled/redoubled
  if (doubled) score += 50;
  if (redoubled) score += 100;

  return score;
}

export function getBestContractScore(
  ddsTricks: Record<Denomination, number>,
  declarer: string,
  vulnerability: Vulnerability
): { denomination: Denomination; level: number; tricks: number; score: number } | null {
  const denominations: Denomination[] = ["NT", "S", "H", "D", "C"];
  let best: { denomination: Denomination; level: number; tricks: number; score: number } | null = null;

  for (const denom of denominations) {
    const maxTricks = ddsTricks[denom];
    for (let level = 1; level <= 7; level++) {
      const needed = level + 6;
      if (maxTricks >= needed) {
        const score = calculateScore(denom, level, maxTricks, declarer, vulnerability);
        if (!best || Math.abs(score) > Math.abs(best.score)) {
          best = { denomination: denom, level, tricks: maxTricks, score };
        }
      }
    }
  }

  return best;
}
