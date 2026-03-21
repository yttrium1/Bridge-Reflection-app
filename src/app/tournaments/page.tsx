"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import type { TournamentData } from "@/lib/bridge/types";

export default function TournamentsPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchTournaments = async () => {
      try {
        const q = query(
          collection(db, "users", user.uid, "tournaments"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TournamentData[];
        setTournaments(data);
      } catch (err) {
        console.error("Failed to fetch tournaments:", err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchTournaments();
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      {/* Header */}
      <header className="bg-[#1a5c2e] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Bridge Post-Mortem</h1>
            <p className="text-[10px] text-green-300/60">by yttrium</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-green-200">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">大会一覧</h2>
          <Link
            href="/tournaments/new"
            className="px-4 py-2 bg-[#1a5c2e] hover:bg-[#2d8a4e] text-white rounded-lg text-sm font-bold transition-colors"
          >
            + 新規インポート
          </Link>
        </div>

        {loadingData ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <div className="text-5xl mb-4 opacity-30">{"\u2660\u2665\u2666\u2663"}</div>
            <p className="text-gray-500 mb-4">まだ大会データがありません</p>
            <Link
              href="/tournaments/new"
              className="inline-block px-6 py-2.5 bg-[#1a5c2e] hover:bg-[#2d8a4e] text-white rounded-lg text-sm font-bold transition-colors"
            >
              最初の大会をインポート
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow border border-gray-100 block"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800">
                      {t.name}
                      {t.sessionNumber && <span className="text-sm font-normal text-gray-500"> Session {t.sessionNumber}</span>}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{t.date}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      ペア番号: {t.pairNumber}
                      {t.partnerName && ` | ${t.partnerName}`}
                      {t.ranking && ` | 順位: ${t.ranking}`}
                      {` | ${t.totalBoards}ボード`}
                    </p>
                  </div>
                  <span className="text-gray-300 text-xl">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
