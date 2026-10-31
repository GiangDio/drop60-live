"use client";

import { useState } from "react";
import { X, PlusCircle, Sparkles, Image as ImageIcon, Music, Zap, Loader2, AlertCircle } from "lucide-react";

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
  const [isPriority, setIsPriority] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề bài đăng.");
      return;
    }

    if (isPriority && userBalance < 10000) {
      setError("Số dư không đủ 10.000 VNĐ để chọn Hàng chờ Ưu tiên. Vui lòng nạp thêm tiền.");
      return;
    }

    setLoading(true);
    const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

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
        onClose();
      }
    } catch {
      setError("Lỗi kết nối máy chủ khi đăng bài.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-sm sm:max-w-md max-h-[90vh] bg-neutral-900 border border-neutral-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white tracking-wide">ĐƯA BÀI LÊN SÂN KHẤU 24/7</h2>
              <p className="text-[10px] text-neutral-400">Xếp vào hàng chờ sinh tồn DROP60.LIVE</p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

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
              Link ảnh (Unsplash / Trực tiếp)
            </label>
            <input
              type="url"
              required
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-mono"
            />

            {/* Presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-neutral-400">Mẫu sẵn:</span>
              {PRESET_IMAGES.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageUrl(img)}
                  className={`w-7 h-7 rounded-lg bg-cover bg-center border transition-all ${
                    imageUrl === img ? "border-red-500 scale-110 shadow" : "border-neutral-700 opacity-60 hover:opacity-100"
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
                { id: "dramatic", label: "Dramatic (Kịch tính)", desc: "Hồi hộp, cao trào" },
                { id: "upbeat", label: "Upbeat (Sôi động)", desc: "EDM, năng lượng" },
                { id: "moody", label: "Moody (Chill/Deep)", desc: "Trầm lắng, đêm muộn" },
                { id: "funny", label: "Funny (Hài hước)", desc: "Vui vẻ, troll" },
              ].map((bgm) => (
                <button
                  key={bgm.id}
                  type="button"
                  onClick={() => setBgmCategory(bgm.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    bgmCategory === bgm.id
                      ? "bg-red-950/40 border-red-500/80 text-white shadow-sm"
                      : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">{bgm.label}</div>
                  <div className="text-[10px] text-neutral-500">{bgm.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Priority Queue Option */}
          <div
            onClick={() => setIsPriority(!isPriority)}
            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
              isPriority
                ? "bg-amber-950/30 border-amber-500/70 shadow-md shadow-amber-950/30"
                : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isPriority ? "bg-amber-500 text-black font-black" : "bg-neutral-800 text-neutral-400"
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Hàng chờ Ưu tiên</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                    10.000 VNĐ
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400">Chiếu ngay sau bài hiện tại, vượt mọi bài thường</p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={isPriority}
              onChange={() => {}}
              className="accent-amber-500 w-4 h-4 rounded"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isPriority ? "ĐĂNG BÀI ƯU TIÊN (10K)" : "ĐĂNG BÀI MIỄN PHÍ"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
