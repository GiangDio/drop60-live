"use client";

import { useState } from "react";
import {
  X,
  PlusCircle,
  Sparkles,
  Image as ImageIcon,
  Music,
  Zap,
  Loader2,
  AlertCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  userBalance: number;
  onSuccess: (updatedBalance: number) => void;
}

const PRESET_IMAGES = [
  "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
];

export default function CreatePostModal({
  isOpen,
  onClose,
  token,
  userBalance,
  onSuccess,
}: CreatePostModalProps) {
  const [title, setTitle] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>(PRESET_IMAGES[0]);
  const [bgmCategory, setBgmCategory] = useState<string>("dramatic");
  const [loading, setLoading] = useState<boolean>(false);
  const [submittingType, setSubmittingType] = useState<"free" | "priority" | null>(null);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const PRIORITY_FEE = 25000;
  const isPriorityAffordable = userBalance >= PRIORITY_FEE;

  const handlePost = async (isPriority: boolean) => {
    setError("");

    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề bài đăng.");
      return;
    }

    if (isPriority && !isPriorityAffordable) {
      setError("Số dư ví không đủ 25.000 VNĐ để lên sóng ưu tiên. Vui lòng bấm [+ Nạp 20k] trước!");
      return;
    }

    setLoading(true);
    setSubmittingType(isPriority ? "priority" : "free");

    const API_URL = API_BASE_URL;

    try {
      const res = await fetch(`${API_URL}/api/posts/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          imageUrls: [imageUrl.trim()],
          bgmCategory,
          isPriority,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Đăng bài thất bại.");
      } else {
        onSuccess(data.balance);
        setTitle("");
        onClose();
      }
    } catch {
      setError("Lỗi kết nối máy chủ khi đăng bài.");
    } finally {
      setLoading(false);
      setSubmittingType(null);
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
      <div className="w-full max-w-sm sm:max-w-md max-h-[92vh] bg-neutral-900 border border-neutral-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white tracking-wide">ĐƯA BÀI LÊN SÂN KHẤU 24/7</h2>
              <p className="text-[10px] text-neutral-400">Khán giả toàn cầu sẽ quyết định số phận bài của bạn</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* User Balance Bar */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
            <span className="text-neutral-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Số dư ví của bạn:
            </span>
            <span className="font-mono font-bold text-amber-300">
              {formatVND(userBalance)}
            </span>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-300">Tiêu đề bài viết</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề giật gân, cuốn hút..."
              maxLength={120}
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-sans"
            />
          </div>

          {/* Image URL & Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
              Link ảnh (Unsplash / URL trực tiếp)
            </label>
            <input
              type="url"
              required
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-mono text-[11px]"
            />

            {/* Presets */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[10px] text-neutral-400">Mẫu sẵn:</span>
              {PRESET_IMAGES.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageUrl(img)}
                  className={`w-7 h-7 rounded-lg bg-cover bg-center border transition-all ${
                    imageUrl === img ? "border-red-500 scale-110 shadow-md ring-2 ring-red-500/50" : "border-neutral-700 opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundImage: `url('${img}')` }}
                />
              ))}
            </div>
          </div>

          {/* BGM Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
              <Music className="w-3.5 h-3.5 text-neutral-400" />
              Thể loại Nhạc nền (BGM Category)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "dramatic", label: "Dramatic", desc: "Hồi hộp, cao trào" },
                { id: "upbeat", label: "Upbeat", desc: "EDM, năng lượng" },
                { id: "moody", label: "Moody", desc: "Trầm lắng, đêm" },
                { id: "funny", label: "Funny", desc: "Vui vẻ, troll" },
              ].map((bgm) => (
                <button
                  key={bgm.id}
                  type="button"
                  onClick={() => setBgmCategory(bgm.id)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    bgmCategory === bgm.id
                      ? "bg-red-950/40 border-red-500/80 text-white shadow-sm ring-1 ring-red-500/50"
                      : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">{bgm.label}</div>
                  <div className="text-[10px] text-neutral-500">{bgm.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2 NÚT GỬI BÀI */}
          <div className="pt-2 grid grid-cols-1 gap-2.5">
            {/* Nút 1: Đăng thường - Miễn phí */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handlePost(false)}
              className="w-full py-2.5 px-3 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 active:scale-98 transition-all flex items-center justify-between text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-neutral-300" />
                <div>
                  <div className="text-xs font-bold text-white">Đăng thường - Miễn phí</div>
                  <div className="text-[9px] text-neutral-400">Xếp vào hàng chờ thường theo thứ tự</div>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-neutral-300">0đ</span>
            </button>

            {/* Nút 2: [⚡ Lên sóng ngay - 25.000đ] */}
            <button
              type="button"
              disabled={loading || !isPriorityAffordable}
              onClick={() => handlePost(true)}
              className={`w-full py-3 px-3 rounded-xl border text-left transition-all flex items-center justify-between shadow-lg disabled:opacity-40 disabled:pointer-events-none ${
                isPriorityAffordable
                  ? "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:brightness-110 active:scale-98 border-amber-400/80 shadow-amber-600/30"
                  : "bg-neutral-950 border-neutral-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-black">
                  <Zap className="w-4 h-4 text-black animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-black text-black tracking-wide flex items-center gap-1">
                    <span>⚡ LÊN SÓNG NGAY</span>
                  </div>
                  <div className="text-[9px] text-neutral-900 font-semibold">Phát sóng ngay sau bài hiện tại!</div>
                </div>
              </div>

              {submittingType === "priority" && loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <div className="text-right">
                  <div className="text-xs font-black font-mono text-black">25.000đ</div>
                  {!isPriorityAffordable && (
                    <div className="text-[8px] text-red-400 font-bold">Ví không đủ</div>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
