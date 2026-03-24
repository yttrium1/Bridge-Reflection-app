"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      router.push("/tournaments");
    } catch (err) {
      setError(err instanceof Error && err.message.includes("許可されていません") ? err.message : "登録に失敗しました。メールアドレスが既に使われている可能性があります。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f1]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1a5c2e]">Bridge Post-Mortem</h1>
          <p className="text-sm text-gray-500 mt-1">トーナメント振り返りツール</p>
          <p className="text-[10px] text-gray-400 mt-0.5">by yttrium</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg p-8 space-y-5"
        >
          <h2 className="text-xl font-bold text-gray-800">新規登録</h2>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              パスワード（確認）
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] focus:border-transparent text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1a5c2e] hover:bg-[#2d8a4e] text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "登録中..." : "登録"}
          </button>
          <p className="text-center text-sm text-gray-500">
            既にアカウントをお持ちの方は{" "}
            <Link href="/login" className="text-[#1a5c2e] font-bold hover:underline">
              ログイン
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
