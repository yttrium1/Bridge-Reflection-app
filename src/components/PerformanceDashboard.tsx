"use client";

import type { TournamentData } from "@/lib/bridge/types";

interface TournamentWithAvg {
  id: string;
  name: string;
  date: string;
  scoringType: string;
  avgScore: number | null;
}

export default function PerformanceDashboard({
  tournaments,
  tournamentAverages,
}: {
  tournaments: TournamentData[];
  tournamentAverages: Map<string, number>;
}) {
  // Only show for MP tournaments with averages
  const mpTournaments: TournamentWithAvg[] = tournaments
    .filter(t => !t.scoringType || t.scoringType === "MP")
    .map(t => ({
      id: t.id || "",
      name: t.name,
      date: t.date,
      scoringType: t.scoringType || "MP",
      avgScore: tournamentAverages.get(t.id || "") ?? null,
    }))
    .filter(t => t.avgScore !== null)
    .reverse(); // chronological order

  const impTournaments: TournamentWithAvg[] = tournaments
    .filter(t => t.scoringType === "IMP" || t.scoringType === "DAT")
    .map(t => ({
      id: t.id || "",
      name: t.name,
      date: t.date,
      scoringType: t.scoringType || "IMP",
      avgScore: tournamentAverages.get(t.id || "") ?? null,
    }))
    .filter(t => t.avgScore !== null)
    .reverse();

  if (mpTournaments.length === 0 && impTournaments.length === 0) return null;

  const overallMpAvg = mpTournaments.length > 0
    ? mpTournaments.reduce((s, t) => s + (t.avgScore || 0), 0) / mpTournaments.length
    : null;

  const overallImpAvg = impTournaments.length > 0
    ? impTournaments.reduce((s, t) => s + (t.avgScore || 0), 0) / impTournaments.length
    : null;

  // Simple bar chart for MP
  const mpMax = mpTournaments.length > 0 ? Math.max(...mpTournaments.map(t => t.avgScore || 0), 100) : 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
      <h3 className="text-sm font-bold text-gray-700 mb-4">パフォーマンス</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {overallMpAvg !== null && (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-gray-400">MP平均 ({mpTournaments.length}大会)</div>
            <div className={`text-2xl font-bold ${overallMpAvg >= 55 ? "text-blue-600" : overallMpAvg <= 45 ? "text-red-600" : "text-gray-700"}`}>
              {overallMpAvg.toFixed(1)}%
            </div>
          </div>
        )}
        {overallImpAvg !== null && (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-gray-400">IMP/DAT平均 ({impTournaments.length}大会)</div>
            <div className={`text-2xl font-bold ${overallImpAvg > 0 ? "text-blue-600" : overallImpAvg < 0 ? "text-red-600" : "text-gray-700"}`}>
              {overallImpAvg > 0 ? "+" : ""}{overallImpAvg.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* MP bar chart */}
      {mpTournaments.length >= 2 && (
        <div className="mb-3">
          <div className="text-[10px] text-gray-400 mb-2">MP% 推移</div>
          <div className="flex items-end gap-1 h-20">
            {mpTournaments.map((t) => {
              const pct = ((t.avgScore || 0) / mpMax) * 100;
              const isGood = (t.avgScore || 0) >= 55;
              const isBad = (t.avgScore || 0) <= 45;
              return (
                <div key={t.id} className="flex-1 flex flex-col items-center gap-0.5" title={`${t.name}: ${(t.avgScore || 0).toFixed(1)}%`}>
                  <span className="text-[8px] text-gray-400">{(t.avgScore || 0).toFixed(0)}</span>
                  <div
                    className={`w-full rounded-t ${isGood ? "bg-blue-400" : isBad ? "bg-red-400" : "bg-gray-300"}`}
                    style={{ height: `${Math.max(pct * 0.7, 4)}%` }}
                  />
                  <span className="text-[7px] text-gray-400 truncate w-full text-center">{t.date.slice(5, 10)}</span>
                </div>
              );
            })}
          </div>
          {/* 50% line */}
          <div className="relative -mt-[52px] h-0 border-t border-dashed border-gray-300 pointer-events-none" style={{ marginBottom: "52px" }}>
            <span className="absolute -top-2 -left-1 text-[7px] text-gray-300">50%</span>
          </div>
        </div>
      )}
    </div>
  );
}
