"use client";

import { useState } from "react";
import { authApi, User } from "@/lib/api";
import { Radio, Lock, User as UserIcon, ArrowRight, Sparkles, AlertCircle, Loader2 } from "lucide-react";

interface AuthScreenProps {
  onSuccess: (token: string, user: User) => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const res = await authApi.login(username.trim(), password);
        if (res.error || !res.token || !res.user) {
          setError(res.error || "Đăng nhập thất bại. Vui lòng thử lại.");
        } else {
          onSuccess(res.token, res.user);
        }
      } else {
        const res = await authApi.register(username.trim(), password);
        if (res.error || !res.token || !res.user) {
          setError(res.error || "Đăng ký thất bại. Vui lòng kiểm tra lại.");
        } else {
          onSuccess(res.token, res.user);
        }
      }
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Cyber Ambient Lights */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600/30 to-amber-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-inner">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 bg-clip-text text-transparent">
              DROP60.LIVE
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-600/30 text-red-300 border border-red-500/30 uppercase tracking-widest animate-pulse">
              LIVE 24/7
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Sân khấu phát sóng đơn màn hình - Xác thực danh tính để gia nhập
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              isLogin
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            ĐĂNG NHẬP
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              !isLogin
                ? "bg-red-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            ĐĂNG KÝ
          </button>
        </div>

        {/* Bonus Notification on Register */}
        {!isLogin && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400 animate-bounce" />
            <span>Đặc quyền thử nghiệm: Tặng sẵn <strong>50.000 VNĐ</strong> vào tài khoản mới!</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-900/30 border border-red-500/40 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-neutral-400" />
              Tên tài khoản (Username)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ví dụ: gamer99"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
              Mật khẩu (Password)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? "VÀO SÂN KHẤU LIVE" : "TẠO TÀI KHOẢN & NHẬN 50K"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-neutral-500">
          DROP60.LIVE Platform &copy; 2026 &bull; Bảo mật bằng JWT & SQLite Local
        </div>
      </div>
    </div>
  );
}
