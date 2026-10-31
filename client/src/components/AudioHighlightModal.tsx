"use client";

import { useState } from "react";
import { X, Sparkles, Volume2, ShieldCheck, AlertCircle, Loader2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface AudioHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  userBalance: number;
  onSuccess: (updatedBalance: number) => void;
}

export default function AudioHighlightModal({
  isOpen,
  onClose,
  token,
  userBalance,
  onSuccess,
}: AudioHighlightModalProps) {
  const [message, setMessage] = useState<string>("");
  const [actionType, setActionType] = useState<"keep" | "drop">("keep");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const HIGHLIGHT_FEE = 5000;
  const isBalanceEnough = userBalance >= HIGHLIGHT_FEE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Vui lòng nhập nội dung bình luận.");
      return;
    }

    if (message.trim().length > 100) {
      setError("Bình luận tối đa 100 ký tự.");
      return;
    }

    if (!isBalanceEnough) {
      setError("Số dư trong ví không đủ 5.000 VNĐ. Vui lòng bấm [+ Nạp 20k] ở thanh trên cùng!");
      return;
    }

    setLoading(true);
    const API_URL = API_BASE_URL;

    try {
      const res = await fetch(`${API_URL}/api/posts/highlight-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          actionType,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Ghim thất bại.");
      } else {
        onSuccess(data.balance);
        setMessage("");
        onClose();
      }
    } catch {
      setError("Lỗi kết nối máy chủ khi ghim bình luận.");
    } finally {
      setLoading(false);
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(num);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-sm sm:max-w-md bg-neutral-900 border border-amber-500/50 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-black text-sm text-amber-300 tracking-wide flex items-center gap-1.5">
                <span>VIP AUDIO HIGHLIGHT</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                  5.000đ
                </span>
              </h2>
              <p className="text-[10px] text-neutral-400">Ghim thông điệp + Đọc TTS + Thao túng 10 giây</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* User Balance Status */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
            <span className="text-neutral-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Số dư ví hiện tại:
            </span>
            <span className={`font-mono font-bold ${isBalanceEnough ? "text-amber-300" : "text-red-400"}`}>
              {formatVND(userBalance)}
            </span>
          </div>

          {/* Comment Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-neutral-300 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                Nội dung bình luận VIP:
              </label>
              <span className={`font-mono text-[10px] ${message.length > 90 ? "text-amber-400" : "text-neutral-500"}`}>
                {message.length}/100
              </span>
            </div>
            <textarea
              required
              rows={2}
              maxLength={100}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập thông điệp sẽ được đọc to toàn phòng chiếu..."
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-400 font-sans resize-none"
            />
          </div>

          {/* Choose 1 of 2 Impacts */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300">
              Chọn tác động lên thời gian bài phát sóng:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Keep (+10s Cứu bài) */}
              <button
                type="button"
                onClick={() => setActionType("keep")}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  actionType === "keep"
                    ? "bg-emerald-950/60 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/50"
                    : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-black text-xs text-emerald-300">+10 GIÂY</span>
                </div>
                <div className="text-[11px] font-bold text-white mt-1">Cứu bài</div>
                <div className="text-[9px] text-neutral-400">Gia hạn thời gian sống sót</div>
              </button>

              {/* Option 2: Drop (-10s Dìm bài) */}
              <button
                type="button"
                onClick={() => setActionType("drop")}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  actionType === "drop"
                    ? "bg-red-950/60 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-2 ring-red-500/50"
                    : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ArrowDownCircle className="w-4 h-4 text-red-400" />
                  <span className="font-black text-xs text-red-300">-10 GIÂY</span>
                </div>
                <div className="text-[11px] font-bold text-white mt-1">Dìm bài</div>
                <div className="text-[9px] text-neutral-400">Cắt ngắn để đổi bài ngay</div>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isBalanceEnough}
            className="w-full py-3 px-4 rounded-2xl font-black text-xs tracking-wider uppercase bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang truyền phát thanh...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>XÁC NHẬN GHIM VIP (5.000 VNĐ)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
