import type { Direction, Hand } from "./types";

export interface PlayedCard {
  suit: string;
  rank: string;
  player: Direction;
}

export interface CompletedTrick {
  cards: PlayedCard[];
  winner: Direction;
  leadSuit: string;
}

const NEXT_PLAYER: Record<Direction, Direction> = {
  N: "E", E: "S", S: "W", W: "N",
};

const RANK_ORDER: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2,
};

export function getNextPlayer(current: Direction): Direction {
  return NEXT_PLAYER[current];
}

export function getLeader(declarer: Direction): Direction {
  return NEXT_PLAYER[declarer];
}

export function getPartner(dir: Direction): Direction {
  return NEXT_PLAYER[NEXT_PLAYER[dir]];
}

export function isSameSide(a: Direction, b: Direction): boolean {
  return a === b || getPartner(a) === b;
}

export function determineTrickWinner(
  cards: PlayedCard[],
  trump: string
): Direction {
  if (cards.length !== 4) throw new Error("Trick must have exactly 4 cards");

  const leadSuit = cards[0].suit;
  let winner = cards[0];

  for (let i = 1; i < 4; i++) {
    const card = cards[i];
    const winnerIsTrump = winner.suit === trump;
    const cardIsTrump = card.suit === trump;

    if (cardIsTrump && !winnerIsTrump) {
      // Trump beats non-trump
      winner = card;
    } else if (cardIsTrump && winnerIsTrump) {
      // Both trump: higher rank wins
      if (RANK_ORDER[card.rank] > RANK_ORDER[winner.rank]) {
        winner = card;
      }
    } else if (!cardIsTrump && !winnerIsTrump) {
      // Neither trump: must follow lead suit, higher rank wins
      if (card.suit === leadSuit && winner.suit === leadSuit) {
        if (RANK_ORDER[card.rank] > RANK_ORDER[winner.rank]) {
          winner = card;
        }
      } else if (card.suit === leadSuit && winner.suit !== leadSuit) {
        winner = card;
      }
    }
  }

  return winner.player;
}

export function removeCardFromHand(
  hand: Hand,
  suit: string,
  rank: string
): Hand {
  const newHand: Hand = {
    S: [...hand.S],
    H: [...hand.H],
    D: [...hand.D],
    C: [...hand.C],
  };
  const suitKey = suit as keyof Hand;
  const idx = newHand[suitKey].indexOf(rank);
  if (idx !== -1) {
    newHand[suitKey].splice(idx, 1);
  }
  return newHand;
}

export function canFollowSuit(hand: Hand, leadSuit: string): boolean {
  const suitKey = leadSuit as keyof Hand;
  return hand[suitKey].length > 0;
}

export function getPlayableCards(
  hand: Hand,
  leadSuit: string | null
): { suit: string; rank: string }[] {
  const cards: { suit: string; rank: string }[] = [];

  if (leadSuit && canFollowSuit(hand, leadSuit)) {
    // Must follow suit
    const suitKey = leadSuit as keyof Hand;
    for (const rank of hand[suitKey]) {
      cards.push({ suit: leadSuit, rank });
    }
  } else {
    // Can play any card
    for (const suit of ["S", "H", "D", "C"] as const) {
      for (const rank of hand[suit]) {
        cards.push({ suit, rank });
      }
    }
  }

  return cards;
}

export function contractToTrump(contract: string): string {
  // Parse contract like "4S", "3NT", "5Hx", "2D"
  const clean = contract.replace(/[x]/gi, "").trim();
  if (clean.includes("NT") || clean.includes("N")) return "NT";
  const lastChar = clean[clean.length - 1];
  const suitMap: Record<string, string> = {
    S: "S", H: "H", D: "D", C: "C",
    "♠": "S", "♥": "H", "♦": "D", "♣": "C",
  };
  return suitMap[lastChar] || "NT";
}

export function contractToDeclarer(contract: string, declarerStr: string): Direction {
  const map: Record<string, Direction> = {
    N: "N", E: "E", S: "S", W: "W",
    North: "N", East: "E", South: "S", West: "W",
  };
  return map[declarerStr] || "N";
}
