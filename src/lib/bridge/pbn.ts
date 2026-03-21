import type { BoardHands, Direction } from "./types";

const RANK_TO_PBN: Record<string, string> = {
  A: "A", K: "K", Q: "Q", J: "J", "10": "T", "9": "9",
  "8": "8", "7": "7", "6": "6", "5": "5", "4": "4",
  "3": "3", "2": "2", T: "T",
};

function handToPBN(hand: { S: string[]; H: string[]; D: string[]; C: string[] }): string {
  const suits = ["S", "H", "D", "C"] as const;
  return suits
    .map((suit) => hand[suit].map((c) => RANK_TO_PBN[c] || c).join(""))
    .join(".");
}

export function boardHandsToPBN(hands: BoardHands, dealer: Direction = "N"): string {
  const order: Direction[] = ["N", "E", "S", "W"];
  // Rotate to start from dealer
  const dealerIdx = order.indexOf(dealer);
  const rotated = [...order.slice(dealerIdx), ...order.slice(0, dealerIdx)];

  const handStrings = rotated.map((dir) => handToPBN(hands[dir]));
  return `${dealer}:${handStrings.join(" ")}`;
}
