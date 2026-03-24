import * as cheerio from "cheerio";
import type { BoardHands, Hand, TravellerRow, Vulnerability, ScoringType } from "@/lib/bridge/types";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContract($: cheerio.CheerioAPI, cell: any): string {
  let contract = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cell.contents().each((_: number, el: any) => {
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
  return contract;
}

export function detectScoringType($: cheerio.CheerioAPI): ScoringType {
  const table = $("#tblTrv");
  if (!table.length) return "MP";
  const headerRow = table.find("tr").eq(1);
  const headerText = headerRow.text();
  if (headerText.includes("DAT")) return "DAT";
  if (headerText.includes("IMP")) return "IMP";
  return "MP";
}

export function parseTravellerTable($: cheerio.CheerioAPI, scoringType?: ScoringType | "IMP_NS"): TravellerRow[] {
  const rows: TravellerRow[] = [];
  const table = $("#tblTrv");
  if (!table.length) return rows;

  const detectedType = scoringType || detectScoringType($);
  const trs = table.find("tr");

  if (detectedType === "DAT") {
    // DAT (Datum) format: NS | EW | Contract | MD | OL | PLUS | MINUS | DAT
    // From screenshot: columns are NS, EW, Contract, By(declarer), MD, OL, PLUS, MINUS, DAT
    // But the header row shows: NS | EW | Contract | MD | OL | PLUS | MINUS | DAT
    // The "By" direction appears to be embedded before MD
    // Looking more carefully: 3♠ | S | 4 | ♥Q means Contract=3♠, Declarer=S, MD=4, OL=♥Q
    trs.each((index, tr) => {
      if (index < 2) return;

      const cells = $(tr).find("td");
      if (cells.length < 7) return;

      const ns = parseInt(cells.eq(0).text().trim()) || 0;
      const ew = parseInt(cells.eq(1).text().trim()) || 0;
      const contract = extractContract($, cells.eq(2));

      // Detect column layout by checking if cell 3 is a direction letter
      const cell3Text = cells.eq(3).text().trim();
      let declarer = "";
      let mdCellIdx = 3;
      let olCellIdx = 4;
      let plusCellIdx = 5;
      let minusCellIdx = 6;
      let datCellIdx = 7;

      if (["N", "E", "S", "W"].includes(cell3Text)) {
        // Layout: NS | EW | Contract | By | MD | OL | PLUS | MINUS | DAT
        declarer = cell3Text;
        mdCellIdx = 4;
        olCellIdx = 5;
        plusCellIdx = 6;
        minusCellIdx = 7;
        datCellIdx = 8;
      }

      const mdText = cells.eq(mdCellIdx).text().trim();
      const rawResult = parseInt(mdText) || 0;
      const contractLevel = parseInt(contract.replace(/[^0-9]/g, "")) || 0;
      const result = mdText.startsWith("-") ? rawResult : (rawResult > 0 ? rawResult - contractLevel : 0);

      // OL (Opening Lead) - may contain suit image
      let openingLead = "";
      if (cells.length > olCellIdx) {
        const olCell = cells.eq(olCellIdx);
        const olImg = olCell.find("img");
        if (olImg.length) {
          const src = olImg.attr("src") || "";
          const suit = parseSuitFromImg(src);
          const suitSymbol: Record<string, string> = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
          openingLead = (suitSymbol[suit] || "") + olCell.text().trim();
        } else {
          openingLead = olCell.text().trim();
        }
      }

      // PLUS and MINUS columns
      const plusText = cells.length > plusCellIdx ? cells.eq(plusCellIdx).text().trim() : "0";
      const minusText = cells.length > minusCellIdx ? cells.eq(minusCellIdx).text().trim() : "0";
      const plusScore = parseInt(plusText) || 0;
      const minusScore = parseInt(minusText) || 0;

      // NS score: positive from PLUS, negative from MINUS
      const nsScore = plusScore > 0 ? plusScore : (minusScore > 0 ? -minusScore : 0);

      // DAT column
      const datText = cells.length > datCellIdx ? cells.eq(datCellIdx).text().trim() : "0";
      const dat = parseFloat(datText) || 0;

      if (contract) {
        rows.push({
          ns,
          ew,
          contract,
          declarer,
          result,
          nsScore,
          ewScore: nsScore > 0 ? 0 : Math.abs(nsScore),
          mp: 0,
          dat,
          openingLead,
        });
      }
    });
  } else if (detectedType === "IMP_NS") {
    // IMP NS番号順 format: NS | EW | Contract | MD | N-S | E-W | IMP | IMP/T
    // NS/EW are pair IDs like "A01", "B12"
    trs.each((index, tr) => {
      if (index < 2) return;

      const cells = $(tr).find("td");
      if (cells.length < 7) return;

      const nsId = cells.eq(0).text().trim(); // e.g. "A01"
      const ewId = cells.eq(1).text().trim(); // e.g. "A19"
      const contract = extractContract($, cells.eq(2));
      const declarer = cells.eq(3).text().trim();
      const resultText = cells.eq(4).text().trim();
      const rawResult = parseInt(resultText) || 0;
      const contractLevel = parseInt(contract.replace(/[^0-9]/g, "")) || 0;
      const result = rawResult < 0 ? rawResult : (rawResult - contractLevel);

      const nsScoreText = cells.eq(5).text().trim();
      const ewScoreText = cells.eq(6).text().trim();
      const nsScore = parseInt(nsScoreText) || 0;
      const ewScore = parseInt(ewScoreText) || 0;

      const impText = cells.eq(7)?.text().trim() || "0";
      const imp = parseFloat(impText) || 0;

      const impPerTableText = cells.eq(8)?.text().trim() || "0";
      const impPerTable = parseFloat(impPerTableText) || 0;

      // Extract numeric part from pair ID for ns/ew fields
      const nsNum = parseInt(nsId.replace(/[^0-9]/g, "")) || 0;
      const ewNum = parseInt(ewId.replace(/[^0-9]/g, "")) || 0;

      if (contract) {
        rows.push({
          ns: nsNum,
          ew: ewNum,
          nsId,
          ewId,
          contract,
          declarer,
          result,
          nsScore,
          ewScore,
          mp: 0,
          imp,
          impPerTable,
        });
      }
    });
  } else if (detectedType === "IMP") {
    // IMP summary format: Contract | Declarer | MD | N-S | E-W | IMP | IMP/T | Tie
    trs.each((index, tr) => {
      if (index < 2) return;

      const cells = $(tr).find("td");
      if (cells.length < 6) return;

      const contract = extractContract($, cells.eq(0));
      const declarer = cells.eq(1).text().trim();
      const resultText = cells.eq(2).text().trim();
      const rawResult = parseInt(resultText) || 0;
      const contractLevel = parseInt(contract.replace(/[^0-9]/g, "")) || 0;
      const result = rawResult < 0 ? rawResult : (rawResult - contractLevel);

      const nsScoreText = cells.eq(3).text().trim();
      const ewScoreText = cells.eq(4).text().trim();
      const nsScore = parseInt(nsScoreText) || 0;
      const ewScore = parseInt(ewScoreText) || 0;

      const impText = cells.eq(5)?.text().trim() || "0";
      const imp = parseFloat(impText) || 0;

      const impPerTableText = cells.eq(6)?.text().trim() || "0";
      const impPerTable = parseFloat(impPerTableText) || 0;

      const tieText = cells.eq(7)?.text().trim() || "0";
      const tie = parseInt(tieText) || 0;

      if (contract) {
        rows.push({
          ns: 0,
          ew: 0,
          contract,
          declarer,
          result,
          nsScore,
          ewScore,
          mp: 0,
          imp,
          impPerTable,
          tie,
        });
      }
    });
  } else {
    // MP format: NS | EW | Contract | Declarer | MD | N-S | E-W | MP%
    trs.each((index, tr) => {
      if (index < 2) return;

      const cells = $(tr).find("td");
      if (cells.length < 7) return;

      const contract = extractContract($, cells.eq(2));

      const ns = parseInt(cells.eq(0).text().trim()) || 0;
      const ew = parseInt(cells.eq(1).text().trim()) || 0;
      const declarer = cells.eq(3).text().trim();
      const resultText = cells.eq(4).text().trim();
      const rawResult = parseInt(resultText) || 0;
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
  }

  // If all MP% values are 0, calculate MP% from NS scores
  const allMpZero = rows.length > 1 && rows.every(r => r.mp === 0);
  if (allMpZero) {
    // Calculate matchpoints from NS perspective
    // Each pair gets 2 points for a win, 1 for a tie, 0 for a loss
    const validRows = rows.filter(r => r.nsScore !== 0 || r.ewScore !== 0 || r.contract);
    for (let i = 0; i < validRows.length; i++) {
      const myNsScore = validRows[i].nsScore > 0 ? validRows[i].nsScore : -validRows[i].ewScore;
      let matchPoints = 0;
      let comparisons = 0;
      for (let j = 0; j < validRows.length; j++) {
        if (i === j) continue;
        const otherNsScore = validRows[j].nsScore > 0 ? validRows[j].nsScore : -validRows[j].ewScore;
        comparisons++;
        if (myNsScore > otherNsScore) matchPoints += 2;
        else if (myNsScore === otherNsScore) matchPoints += 1;
      }
      if (comparisons > 0) {
        validRows[i].mp = (matchPoints / (2 * comparisons)) * 100;
      }
    }
  }

  return rows;
}
