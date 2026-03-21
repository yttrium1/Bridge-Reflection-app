import * as cheerio from "cheerio";
import type { BoardHands, Hand, TravellerRow, Vulnerability } from "@/lib/bridge/types";

const SUIT_IMAGE_MAP: Record<string, string> = {
  "S14.png": "S",
  "H14.png": "H",
  "D14.png": "D",
  "C14.png": "C",
  "S": "S",
  "H": "H",
  "D": "D",
  "C": "C",
};

function parseSuitFromImg(src: string): string {
  const filename = src.split("/").pop() || "";
  return SUIT_IMAGE_MAP[filename] || "?";
}

export function parseHandRecord(handText: string): {
  boardNumber: number;
  dealer: string;
  vulnerability: Vulnerability;
  hands: BoardHands;
} {
  const lines = handText.split("\n");

  let boardNumber = 0;
  let dealer = "North";
  let vulnerability: Vulnerability = "None";

  const suitData: Record<string, string[]> = { N: [], E: [], S: [], W: [] };

  for (const line of lines) {
    const boardMatch = line.match(/Board:\s*(\d+)/);
    if (boardMatch) boardNumber = parseInt(boardMatch[1]);

    const dealerMatch = line.match(/Dealer:\s*(\w+)/);
    if (dealerMatch) dealer = dealerMatch[1];

    const vulMatch = line.match(/Vul:\s*(.+)/);
    if (vulMatch) {
      const v = vulMatch[1].trim();
      if (v === "None") vulnerability = "None";
      else if (v === "N-S" || v === "NS") vulnerability = "NS";
      else if (v === "E-W" || v === "EW") vulnerability = "EW";
      else if (v === "Both" || v === "All") vulnerability = "Both";
    }
  }

  // Parse the hand diagram using *NN* and *SS* markers as section dividers
  // Lines before *NN* = North (centered, indented)
  // Lines with *NN*/*SS* or W/E markers = West (left) and East (right)
  // Lines after *SS* = South (centered, indented)
  let section: "north" | "middle" | "south" = "north";
  const northSuits: { suit: string; cards: string }[] = [];
  const southSuits: { suit: string; cards: string }[] = [];
  const westSuits: { suit: string; cards: string }[] = [];
  const eastSuits: { suit: string; cards: string }[] = [];

  for (const line of lines) {
    if (line.includes("*NN*") || line.includes("W  E")) {
      section = "middle";
    }
    if (line.includes("*SS*")) {
      // This line is still middle (has W/E suits)
      // After processing, switch to south
    }

    const suitMatches = [...line.matchAll(/([SHDC]):([AKQJT0-9]+)/g)];
    if (suitMatches.length === 0) {
      // Check for section transition after *SS* line
      if (line.includes("*SS*")) section = "south";
      continue;
    }

    if (line.includes("*NN*") || line.includes("*SS*") || line.includes("W  E")) {
      // Middle section: West on left, East on right
      if (suitMatches.length >= 2) {
        westSuits.push({ suit: suitMatches[0][1], cards: suitMatches[0][2] });
        eastSuits.push({ suit: suitMatches[1][1], cards: suitMatches[1][2] });
      } else if (suitMatches.length === 1) {
        // Only one suit on the line - determine by position
        const col = line.indexOf(suitMatches[0][0]);
        if (col < 10) {
          westSuits.push({ suit: suitMatches[0][1], cards: suitMatches[0][2] });
        } else {
          eastSuits.push({ suit: suitMatches[0][1], cards: suitMatches[0][2] });
        }
      }
      if (line.includes("*SS*")) section = "south";
    } else if (section === "north") {
      for (const m of suitMatches) {
        northSuits.push({ suit: m[1], cards: m[2] });
      }
    } else if (section === "south") {
      for (const m of suitMatches) {
        southSuits.push({ suit: m[1], cards: m[2] });
      }
    }
  }

  function buildHand(suits: { suit: string; cards: string }[]): Hand {
    const hand: Hand = { S: [], H: [], D: [], C: [] };
    for (const s of suits) {
      const suit = s.suit as keyof Hand;
      hand[suit] = expandCards(s.cards);
    }
    return hand;
  }

  return {
    boardNumber,
    dealer,
    vulnerability,
    hands: {
      N: buildHand(northSuits),
      W: buildHand(westSuits),
      E: buildHand(eastSuits),
      S: buildHand(southSuits),
    },
  };
}

function expandCards(cards: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < cards.length) {
    if (cards[i] === "1" && i + 1 < cards.length && cards[i + 1] === "0") {
      result.push("10");
      i += 2;
    } else {
      const c = cards[i];
      if (c === "T") result.push("10");
      else result.push(c);
      i++;
    }
  }
  return result;
}

export function parseTravellerTable($: cheerio.CheerioAPI): TravellerRow[] {
  const rows: TravellerRow[] = [];
  const table = $("#tblTrv");
  if (!table.length) return rows;

  const trs = table.find("tr");
  // Skip first 2 rows (title + header)
  trs.each((index, tr) => {
    if (index < 2) return;

    const cells = $(tr).find("td");
    if (cells.length < 7) return;

    // Extract contract with suit image handling
    const contractCell = cells.eq(2);
    let contract = "";
    contractCell.contents().each((_, el) => {
      const node = el as unknown as { type: string; tagName?: string };
      if (node.type === "text") {
        contract += $(el).text().trim();
      } else if (node.type === "tag" && node.tagName === "span") {
        contract += $(el).text().trim();
      } else if (node.type === "tag" && node.tagName === "img") {
        const src = $(el).attr("src") || "";
        const suit = parseSuitFromImg(src);
        const suitSymbol: Record<string, string> = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
        contract += suitSymbol[suit] || suit;
      }
    });

    const ns = parseInt(cells.eq(0).text().trim()) || 0;
    const ew = parseInt(cells.eq(1).text().trim()) || 0;
    const declarer = cells.eq(3).text().trim();
    const resultText = cells.eq(4).text().trim();
    const rawResult = parseInt(resultText) || 0;
    // rawResult: positive = made level, negative = down tricks
    // Convert to over/under tricks relative to contract level
    const contractLevel = parseInt(contract.replace(/[^0-9]/g, "")) || 0;
    const result = rawResult < 0 ? rawResult : (rawResult - contractLevel);
    const nsScoreText = cells.eq(5).text().trim();
    const ewScoreText = cells.eq(6).text().trim();
    const nsScore = parseInt(nsScoreText) || 0;
    const ewScore = parseInt(ewScoreText) || 0;
    const mpText = cells.eq(7)?.text().trim() || "0";
    const mp = parseFloat(mpText) || 0;

    if (ns > 0 || ew > 0) {
      rows.push({ ns, ew, contract, declarer, result, nsScore, ewScore, mp });
    }
  });

  return rows;
}
