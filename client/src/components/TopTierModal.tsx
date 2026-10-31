"use client";

import { useEffect, useState } from "react";
import { Trophy, X, Flame, Calendar, Clock, Loader2, Sparkles } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface TopTierPost {
  id: string;
  title: string;
  imageUrls: string;
  bgmCategory: string;
  survivedSeconds: number;
  status: string;
  createdAt: string;
  user?: { username: string };
}

interface TopTierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TopTierModal({ isOpen, onClose }: TopTierModalProps) {
  const [posts, setPosts] = useState<TopTierPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const API_URL = API_BASE_URL;

    fetch(`${API_URL}/api/posts/top-tier`)
      .then((res) => res.json())
      .then((data) => {
        if (data.posts) {
          setPosts(data.posts);
        }
      })
      .catch((err) => {
        console.error("Failed to load top tier posts:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const parseImage = (raw: string) => {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr[0] : raw;
    } catch {
      return raw;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-sm sm:max-w-md max-h-[85vh] bg-neutral-900 border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-black text-sm text-white tracking-wide">BẢNG VÀNG TOP TIER</h2>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-[10px] text-neutral-400">Những chiến tích sống sót 180s bất tử</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-neutral-700">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span>Đang tải danh sách Hall of Fame...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-xs">
              Chưa có bài đăng nào chạm mốc 180s. Hãy là người đầu tiên!
            </div>
          ) : (
            posts.map((post, idx) => {
              const img = parseImage(post.imageUrls);
              const isFull180 = post.status === "top_tier" || post.survivedSeconds >= 180;

              return (
                <div
                  key={post.id}
                  className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                    idx === 0
                      ? "bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-950/30"
                      : "bg-neutral-950/60 border-neutral-800"
                  }`}
                >
                  {/* Rank badge */}
                  <div
                    className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                      idx === 0
                        ? "bg-amber-400 text-black shadow"
                        : idx === 1
                        ? "bg-neutral-300 text-black"
                        : idx === 2
                        ? "bg-amber-700 text-white"
                        : "bg-neutral-800 text-neutral-400 font-mono"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Thumbnail */}
                  <div
                    className="w-12 h-12 rounded-xl bg-cover bg-center shrink-0 border border-neutral-700/80"
                    style={{ backgroundImage: `url('${img}')` }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <h3 className="font-bold text-xs text-white truncate">{post.title}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                      <span>@{post.user?.username || "curator"}</span>
                      <span>&bull;</span>
                      <span className="capitalize">{post.bgmCategory}</span>
                    </div>
                  </div>

                  {/* Survival Score Badge */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                        isFull180
                          ? "bg-amber-500/20 border-amber-400/50 text-amber-300"
                          : "bg-neutral-800 border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{post.survivedSeconds.toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/50 text-center text-[10px] text-neutral-500">
          Quy tắc: Giữ vững thời gian sống sót 180s để bước vào Bảng Vàng vĩnh viễn
        </div>
      </div>
    </div>
  );
}
