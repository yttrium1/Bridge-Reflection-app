export type Suit = "S" | "H" | "D" | "C";
export type Denomination = Suit | "NT";
export type Direction = "N" | "E" | "S" | "W";
export type Rank = "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
export type Vulnerability = "None" | "NS" | "EW" | "Both";

export interface Hand {
  S: string[];
  H: string[];
  D: string[];
  C: string[];
}

export interface BoardHands {
  N: Hand;
  E: Hand;
  S: Hand;
  W: Hand;
}

export interface TravellerRow {
  ns: number;
  ew: number;
  contract: string;
  declarer: string;
  result: number;
  nsScore: number;
  ewScore: number;
  mp: number;
}

export interface DDSTable {
  N: Record<Denomination, number>;
  E: Record<Denomination, number>;
  S: Record<Denomination, number>;
  W: Record<Denomination, number>;
}

export interface BidEntry {
  seat: Direction;
  bid: string;
}

export interface EditHistoryEntry {
  timestamp: string;
  editor: string; // email or "Guest"
  field: "bidding" | "comment";
  oldValue: string;
  newValue: string;
}

export interface BoardData {
  boardNumber: number;
  dealer: string;
  vulnerability: Vulnerability;
  hands: BoardHands;
  travellers: TravellerRow[];
  ddsTable: DDSTable | null;
  bidding: BidEntry[] | null;
  comment: string | null;
  editHistory?: EditHistoryEntry[];
}

export interface TournamentData {
  id?: string;
  sourceUrl: string;
  tournamentCode: string;
  eventId: string;
  name: string;
  date: string;
  pairNumber: number;
  partnerName?: string;
  ranking?: string;
  sessionNumber?: string;
  totalBoards: number;
  shareToken?: string;
  ownerUid?: string;
  createdAt?: Date;
}
