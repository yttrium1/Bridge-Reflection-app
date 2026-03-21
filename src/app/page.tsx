"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/tournaments");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f1]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#1a5c2e] mb-2">Bridge Post-Mortem</h1>
        <p className="text-gray-500">読み込み中...</p>
      </div>
    </div>
  );
}
