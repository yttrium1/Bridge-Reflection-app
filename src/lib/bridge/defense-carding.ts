import type { Hand, Direction } from "./types";
import { getPartner } from "./play-utils";

// ランク順序（高い → 低い）
const RANK_ORDER: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2,
};

interface CardOption {
  suit: string;
  rank: string;
  tricks: number;
}

/**
 * DDS最善手（同トリック数のカード群）から、カーディング法則に基づいて1枚を選択する。
 */
export function selectDefenseCard(
  bestCards: CardOption[],
  hand: Hand,
  currentTrickLength: number,
  isOpeningLead: boolean,
  trump: string,
  partnerBidSuits: string[],
): { suit: string; rank: string } {
  if (bestCards.length === 0) throw new Error("No best cards");
  if (bestCards.length === 1) return { suit: bestCards[0].suit, rank: bestCards[0].rank };

  const isLeading = currentTrickLength === 0;
  const is3rdHand = currentTrickLength === 2;

  // --- オープニングリード ---
  if (isOpeningLead && isLeading) {
    return selectOpeningLead(bestCards, hand, trump, partnerBidSuits);
  }

  // --- リード（2トリック目以降） ---
  if (isLeading) {
    return selectSubsequentLead(bestCards, hand);
  }

  // --- 3rd hand high: 3番目にプレイする場合、最も高いカードを出す ---
  if (is3rdHand) {
    return select3rdHandHigh(bestCards);
  }

  // --- フォロー（2番目 or 4番目）---
  return selectFollow(bestCards, hand);
}

/**
 * オープニングリード
 */
function selectOpeningLead(
  bestCards: CardOption[],
  hand: Hand,
  trump: string,
  partnerBidSuits: string[],
): { suit: string; rank: string } {
  // スーツごとにグループ化
  const suitGroups = groupBySuit(bestCards);
  const suits = Object.keys(suitGroups);

  // 複数スーツから選べる場合、パートナービッドスーツ優先
  let selectedSuit = suits[0];
  if (suits.length > 1 && partnerBidSuits.length > 0) {
    const partnerSuit = suits.find(s => partnerBidSuits.includes(s));
    if (partnerSuit) selectedSuit = partnerSuit;
  }

  const cardsInSuit = suitGroups[selectedSuit];
  const handSuit = hand[selectedSuit as keyof Hand];

  // 連続カードがあれば上から
  const seq = findSequenceTop(cardsInSuit, handSuit);
  if (seq) return { suit: selectedSuit, rank: seq };

  // スーツ長による選択
  const isNT = trump === "NT";
  if (isNT) {
    // NT: 上から4番目
    return selectNthFromTop(selectedSuit, handSuit, 4, cardsInSuit);
  } else {
    // スートコントラクト: 偶数→上から3番目、奇数→一番下
    if (handSuit.length % 2 === 0) {
      return selectNthFromTop(selectedSuit, handSuit, 3, cardsInSuit);
    } else {
      return selectBottom(selectedSuit, cardsInSuit);
    }
  }
}

/**
 * 2トリック目以降のリード: 連続カード → 上から
 */
function selectSubsequentLead(
  bestCards: CardOption[],
  hand: Hand,
): { suit: string; rank: string } {
  // スーツごとに処理（最初のスーツを使う）
  const suitGroups = groupBySuit(bestCards);
  const selectedSuit = Object.keys(suitGroups)[0];
  const cardsInSuit = suitGroups[selectedSuit];
  const handSuit = hand[selectedSuit as keyof Hand];

  // 連続カードがあれば上から
  const seq = findSequenceTop(cardsInSuit, handSuit);
  if (seq) return { suit: selectedSuit, rank: seq };

  // デフォルト: 最も上
  return selectTop(selectedSuit, cardsInSuit);
}

/**
 * 3rd hand high: 3番目にプレイする場合、最も高いカードを出す
 * 勝てる可能性があれば一番高いカードを選択
 */
function select3rdHandHigh(bestCards: CardOption[]): { suit: string; rank: string } {
  const sorted = sortByRankDesc(bestCards);
  // 最も高いランクのカードを返す
  return { suit: sorted[0].suit, rank: sorted[0].rank };
}

/**
 * フォロー: 連続カード → 下から、偶数/奇数ルール
 */
function selectFollow(
  bestCards: CardOption[],
  hand: Hand,
): { suit: string; rank: string } {
  // フォロー時はすべて同スーツのはず
  const suit = bestCards[0].suit;
  const sameSuitCards = bestCards.filter(c => c.suit === suit);

  if (sameSuitCards.length <= 1) {
    return { suit: bestCards[0].suit, rank: bestCards[0].rank };
  }

  const handSuit = hand[suit as keyof Hand];

  // 連続カードかチェック
  const seq = findSequenceBottom(sameSuitCards, handSuit);
  if (seq) return { suit, rank: seq };

  // 偶数/奇数ルール: 同スーツの最善手カード枚数で判定
  const count = sameSuitCards.length;
  if (count % 2 === 0) {
    // 偶数: 下から
    return selectBottom(suit, sameSuitCards);
  } else {
    // 奇数: 上から
    return selectTop(suit, sameSuitCards);
  }
}

// --- ヘルパー関数 ---

function groupBySuit(cards: CardOption[]): Record<string, CardOption[]> {
  const groups: Record<string, CardOption[]> = {};
  for (const c of cards) {
    if (!groups[c.suit]) groups[c.suit] = [];
    groups[c.suit].push(c);
  }
  // 各スーツ内をランク順（高→低）にソート
  for (const suit of Object.keys(groups)) {
    groups[suit].sort((a, b) => (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0));
  }
  return groups;
}

/** ランク順でソート（高→低） */
function sortByRankDesc(cards: CardOption[]): CardOption[] {
  return [...cards].sort((a, b) => (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0));
}

/** 手持ちのスーツ内で、最善手カードが連続しているか判定し、最も上を返す */
function findSequenceTop(bestCardsInSuit: CardOption[], handSuit: string[]): string | null {
  if (bestCardsInSuit.length < 2) return null;

  const sorted = sortByRankDesc(bestCardsInSuit);
  const handRanks = handSuit.map(r => RANK_ORDER[r] || 0).sort((a, b) => b - a);

  // 最善手カード同士が手札の中で連続しているかチェック
  for (let i = 0; i < sorted.length - 1; i++) {
    const r1 = RANK_ORDER[sorted[i].rank];
    const r2 = RANK_ORDER[sorted[i + 1].rank];
    // 手札内で隣接しているか（間に他のカードがない）
    const idx1 = handRanks.indexOf(r1);
    const idx2 = handRanks.indexOf(r2);
    if (idx1 >= 0 && idx2 >= 0 && Math.abs(idx1 - idx2) === 1) {
      // 連続している → 上を返す
      return sorted[0].rank;
    }
  }
  return null;
}

/** 手持ちのスーツ内で連続カードの最も下を返す */
function findSequenceBottom(bestCardsInSuit: CardOption[], handSuit: string[]): string | null {
  if (bestCardsInSuit.length < 2) return null;

  const sorted = sortByRankDesc(bestCardsInSuit);
  const handRanks = handSuit.map(r => RANK_ORDER[r] || 0).sort((a, b) => b - a);

  for (let i = 0; i < sorted.length - 1; i++) {
    const r1 = RANK_ORDER[sorted[i].rank];
    const r2 = RANK_ORDER[sorted[i + 1].rank];
    const idx1 = handRanks.indexOf(r1);
    const idx2 = handRanks.indexOf(r2);
    if (idx1 >= 0 && idx2 >= 0 && Math.abs(idx1 - idx2) === 1) {
      return sorted[sorted.length - 1].rank;
    }
  }
  return null;
}

/** 上からN番目を返す（最善手の中で最も近いものを選択） */
function selectNthFromTop(suit: string, handSuit: string[], n: number, bestCards: CardOption[]): { suit: string; rank: string } {
  const handRanks = handSuit.map(r => RANK_ORDER[r] || 0).sort((a, b) => b - a);
  const bestRanks = new Set(bestCards.map(c => RANK_ORDER[c.rank]));

  // 上からN番目（0-indexed: n-1）
  if (handRanks.length >= n) {
    const targetRank = handRanks[n - 1];
    if (bestRanks.has(targetRank)) {
      const rank = bestCards.find(c => RANK_ORDER[c.rank] === targetRank);
      if (rank) return { suit, rank: rank.rank };
    }
  }

  // N番目が最善手にない場合、最善手の中で最も近いものを選択
  const sorted = sortByRankDesc(bestCards);
  // N番目に近い（できるだけ低い）カードを選択
  return { suit, rank: sorted[Math.min(n - 1, sorted.length - 1)].rank };
}

/** 最も上（高ランク）を返す */
function selectTop(suit: string, cards: CardOption[]): { suit: string; rank: string } {
  const sorted = sortByRankDesc(cards);
  return { suit, rank: sorted[0].rank };
}

/** 最も下（低ランク）を返す */
function selectBottom(suit: string, cards: CardOption[]): { suit: string; rank: string } {
  const sorted = sortByRankDesc(cards);
  return { suit, rank: sorted[sorted.length - 1].rank };
}

/**
 * ビッド配列からパートナーがビッドしたスーツを取得
 */
export function getPartnerBidSuits(
  bidding: { seat: string; bid: string }[] | null,
  defender: Direction,
): string[] {
  if (!bidding || bidding.length === 0) return [];

  const partner = getPartner(defender);
  const suitMap: Record<string, string> = {
    C: "C", D: "D", H: "H", S: "S",
    "♣": "C", "♦": "D", "♥": "H", "♠": "S",
  };

  const suits: string[] = [];
  for (const entry of bidding) {
    if (entry.seat !== partner) continue;
    const bid = entry.bid;
    if (bid === "P" || bid === "X" || bid === "XX") continue;
    // "1H" -> "H", "2S" -> "S", etc.
    const suitChar = bid.replace(/[0-9]/g, "").replace("NT", "");
    if (suitMap[suitChar]) {
      suits.push(suitMap[suitChar]);
    }
  }
  return [...new Set(suits)];
}
