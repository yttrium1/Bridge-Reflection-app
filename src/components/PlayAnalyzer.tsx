"use client";

import { useState, useEffect, useRef } from "react";
import type { BoardHands, Direction, Hand } from "@/lib/bridge/types";
import {
  PlayedCard,
  CompletedTrick,
  getNextPlayer,
  getLeader,
  determineTrickWinner,
  removeCardFromHand,
  isSameSide,
} from "@/lib/bridge/play-utils";

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  S: { symbol: "♠", color: "text-blue-900" },
  H: { symbol: "♥", color: "text-red-600" },
  D: { symbol: "♦", color: "text-orange-500" },
  C: { symbol: "♣", color: "text-green-700" },
};

interface AnalysisResult {
  suit: string;
  rank: string;
  tricks: number;
}

interface PlayAnalyzerProps {
  hands: BoardHands;
  declarer: Direction;
  trump: string;
  contract?: string;
  myDirections?: Direction[];
}

export default function PlayAnalyzer({ hands, declarer, trump, contract, myDirections }: PlayAnalyzerProps) {
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
  const [analysisTrigger, setAnalysisTrigger] = useState(0);

  const isGameOver = completedTricks.length === 13;

  // Use ref to store latest state for fetch
  const stateRef = useRef({ remainingHands, currentTrick, nextPlayer });
  stateRef.current = { remainingHands, currentTrick, nextPlayer };

  const fetchVersion = useRef(0);

  useEffect(() => {
    if (!showAnalysis || isGameOver) return;

    fetchVersion.current++;
    const thisVersion = fetchVersion.current;
    const { remainingHands: rh, currentTrick: ct, nextPlayer: np } = stateRef.current;

    const doFetch = async () => {
      setAnalyzing(true);
      try {
        const handsForApi: Record<string, Record<string, string[]>> = {};
        for (const dir of ["N", "E", "S", "W"] as Direction[]) {
          handsForApi[dir] = {
            S: [...rh[dir].S],
            H: [...rh[dir].H],
            D: [...rh[dir].D],
            C: [...rh[dir].C],
          };
        }
        const trickCards = ct.map(c => ({ suit: c.suit, rank: c.rank }));
        const res = await fetch("/api/play-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hands: handsForApi, currentTrick: trickCards, nextPlayer: np, trump }),
        });
        if (thisVersion !== fetchVersion.current) return;
        if (res.ok) {
          const data = await res.json();
          setAnalysis(data.analysis || []);
        } else {
          setAnalysis([]);
        }
      } catch {
        if (thisVersion === fetchVersion.current) setAnalysis([]);
      }
      if (thisVersion === fetchVersion.current) setAnalyzing(false);
    };

    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisTrigger, showAnalysis, isGameOver, trump]);

  const getCardHighlight = (suit: string, rank: string): string => {
    if (!showAnalysis || analysis.length === 0) return "";
    const maxTricks = analysis[0]?.tricks ?? 0;
    const cardResult = analysis.find(a => a.suit === suit && a.rank === rank);
    if (!cardResult) return "";
    const diff = maxTricks - cardResult.tricks;
    if (diff === 0) return "text-green-600 font-black";
    if (diff === 1) return "text-yellow-600";
    return "text-red-500";
  };

  const getCardTricks = (suit: string, rank: string): number | null => {
    if (!showAnalysis) return null;
    const cardResult = analysis.find(a => a.suit === suit && a.rank === rank);
    return cardResult ? cardResult.tricks : null;
  };

  const isCardPlayable = (dir: Direction, suit: string): boolean => {
    if (dir !== nextPlayer || isGameOver) return false;
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

    const newHands: BoardHands = {
      N: { S: [...remainingHands.N.S], H: [...remainingHands.N.H], D: [...remainingHands.N.D], C: [...remainingHands.N.C] },
      E: { S: [...remainingHands.E.S], H: [...remainingHands.E.H], D: [...remainingHands.E.D], C: [...remainingHands.E.C] },
      S: { S: [...remainingHands.S.S], H: [...remainingHands.S.H], D: [...remainingHands.S.D], C: [...remainingHands.S.C] },
      W: { S: [...remainingHands.W.S], H: [...remainingHands.W.H], D: [...remainingHands.W.D], C: [...remainingHands.W.C] },
    };
    newHands[dir] = removeCardFromHand(newHands[dir], suit, rank);
    setRemainingHands(newHands);

    const newTrick = [...currentTrick, playedCard];
    if (newTrick.length === 4) {
      const trumpSuit = trump === "NT" ? "" : trump;
      const winner = determineTrickWinner(newTrick, trumpSuit);
      setCompletedTricks(prev => [...prev, { cards: newTrick, winner, leadSuit: newTrick[0].suit }]);
      setCurrentTrick([]);
      setNextPlayer(winner);
      if (winner === "N" || winner === "S") setNsTricks(prev => prev + 1);
      else setEwTricks(prev => prev + 1);
    } else {
      setCurrentTrick(newTrick);
      setNextPlayer(getNextPlayer(dir));
    }

    // Trigger analysis on next tick after all state updates
    setTimeout(() => setAnalysisTrigger(prev => prev + 1), 50);
  };

  const resetPlay = () => {
    setRemainingHands({
      N: { S: [...hands.N.S], H: [...hands.N.H], D: [...hands.N.D], C: [...hands.N.C] },
      E: { S: [...hands.E.S], H: [...hands.E.H], D: [...hands.E.D], C: [...hands.E.C] },
      S: { S: [...hands.S.S], H: [...hands.S.H], D: [...hands.S.D], C: [...hands.S.C] },
      W: { S: [...hands.W.S], H: [...hands.W.H], D: [...hands.W.D], C: [...hands.W.C] },
    });
    setCompletedTricks([]);
    setCurrentTrick([]);
    setNextPlayer(getLeader(declarer));
    setAnalysis([]);
    setNsTricks(0);
    setEwTricks(0);
    setPlayHistory([]);
    setTimeout(() => setAnalysisTrigger(prev => prev + 1), 50);
  };

  const undoLastPlay = () => {
    if (playHistory.length === 0) return;
    const historyWithoutLast = playHistory.slice(0, -1);
    let tempHands: BoardHands = {
      N: { S: [...hands.N.S], H: [...hands.N.H], D: [...hands.N.D], C: [...hands.N.C] },
      E: { S: [...hands.E.S], H: [...hands.E.H], D: [...hands.E.D], C: [...hands.E.C] },
      S: { S: [...hands.S.S], H: [...hands.S.H], D: [...hands.S.D], C: [...hands.S.C] },
      W: { S: [...hands.W.S], H: [...hands.W.H], D: [...hands.W.D], C: [...hands.W.C] },
    };
    let tempTricks: CompletedTrick[] = [];
    let tempCurrentTrick: PlayedCard[] = [];
    let tempNextPlayer: Direction = getLeader(declarer);
    let tempNs = 0, tempEw = 0;

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
    setTimeout(() => setAnalysisTrigger(prev => prev + 1), 50);
  };

  const suboptimalPlays = playHistory.filter(h => !h.wasOptimal).length;
  const totalTricksLost = playHistory.reduce((sum, h) => sum + h.tricksDiff, 0);
  const declarerSide = declarer === "N" || declarer === "S" ? "NS" : "EW";
  const declarerTricks = declarerSide === "NS" ? nsTricks : ewTricks;
  const defenseTricks = declarerSide === "NS" ? ewTricks : nsTricks;

  const isMyDir = (d: string) => myDirections?.includes(d as Direction) ?? false;

  // Render hand in HandDiagram style (suit rows)
  const renderHandSuits = (dir: Direction) => {
    const hand = remainingHands[dir];
    const isActive = dir === nextPlayer && !isGameOver;

    return (
      <div className="leading-snug">
        <div className={`font-bold text-xs mb-0.5 ${isMyDir(dir) ? "text-blue-600" : "text-gray-400"}`}>
          {dir === "N" ? "North" : dir === "S" ? "South" : dir === "E" ? "East" : "West"}
          {isActive && <span className="ml-1 text-green-600 animate-pulse">◀</span>}
        </div>
        {(["S", "H", "D", "C"] as const).map((suit) => (
          <div key={suit} className="flex items-center gap-1 whitespace-nowrap">
            <span className={`text-lg font-bold ${SUIT_SYMBOLS[suit].color}`}>
              {SUIT_SYMBOLS[suit].symbol}
            </span>
            <span className="font-mono text-base tracking-tight flex gap-px">
              {hand[suit].length > 0 ? hand[suit].map(rank => {
                const playable = isCardPlayable(dir, suit);
                const highlight = getCardHighlight(suit, rank);
                const tricks = getCardTricks(suit, rank);

                return (
                  <span
                    key={rank}
                    onClick={() => playable && playCard(dir, suit, rank)}
                    className={`
                      ${playable ? "cursor-pointer hover:bg-green-100 rounded px-0.5 transition-colors" : ""}
                      ${highlight}
                    `}
                    title={tricks !== null && playable ? `${tricks}トリック` : undefined}
                  >
                    {rank}
                  </span>
                );
              }) : <span className="text-gray-300">—</span>}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const trumpDisplay = trump === "NT" ? "NT" : (SUIT_SYMBOLS[trump]?.symbol || trump);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-700">プレイ解析</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showAnalysis} onChange={() => setShowAnalysis(!showAnalysis)} className="rounded" />
            最適手表示
          </label>
          <button onClick={undoLastPlay} disabled={playHistory.length === 0}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30">戻す</button>
          <button onClick={resetPlay} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">リセット</button>
        </div>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-3 mb-4 p-2 bg-gray-50 rounded-lg text-sm">
        <span className="font-bold text-blue-700">NS: {nsTricks}</span>
        <span className="text-gray-300">|</span>
        <span className="font-bold text-red-600">EW: {ewTricks}</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500">Trick {Math.min(completedTricks.length + 1, 13)}/13</span>
        {analyzing && (
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            解析中
          </span>
        )}
      </div>

      {/* Hand diagram layout (same as HandDiagram component) */}
      <div className="grid grid-cols-3 grid-rows-3 gap-2 max-w-md mx-auto mb-4">
        {/* Top-left: contract info */}
        <div className="col-start-1 row-start-1 flex flex-col justify-center">
          {contract && (
            <div className="text-lg font-bold text-gray-800 mb-1" dangerouslySetInnerHTML={{
              __html: contract
                .replace(/♠/g, '<span class="text-blue-900">♠</span>')
                .replace(/♥/g, '<span class="text-red-600">♥</span>')
                .replace(/♦/g, '<span class="text-orange-500">♦</span>')
                .replace(/♣/g, '<span class="text-green-700">♣</span>')
            }} />
          )}
          <div className="text-xs text-gray-500 leading-relaxed">
            <div>Trump: <strong>{trumpDisplay}</strong></div>
          </div>
        </div>
        {/* North */}
        <div className="col-start-2 row-start-1 flex justify-center">
          {renderHandSuits("N")}
        </div>
        {/* empty top-right */}
        <div className="col-start-3 row-start-1" />
        {/* West */}
        <div className="col-start-1 row-start-2 flex items-center">
          {renderHandSuits("W")}
        </div>
        {/* Center - cross layout for played cards */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <div className="w-28 h-28 border-2 border-[#1a5c2e] rounded-lg bg-[#f0f7f2] relative">
            {currentTrick.length === 0 && !isGameOver && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                {nextPlayer}がリード
              </div>
            )}
            {isGameOver && currentTrick.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                終了
              </div>
            )}
            {/* N position - top center */}
            {currentTrick.find(c => c.player === "N") && (() => {
              const card = currentTrick.find(c => c.player === "N")!;
              return (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 text-sm">
                  <span className={`font-bold ${SUIT_SYMBOLS[card.suit].color}`}>{SUIT_SYMBOLS[card.suit].symbol}</span>
                  <span className="font-mono">{card.rank}</span>
                </div>
              );
            })()}
            {/* S position - bottom center */}
            {currentTrick.find(c => c.player === "S") && (() => {
              const card = currentTrick.find(c => c.player === "S")!;
              return (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 text-sm">
                  <span className={`font-bold ${SUIT_SYMBOLS[card.suit].color}`}>{SUIT_SYMBOLS[card.suit].symbol}</span>
                  <span className="font-mono">{card.rank}</span>
                </div>
              );
            })()}
            {/* W position - left center */}
            {currentTrick.find(c => c.player === "W") && (() => {
              const card = currentTrick.find(c => c.player === "W")!;
              return (
                <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-sm">
                  <span className={`font-bold ${SUIT_SYMBOLS[card.suit].color}`}>{SUIT_SYMBOLS[card.suit].symbol}</span>
                  <span className="font-mono">{card.rank}</span>
                </div>
              );
            })()}
            {/* E position - right center */}
            {currentTrick.find(c => c.player === "E") && (() => {
              const card = currentTrick.find(c => c.player === "E")!;
              return (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-sm">
                  <span className={`font-bold ${SUIT_SYMBOLS[card.suit].color}`}>{SUIT_SYMBOLS[card.suit].symbol}</span>
                  <span className="font-mono">{card.rank}</span>
                </div>
              );
            })()}
          </div>
        </div>
        {/* East */}
        <div className="col-start-3 row-start-2 flex items-center justify-end">
          {renderHandSuits("E")}
        </div>
        {/* empty bottom-left */}
        <div className="col-start-1 row-start-3" />
        {/* South */}
        <div className="col-start-2 row-start-3 flex justify-center">
          {renderHandSuits("S")}
        </div>
      </div>

      {/* Legend */}
      {showAnalysis && (
        <div className="flex items-center gap-4 mb-3 text-[10px] text-gray-500">
          <span><span className="text-green-600 font-black">A</span> 最適手</span>
          <span><span className="text-yellow-600">A</span> -1トリック</span>
          <span><span className="text-red-500">A</span> -2以上</span>
          <span className="ml-auto">クリックでカードをプレイ</span>
        </div>
      )}

      {/* Completed tricks history */}
      {completedTricks.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <h4 className="text-xs font-bold text-gray-500 mb-2">プレイ履歴</h4>
          <div className="grid grid-cols-7 sm:grid-cols-13 gap-1">
            {completedTricks.map((trick, i) => (
              <div key={i} className={`p-1 rounded text-[9px] border ${
                isSameSide(trick.winner, declarer) ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"
              }`}>
                <div className="font-bold text-center text-[8px] mb-0.5">T{i + 1}</div>
                {trick.cards.map((card, j) => (
                  <div key={j} className={`flex items-center gap-px ${card.player === trick.winner ? "font-bold" : ""}`}>
                    <span className="text-gray-400 w-2.5 text-[8px]">{card.player}</span>
                    <span className={`${SUIT_SYMBOLS[card.suit].color} text-[9px]`}>{SUIT_SYMBOLS[card.suit].symbol}</span>
                    <span className="text-[9px]">{card.rank}</span>
                  </div>
                ))}
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
            <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-500">
              最適手でなかったプレイ: <strong className="text-red-600">{suboptimalPlays}回</strong>
              {totalTricksLost > 0 && (
                <span className="ml-2">(合計 <strong className="text-red-600">{totalTricksLost}トリック</strong> 損失の可能性)</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
