"use client";

import { useState, useEffect, useCallback } from "react";
import type { BoardHands, Direction, Hand } from "@/lib/bridge/types";
import {
  PlayedCard,
  CompletedTrick,
  getNextPlayer,
  getLeader,
  determineTrickWinner,
  removeCardFromHand,
  getPlayableCards,
  isSameSide,
} from "@/lib/bridge/play-utils";

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  S: { symbol: "♠", color: "text-blue-900" },
  H: { symbol: "♥", color: "text-red-600" },
  D: { symbol: "♦", color: "text-orange-500" },
  C: { symbol: "♣", color: "text-green-700" },
};

const RANK_SORT: Record<string, number> = {
  A: 0, K: 1, Q: 2, J: 3, "10": 4, "9": 5, "8": 6, "7": 7, "6": 8, "5": 9, "4": 10, "3": 11, "2": 12,
};

interface AnalysisResult {
  suit: string;
  rank: string;
  tricks: number;
}

interface PlayAnalyzerProps {
  hands: BoardHands;
  declarer: Direction;
  trump: string; // "S"|"H"|"D"|"C"|"NT"
  myDirections?: Direction[];
}

export default function PlayAnalyzer({ hands, declarer, trump, myDirections }: PlayAnalyzerProps) {
  const [remainingHands, setRemainingHands] = useState<BoardHands>({ ...hands });
  const [completedTricks, setCompletedTricks] = useState<CompletedTrick[]>([]);
  const [currentTrick, setCurrentTrick] = useState<PlayedCard[]>([]);
  const [nextPlayer, setNextPlayer] = useState<Direction>(getLeader(declarer));
  const [analysis, setAnalysis] = useState<AnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [nsTricks, setNsTricks] = useState(0);
  const [ewTricks, setEwTricks] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [playHistory, setPlayHistory] = useState<{ card: PlayedCard; wasOptimal: boolean; tricksDiff: number }[]>([]);

  const isGameOver = completedTricks.length === 13;

  // Fetch analysis for current position
  const fetchAnalysis = useCallback(async () => {
    if (isGameOver) return;
    setAnalyzing(true);
    try {
      const handsForApi: Record<string, Record<string, string[]>> = {};
      for (const dir of ["N", "E", "S", "W"] as Direction[]) {
        handsForApi[dir] = {
          S: remainingHands[dir].S,
          H: remainingHands[dir].H,
          D: remainingHands[dir].D,
          C: remainingHands[dir].C,
        };
      }

      const trickCards = currentTrick.map(c => ({ suit: c.suit, rank: c.rank }));

      const res = await fetch("/api/play-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hands: handsForApi,
          currentTrick: trickCards,
          nextPlayer,
          trump,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis || []);
      } else {
        setAnalysis([]);
      }
    } catch {
      setAnalysis([]);
    }
    setAnalyzing(false);
  }, [remainingHands, currentTrick, nextPlayer, trump, isGameOver]);

  useEffect(() => {
    if (showAnalysis && !isGameOver) {
      fetchAnalysis();
    }
  }, [fetchAnalysis, showAnalysis, isGameOver]);

  const getCardColor = (suit: string, rank: string): string => {
    if (!showAnalysis || analysis.length === 0) return "";
    const maxTricks = analysis[0]?.tricks ?? 0;
    const cardResult = analysis.find(a => a.suit === suit && a.rank === rank);
    if (!cardResult) return "";
    const diff = maxTricks - cardResult.tricks;
    if (diff === 0) return "ring-2 ring-green-500 bg-green-50";
    if (diff === 1) return "ring-2 ring-yellow-500 bg-yellow-50";
    return "ring-2 ring-red-400 bg-red-50";
  };

  const getCardTricks = (suit: string, rank: string): number | null => {
    if (!showAnalysis) return null;
    const cardResult = analysis.find(a => a.suit === suit && a.rank === rank);
    return cardResult ? cardResult.tricks : null;
  };

  const isCardPlayable = (dir: Direction, suit: string): boolean => {
    if (dir !== nextPlayer) return false;
    if (isGameOver) return false;

    const leadSuit = currentTrick.length > 0 ? currentTrick[0].suit : null;
    if (leadSuit && remainingHands[dir][leadSuit as keyof Hand].length > 0) {
      return suit === leadSuit;
    }
    return true;
  };

  const playCard = (dir: Direction, suit: string, rank: string) => {
    if (dir !== nextPlayer || isGameOver) return;

    const playedCard: PlayedCard = { suit, rank, player: dir };
    const maxTricks = analysis.length > 0 ? analysis[0].tricks : 0;
    const cardResult = analysis.find(a => a.suit === suit && a.rank === rank);
    const wasOptimal = cardResult ? cardResult.tricks === maxTricks : false;
    const tricksDiff = cardResult ? maxTricks - cardResult.tricks : 0;

    setPlayHistory(prev => [...prev, { card: playedCard, wasOptimal, tricksDiff }]);

    // Remove card from hand
    const newHands = { ...remainingHands };
    newHands[dir] = removeCardFromHand(remainingHands[dir], suit, rank);
    setRemainingHands(newHands);

    const newTrick = [...currentTrick, playedCard];

    if (newTrick.length === 4) {
      // Trick complete
      const trumpSuit = trump === "NT" ? "" : trump;
      const winner = determineTrickWinner(newTrick, trumpSuit);
      const completed: CompletedTrick = {
        cards: newTrick,
        winner,
        leadSuit: newTrick[0].suit,
      };

      setCompletedTricks(prev => [...prev, completed]);
      setCurrentTrick([]);
      setNextPlayer(winner);

      if (winner === "N" || winner === "S") {
        setNsTricks(prev => prev + 1);
      } else {
        setEwTricks(prev => prev + 1);
      }
    } else {
      setCurrentTrick(newTrick);
      setNextPlayer(getNextPlayer(dir));
    }
  };

  const resetPlay = () => {
    setRemainingHands({ ...hands });
    setCompletedTricks([]);
    setCurrentTrick([]);
    setNextPlayer(getLeader(declarer));
    setAnalysis([]);
    setNsTricks(0);
    setEwTricks(0);
    setPlayHistory([]);
  };

  const undoLastPlay = () => {
    if (playHistory.length === 0) return;

    // Full reset and replay all but last
    const historyWithoutLast = playHistory.slice(0, -1);
    setRemainingHands({ ...hands });
    setCompletedTricks([]);
    setCurrentTrick([]);
    setNextPlayer(getLeader(declarer));
    setNsTricks(0);
    setEwTricks(0);

    // Replay
    let tempHands: BoardHands = {
      N: { S: [...hands.N.S], H: [...hands.N.H], D: [...hands.N.D], C: [...hands.N.C] },
      E: { S: [...hands.E.S], H: [...hands.E.H], D: [...hands.E.D], C: [...hands.E.C] },
      S: { S: [...hands.S.S], H: [...hands.S.H], D: [...hands.S.D], C: [...hands.S.C] },
      W: { S: [...hands.W.S], H: [...hands.W.H], D: [...hands.W.D], C: [...hands.W.C] },
    };
    let tempTricks: CompletedTrick[] = [];
    let tempCurrentTrick: PlayedCard[] = [];
    let tempNextPlayer: Direction = getLeader(declarer);
    let tempNs = 0;
    let tempEw = 0;

    for (const entry of historyWithoutLast) {
      const { card } = entry;
      tempHands[card.player] = removeCardFromHand(tempHands[card.player], card.suit, card.rank);
      tempCurrentTrick.push(card);

      if (tempCurrentTrick.length === 4) {
        const trumpSuit = trump === "NT" ? "" : trump;
        const winner = determineTrickWinner(tempCurrentTrick, trumpSuit);
        tempTricks.push({ cards: tempCurrentTrick, winner, leadSuit: tempCurrentTrick[0].suit });
        tempCurrentTrick = [];
        tempNextPlayer = winner;
        if (winner === "N" || winner === "S") tempNs++;
        else tempEw++;
      } else {
        tempNextPlayer = getNextPlayer(card.player);
      }
    }

    setRemainingHands(tempHands);
    setCompletedTricks(tempTricks);
    setCurrentTrick(tempCurrentTrick);
    setNextPlayer(tempNextPlayer);
    setNsTricks(tempNs);
    setEwTricks(tempEw);
    setPlayHistory(historyWithoutLast);
  };

  // Count suboptimal plays
  const suboptimalPlays = playHistory.filter(h => !h.wasOptimal).length;
  const totalTricksLost = playHistory.reduce((sum, h) => sum + h.tricksDiff, 0);

  const declarerSide = declarer === "N" || declarer === "S" ? "NS" : "EW";
  const declarerTricks = declarerSide === "NS" ? nsTricks : ewTricks;
  const defenseTricks = declarerSide === "NS" ? ewTricks : nsTricks;

  const renderHand = (dir: Direction, position: string) => {
    const hand = remainingHands[dir];
    const isActive = dir === nextPlayer && !isGameOver;
    const isMyDir = myDirections?.includes(dir);

    return (
      <div className={`${position} flex flex-col items-center`}>
        <div className={`text-xs font-bold mb-1 ${isMyDir ? "text-blue-600 underline" : "text-gray-500"} ${isActive ? "animate-pulse" : ""}`}>
          {dir} {isActive && "◀"}
        </div>
        <div className="flex flex-wrap gap-0.5 justify-center max-w-[200px]">
          {(["S", "H", "D", "C"] as const).map(suit => (
            hand[suit].map(rank => {
              const playable = isCardPlayable(dir, suit);
              const colorClass = getCardColor(suit, rank);
              const tricks = getCardTricks(suit, rank);

              return (
                <button
                  key={`${suit}${rank}`}
                  onClick={() => playable && playCard(dir, suit, rank)}
                  disabled={!playable}
                  className={`
                    relative px-1.5 py-1 rounded text-xs font-mono border transition-all
                    ${playable ? "cursor-pointer hover:scale-110 border-gray-300 shadow-sm" : "cursor-default border-gray-200 opacity-60"}
                    ${colorClass}
                  `}
                  title={tricks !== null ? `${tricks}トリック` : undefined}
                >
                  <span className={`${SUIT_SYMBOLS[suit].color} font-bold`}>{SUIT_SYMBOLS[suit].symbol}</span>
                  <span className="text-gray-800">{rank}</span>
                  {tricks !== null && playable && (
                    <span className="absolute -top-2 -right-2 text-[9px] bg-gray-700 text-white rounded-full w-4 h-4 flex items-center justify-center">
                      {tricks}
                    </span>
                  )}
                </button>
              );
            })
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-700">
          プレイ解析
          <span className="text-xs font-normal text-gray-400 ml-2">
            {trump === "NT" ? "NT" : SUIT_SYMBOLS[trump]?.symbol} by {declarer}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showAnalysis}
              onChange={() => setShowAnalysis(!showAnalysis)}
              className="rounded"
            />
            最適手表示
          </label>
          <button
            onClick={undoLastPlay}
            disabled={playHistory.length === 0}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30"
          >
            戻す
          </button>
          <button
            onClick={resetPlay}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            リセット
          </button>
        </div>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-4 mb-4 p-2 bg-gray-50 rounded-lg text-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue-700">N-S: {nsTricks}</span>
          <span className="text-gray-400">|</span>
          <span className="font-bold text-red-600">E-W: {ewTricks}</span>
        </div>
        <div className="text-gray-400">|</div>
        <div className="text-xs text-gray-500">
          Trick {completedTricks.length + 1}/13
        </div>
        {analyzing && (
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            解析中
          </div>
        )}
      </div>

      {/* Play area */}
      <div className="grid grid-cols-3 grid-rows-3 gap-2 mb-4 min-h-[280px]">
        {/* North */}
        <div className="col-start-2 row-start-1">
          {renderHand("N", "")}
        </div>
        {/* West */}
        <div className="col-start-1 row-start-2 flex items-center">
          {renderHand("W", "")}
        </div>
        {/* Center - current trick */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <div className="w-28 h-28 border-2 border-[#1a5c2e] rounded-lg bg-[#f0f7f2] flex flex-col items-center justify-center gap-1 p-2">
            {currentTrick.length === 0 && completedTricks.length === 0 && (
              <div className="text-xs text-gray-400 text-center">
                {nextPlayer}がリード
              </div>
            )}
            {currentTrick.map((card, i) => (
              <div key={i} className="flex items-center gap-0.5 text-sm">
                <span className="text-[10px] text-gray-400">{card.player}</span>
                <span className={`font-bold ${SUIT_SYMBOLS[card.suit].color}`}>{SUIT_SYMBOLS[card.suit].symbol}</span>
                <span className="font-mono">{card.rank}</span>
              </div>
            ))}
          </div>
        </div>
        {/* East */}
        <div className="col-start-3 row-start-2 flex items-center justify-end">
          {renderHand("E", "")}
        </div>
        {/* South */}
        <div className="col-start-2 row-start-3">
          {renderHand("S", "")}
        </div>
      </div>

      {/* Legend */}
      {showAnalysis && (
        <div className="flex items-center gap-4 mb-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded ring-2 ring-green-500 bg-green-50 inline-block" /> 最適手
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded ring-2 ring-yellow-500 bg-yellow-50 inline-block" /> -1トリック
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded ring-2 ring-red-400 bg-red-50 inline-block" /> -2以上
          </span>
          <span className="ml-auto">カード上の数字 = そのカードを出した場合のトリック数</span>
        </div>
      )}

      {/* Completed tricks history */}
      {completedTricks.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <h4 className="text-xs font-bold text-gray-500 mb-2">プレイ履歴</h4>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {completedTricks.map((trick, i) => (
              <div
                key={i}
                className={`p-1.5 rounded text-[10px] border ${
                  isSameSide(trick.winner, declarer) ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"
                }`}
              >
                <div className="font-bold text-center mb-0.5">T{i + 1}</div>
                {trick.cards.map((card, j) => (
                  <div key={j} className={`flex items-center gap-0.5 ${card.player === trick.winner ? "font-bold" : ""}`}>
                    <span className="text-gray-400 w-3">{card.player}</span>
                    <span className={SUIT_SYMBOLS[card.suit].color}>{SUIT_SYMBOLS[card.suit].symbol}</span>
                    <span>{card.rank}</span>
                  </div>
                ))}
                <div className="text-center mt-0.5 text-gray-500">
                  ▲{trick.winner}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game over summary */}
      {isGameOver && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-bold text-gray-700 mb-2">解析結果サマリー</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">ディクレアラー ({declarerSide})</div>
              <div className="text-2xl font-bold text-blue-700">{declarerTricks}トリック</div>
            </div>
            <div>
              <div className="text-gray-500">ディフェンス</div>
              <div className="text-2xl font-bold text-red-600">{defenseTricks}トリック</div>
            </div>
          </div>
          {playHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
              <div className="text-gray-500">
                最適手でなかったプレイ: <strong className="text-red-600">{suboptimalPlays}回</strong>
                {totalTricksLost > 0 && (
                  <span className="ml-2">
                    (合計 <strong className="text-red-600">{totalTricksLost}トリック</strong> 損失の可能性)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
