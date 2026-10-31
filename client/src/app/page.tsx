"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { authApi, User, API_BASE_URL } from "@/lib/api";
import { audioManager } from "@/lib/audioManager";
import AuthScreen from "@/components/AuthScreen";
import TopTierModal from "@/components/TopTierModal";
import CreatePostModal from "@/components/CreatePostModal";
import AudioHighlightModal from "@/components/AudioHighlightModal";
import DepositModal from "@/components/DepositModal";
import {
  Users,
  Trophy,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Music,
  Skull,
  Flame,
  ThumbsDown,
  Loader2,
  Plus,
  Bot,
  Crown,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { Socket } from "socket.io-client";

interface Post {
  id: string;
  title: string;
  imageUrls: string;
  bgmCategory: string;
  isPriority: boolean;
  status: string;
  survivedSeconds: number;
  user?: { username: string };
}

interface DanmakuMessage {
  id: string;
  username: string;
  message: string;
  isHighlight?: boolean;
  topPercent: number; // 10% to 75%
  createdAt: string;
}

interface VipHighlight {
  id: string;
  username: string;
  message: string;
  actionType: "keep" | "drop";
  timeDeltaMs: number;
  ttsCommentUrl?: string;
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Realtime Socket states
  const [socket, setSocket] = useState<Socket | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);

  // Core Loop Stage states
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(60000);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [keepCount, setKeepCount] = useState<number>(0);
  const [dropCount, setDropCount] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionStatus, setTransitionStatus] = useState<"none" | "dropped" | "top_tier">("none");
  const [survivedSeconds, setSurvivedSeconds] = useState<number>(0);

  // Danmaku chat states
  const [chatInput, setChatInput] = useState<string>("");
  const [danmakus, setDanmakus] = useState<DanmakuMessage[]>([]);

  // Modals
  const [isTopTierOpen, setIsTopTierOpen] = useState<boolean>(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState<boolean>(false);
  const [isAudioHighlightOpen, setIsAudioHighlightOpen] = useState<boolean>(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);

  // VIP Audio Highlight Alert Box State (5s display)
  const [activeVipHighlight, setActiveVipHighlight] = useState<VipHighlight | null>(null);

  // Bot Simulation State (Admin test)
  const [isBotsEnabled, setIsBotsEnabled] = useState<boolean>(false);

  // Audio state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);

  // Action Button animation state
  const [isDropActive, setIsDropActive] = useState<boolean>(false);
  const [isKeepActive, setIsKeepActive] = useState<boolean>(false);

  // Quick feedback toast
  const [feedbackToast, setFeedbackToast] = useState<string>("");

  // Track post ID to trigger TTS only once per post
  const spokenPostIdRef = useRef<string | null>(null);

  // 1. Initial Auth Check on Mount & Autoplay Unlock Listener
  useEffect(() => {
    const unsubUnlock = audioManager.onUnlockChange(setIsAudioUnlocked);

    const savedToken = localStorage.getItem("drop60_token");
    if (!savedToken) {
      setIsCheckingAuth(false);
      return unsubUnlock;
    }

    authApi
      .getMe(savedToken)
      .then((res) => {
        if (res.user) {
          setToken(savedToken);
          setUser(res.user);
        } else {
          localStorage.removeItem("drop60_token");
        }
      })
      .catch(() => {
        localStorage.removeItem("drop60_token");
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });

    return () => {
      unsubUnlock();
    };
  }, []);

  // 2. Connect to Socket.io and handle Core Loop events
  useEffect(() => {
    if (!token || !user) return;

    const s = getSocket(token);
    setSocket(s);

    s.on("connect_error", (err) => {
      console.warn("[Socket Auth Error]:", err.message);
    });

    s.on("viewer:count", (count: number) => {
      setViewerCount(count);
    });

    // Core Loop: Initial State
    s.on("STAGE_INITIAL_STATE", (state) => {
      if (state.currentPost) {
        setCurrentPost(state.currentPost);
        audioManager.playBgm(state.currentPost.bgmCategory);

        if (state.elapsedMs <= 10000 && spokenPostIdRef.current !== state.currentPost.id) {
          spokenPostIdRef.current = state.currentPost.id;
          audioManager.playTtsStream(state.ttsTitleUrl, state.currentPost.title);
        }
      }
      setRemainingMs(state.remainingMs);
      setElapsedMs(state.elapsedMs);
      setKeepCount(state.keepCount);
      setDropCount(state.dropCount);
      setIsTransitioning(state.isTransitioning);
      setTransitionStatus(state.transitionStatus);
      if (state.onlineUsers !== undefined) setViewerCount(state.onlineUsers);
      if (state.isBotsEnabled !== undefined) setIsBotsEnabled(state.isBotsEnabled);
    });

    // Core Loop: Tick (every 200ms)
    s.on("STAGE_TICK", (tick) => {
      setRemainingMs(tick.remainingMs);
      setElapsedMs(tick.elapsedMs);
      setKeepCount(tick.keepCount);
      setDropCount(tick.dropCount);
      if (tick.onlineUsers !== undefined) setViewerCount(tick.onlineUsers);

      // SFX: Urgent tick when remaining time < 10 seconds
      if (tick.remainingMs < 10000 && tick.remainingMs > 0 && !isTransitioning) {
        audioManager.playUrgentTick();
      }
    });

    // Core Loop: New Post on Air
    s.on("STAGE_NEW_POST", (data) => {
      setCurrentPost(data.post);
      setRemainingMs(data.remainingMs);
      setElapsedMs(data.elapsedMs);
      setKeepCount(data.keepCount);
      setDropCount(data.dropCount);
      setIsTransitioning(false);
      setTransitionStatus("none");

      if (data.post) {
        // Crossfade to new post's BGM
        audioManager.playBgm(data.post.bgmCategory);

        // Synced Server-side TTS Stream with Audio Ducking
        if (spokenPostIdRef.current !== data.post.id) {
          spokenPostIdRef.current = data.post.id;
          audioManager.playTtsStream(data.ttsTitleUrl, data.post.title);
        }
      }
    });

    // Core Loop: Stage Ended (DROPPED or TOP_TIER)
    s.on("STAGE_ENDED", (data) => {
      setIsTransitioning(true);
      setTransitionStatus(data.status);
      setSurvivedSeconds(data.survivedSeconds);
      setKeepCount(data.keepCount);
      setDropCount(data.dropCount);

      if (data.status === "top_tier") {
        audioManager.playStampTopTier();
      } else {
        audioManager.playStampDropped();
      }
    });

    // Danmaku message
    s.on("NEW_DANMAKU", (danmaku: { id: string; username: string; message: string; isHighlight?: boolean; createdAt: string }) => {
      // Pick random vertical track between 12% and 68%
      const topPercent = Math.floor(Math.random() * 56) + 12;
      const fullDanmaku: DanmakuMessage = { ...danmaku, topPercent };

      setDanmakus((prev) => [...prev.slice(-20), fullDanmaku]);
      audioManager.playChat();
    });

    // Feature 1: VIP Audio Highlight Event (Broadcasted to all clients with Synced Server TTS)
    s.on("AUDIO_HIGHLIGHT", (data: VipHighlight) => {
      setActiveVipHighlight(data);
      audioManager.playKeep();

      const actionText = data.actionType === "keep" ? "Cộng mười giây cứu bài!" : "Trừ mười giây dìm bài!";
      const fallbackSpeech = `${data.username} bình luận: ${data.message}. ${actionText}`;

      // Synchronized Server-Side TTS Stream played on all clients simultaneously
      audioManager.playTtsStream(data.ttsCommentUrl, fallbackSpeech);

      // Dismiss VIP overlay after 5 seconds
      setTimeout(() => {
        setActiveVipHighlight((current) => (current?.id === data.id ? null : current));
      }, 5000);
    });

    // Feature 3: Bot Status Change
    s.on("BOTS_STATUS", (data: { enabled: boolean; botCount: number; onlineUsers?: number }) => {
      setIsBotsEnabled(data.enabled);
      if (data.onlineUsers !== undefined) setViewerCount(data.onlineUsers);
      showToast(data.enabled ? `Đã bật ${data.botCount} Bot Mồi!` : "Đã tắt Bot Mồi.");
    });

    // Feature 4: Realtime Wallet Updated via VietQR Bank Webhook (SePay / Casso)
    s.on("WALLET_UPDATED", (data: { userId: string; newBalance: number; depositAmount: number; message: string }) => {
      if (data.userId === user.id) {
        setUser((prev) => (prev ? { ...prev, balance: data.newBalance } : null));
        audioManager.playKeep();
        showToast(data.message || `+${new Intl.NumberFormat("vi-VN").format(data.depositAmount)}đ đã nạp vào ví!`);
        audioManager.speakWithDucking("Tài khoản đã được nạp thành công!", { volume: 0.9 });
      }
    });

    return () => {
      s.disconnect();
    };
  }, [token, user, isTransitioning]);

  // Auth Success Handler
  const handleAuthSuccess = (newToken: string, newUser: User) => {
    localStorage.setItem("drop60_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  // Mock Deposit (+20.000đ)
  const handleMockDeposit = useCallback(async () => {
    if (!token) return;

    try {
      const res = await authApi.mockDeposit(token);
      if (res.balance !== undefined) {
        setUser((prev) => (prev ? { ...prev, balance: res.balance } : null));
        audioManager.playKeep();
        showToast("+20.000 VNĐ đã cộng vào ví!");
      }
    } catch (err) {
      console.error("Deposit error:", err);
    }
  }, [token]);

  // Quick Chat Send (Free)
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !chatInput.trim()) return;

    audioManager.unlockAudio();
    socket.emit("SEND_CHAT", { message: chatInput.trim() });
    setChatInput("");
  };

  // Toggle Bot Simulation (Admin Local Feature)
  const handleToggleBots = async () => {
    if (socket && socket.connected) {
      socket.emit("ADMIN_TOGGLE_BOTS");
    } else {
      const API_URL = API_BASE_URL;
      try {
        const res = await fetch(`${API_URL}/api/posts/toggle-bots`, { method: "POST" });
        const data = await res.json();
        setIsBotsEnabled(data.botsEnabled);
        showToast(data.message);
      } catch (err) {
        console.warn("Toggle bots failed:", err);
      }
    }
  };

  // Time Manipulation Actions: KEEP & DROP
  const handleDrop = () => {
    audioManager.unlockAudio();
    if (socket && !isTransitioning) {
      audioManager.playDrop();
      setIsDropActive(true);
      setTimeout(() => setIsDropActive(false), 120);
      socket.emit("ACTION_DROP");
    }
  };

  const handleKeep = () => {
    audioManager.unlockAudio();
    if (socket && !isTransitioning) {
      audioManager.playKeep();
      setIsKeepActive(true);
      setTimeout(() => setIsKeepActive(false), 120);
      socket.emit("ACTION_KEEP");
    }
  };

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(""), 3000);
  };

  // Toggle Mute Audio
  const toggleMute = () => {
    const nextMuted = audioManager.toggleMute();
    setIsMuted(nextMuted);
  };

  // Keyboard Shortcuts: 'K' / 'Space' for Keep, 'D' for Drop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "k" || e.key === "K" || e.key === " ") {
        handleKeep();
      } else if (e.key === "d" || e.key === "D") {
        handleDrop();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [socket, isTransitioning]);

  // Format Timer as MM:SS.ms (e.g. 00:58.4)
  const formatTimer = (ms: number) => {
    const safeMs = Math.max(0, ms);
    const minutes = Math.floor(safeMs / 60000);
    const seconds = Math.floor((safeMs % 60000) / 1000);
    const decimal = Math.floor((safeMs % 1000) / 100);

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${decimal}`;
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const parseImage = (raw: string | undefined) => {
    if (!raw) return "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1200&q=80";
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr[0] : raw;
    } catch {
      return raw;
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 text-neutral-400">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        <span className="text-xs font-mono tracking-widest uppercase">Khởi động DROP60.LIVE Stage...</span>
      </div>
    );
  }

  if (!token || !user) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  const isUnder10s = remainingMs < 10000 && !isTransitioning;
  const currentImage = parseImage(currentPost?.imageUrls);

  return (
    <div className="w-full h-[100dvh] bg-neutral-950 flex items-center justify-center overflow-hidden select-none relative">
      {/* CSS Keyframes for Intense Shake and Danmaku Float */}
      <style jsx global>{`
        @keyframes intenseShake {
          0%, 100% { transform: translate(0, 0) scale(1.05); }
          20% { transform: translate(-3px, 2px) scale(1.1) rotate(-1.5deg); }
          40% { transform: translate(3px, -2px) scale(1.1) rotate(1.5deg); }
          60% { transform: translate(-3px, -1px) scale(1.1) rotate(-1deg); }
          80% { transform: translate(2px, 2px) scale(1.1) rotate(1deg); }
        }
        @keyframes danmakuFly {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-150%); }
        }
        .shake-intense {
          animation: intenseShake 0.15s infinite ease-in-out;
        }
        .danmaku-item {
          animation: danmakuFly 7s linear forwards;
          white-space: nowrap;
          will-change: transform;
        }
      `}</style>

      {/* Desktop Ambient Glow Backdrop */}
      <div className="hidden md:block absolute -top-40 -left-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="hidden md:block absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* 9:16 MOBILE FRAME CONTAINER (Full screen on mobile, 9:16 center box on desktop) */}
      <div className="w-full md:max-w-[430px] h-[100dvh] md:max-h-[890px] md:h-[95dvh] bg-black md:border md:border-neutral-800 md:rounded-[36px] shadow-2xl flex flex-col justify-between overflow-hidden relative">
        
        {/* ======================================================== */}
        {/* TẦNG 1: TOP BAR (10% Chiều cao)                          */}
        {/* ======================================================== */}
        <header className="h-[10%] w-full bg-neutral-950/90 border-b border-neutral-800/80 px-2.5 py-1.5 flex items-center justify-between z-30 shrink-0">
          {/* Góc Trái: Logo + Chấm đỏ + Viewer count + Nút Bot Mồi */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-black text-xs sm:text-sm tracking-wider bg-gradient-to-r from-red-500 to-amber-300 bg-clip-text text-transparent">
                DROP60
              </span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 font-mono">
              <Users className="w-2.5 h-2.5 text-emerald-400" />
              <span className="font-bold">{viewerCount}</span>
            </div>

            {/* Nút [🤖 Bật/Tắt Bot Mồi] (Admin Test Local) */}
            <button
              onClick={handleToggleBots}
              className={`px-1.5 py-0.5 rounded-lg border text-[9px] font-bold flex items-center gap-1 transition-all ${
                isBotsEnabled
                  ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse"
                  : "bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white"
              }`}
              title="Bật/Tắt Bot Mồi tự động bấm KEEP/DROP và bình luận giả lập phòng đông (Admin Local)"
            >
              <Bot className="w-2.5 h-2.5" />
              <span>{isBotsEnabled ? "Bot: BẬT" : "Bot: TẮT"}</span>
            </button>
          </div>

          {/* Chính Giữa: Đồng hồ đếm ngược cỡ lớn MM:SS.ms */}
          <div className="flex flex-col items-center justify-center px-1">
            <div
              className={`font-black font-mono tracking-tighter text-base sm:text-lg transition-colors leading-none ${
                isUnder10s
                  ? "text-red-500 shake-intense"
                  : remainingMs <= 30000
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {formatTimer(remainingMs)}
            </div>
            <div className="text-[8px] font-mono tracking-widest text-neutral-500 uppercase mt-0.5">
              {isUnder10s ? "NGUY HIỂM!" : "REMAINING"}
            </div>
          </div>

          {/* Góc Phải: Username, Ví (VNĐ), [+20k], [🏆 Top Tier] */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Wallet & Quick Deposit (VietQR) */}
            <div
              onClick={() => setIsDepositModalOpen(true)}
              className="flex items-center gap-1 bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-800 px-1.5 py-0.5 rounded-lg cursor-pointer transition-all active:scale-95"
              title="Nạp tiền tự động qua VietQR (SePay / Casso)"
            >
              <span className="text-[10px] font-extrabold font-mono text-amber-300">
                {formatVND(user.balance).replace("₫", "")}đ
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDepositModalOpen(true);
                }}
                className="px-1 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-black text-[9px] active:scale-95 transition-all"
                title="Mở nạp tiền VietQR"
              >
                +Nạp
              </button>
            </div>

            {/* Top Tier Modal Button */}
            <button
              onClick={() => setIsTopTierOpen(true)}
              className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 transition-colors"
              title="Bảng vàng Top Tier"
            >
              <Trophy className="w-3.5 h-3.5" />
            </button>

            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="p-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* TẦNG 2: MAIN STAGE (65% Chiều cao)                       */}
        {/* ======================================================== */}
        <section className="h-[65%] w-full relative overflow-hidden bg-neutral-950 flex flex-col justify-between shrink-0">
          {/* Post Image as Stage Centerpiece */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 filter brightness-[0.8] contrast-[1.05]"
            style={{ backgroundImage: `url('${currentImage}')` }}
          />

          {/* Stage Shadow Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40 pointer-events-none" />

          {/* NÚT CHẠM ĐỂ BẬT ÂM THANH (AUTOPLAY POLICY UNLOCK) */}
          {!isAudioUnlocked && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
              <button
                onClick={() => audioManager.unlockAudio()}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-[11px] shadow-[0_0_25px_rgba(239,68,68,0.8)] border border-amber-300 flex items-center gap-1.5 animate-bounce active:scale-95 transition-all cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                <span>🔊 Chạm để bật âm thanh sân khấu</span>
              </button>
            </div>
          )}

          {/* LỚP PHỦ DANMAKU: Bình luận bay ngang từ phải sang trái */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {danmakus.map((d) => (
              <div
                key={d.id}
                className={`danmaku-item absolute text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-1.5 ${
                  d.isHighlight
                    ? "bg-amber-950/90 text-amber-300 border-2 border-amber-400 shadow-amber-500/40 z-30"
                    : "bg-black/60 text-white border border-white/20"
                }`}
                style={{
                  top: `${d.topPercent}%`,
                }}
              >
                {d.isHighlight && <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />}
                <span className={d.isHighlight ? "text-amber-200 font-mono" : "text-neutral-400 font-mono"}>
                  @{d.username}:
                </span>
                <span>{d.message}</span>
              </div>
            ))}
          </div>

          {/* Thông tin Tiêu đề + BGM + Người đăng */}
          <div className="relative z-10 p-3 flex flex-col gap-1 max-w-full">
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentPost?.bgmCategory && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/70 text-amber-300 border border-amber-500/40 backdrop-blur-md">
                  <Music className="w-2.5 h-2.5 animate-pulse" />
                  BGM: {currentPost.bgmCategory}
                </span>
              )}
              {currentPost?.isPriority && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500 text-black">
                  PRIORITY
                </span>
              )}
            </div>

            <h1 className="text-sm sm:text-base font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight line-clamp-2 leading-snug">
              {currentPost?.title || "Đang tải bài phát sóng tiếp theo..."}
            </h1>

            <p className="text-[10px] text-neutral-300 drop-shadow">
              Đăng bởi: <strong className="text-neutral-100 font-mono">@{currentPost?.user?.username || "curator"}</strong>
            </p>
          </div>

          {/* LỚP PHỦ VIP AUDIO HIGHLIGHT: Khung thông báo phát sáng cố định trong 5 giây */}
          {activeVipHighlight && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[88%] max-w-[340px] p-3.5 rounded-3xl bg-neutral-950/95 border-2 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.65)] backdrop-blur-xl flex flex-col items-center text-center animate-in zoom-in-95 fade-in duration-200 select-none">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9px] font-black tracking-widest uppercase mb-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>VIP AUDIO HIGHLIGHT</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              </div>

              <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 mb-1">
                <span>Khán giả VIP:</span>
                <strong className="text-amber-300 font-bold">@{activeVipHighlight.username}</strong>
              </div>

              {/* Tác động +10s / -10s */}
              <div className="my-1">
                {activeVipHighlight.actionType === "keep" ? (
                  <span className="px-3 py-1 rounded-xl bg-emerald-950 border border-emerald-400 text-emerald-300 font-black text-xs sm:text-sm tracking-wider shadow-lg shadow-emerald-900/50 flex items-center gap-1 animate-pulse">
                    <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                    <span>+10 GIÂY (CỨU BÀI)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-xl bg-red-950 border border-red-500 text-red-300 font-black text-xs sm:text-sm tracking-wider shadow-lg shadow-red-900/50 flex items-center gap-1 animate-pulse">
                    <ArrowDownCircle className="w-4 h-4 text-red-400" />
                    <span>-10 GIÂY (DÌM BÀI)</span>
                  </span>
                )}
              </div>

              {/* Nội dung bình luận */}
              <div className="mt-1.5 px-3 py-2 rounded-2xl bg-black/60 border border-amber-500/30 text-white text-xs sm:text-sm font-extrabold leading-snug w-full break-words">
                &ldquo;{activeVipHighlight.message}&rdquo;
              </div>

              <div className="mt-2 text-[9px] font-mono text-amber-400/80 flex items-center gap-1 animate-pulse">
                <Volume2 className="w-3 h-3" />
                <span>Audio Ducking: Đang phát giọng đọc VIP...</span>
              </div>
            </div>
          )}

          {/* LỚP PHỦ KẾT THÚC: Con dấu khổng lồ DROPPED hoặc TOP TIER */}
          {isTransitioning && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-200">
              {transitionStatus === "top_tier" ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-2xl shadow-amber-500/30 animate-bounce">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <div className="px-4 py-1.5 rounded-xl border-4 border-amber-400 bg-amber-950/90 text-amber-300 font-black text-2xl sm:text-3xl tracking-widest uppercase rotate-[-3deg] shadow-2xl">
                    ★ TOP TIER ★
                  </div>
                  <p className="text-xs font-bold text-white max-w-xs mt-1">
                    Bất tử trên sân khấu! Sống sót trọn vẹn 180s.
                  </p>
                  <span className="text-[10px] text-amber-300 font-mono">Vinh danh vào Bảng Vàng...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-400 shadow-2xl shadow-red-600/30">
                    <Skull className="w-7 h-7 animate-pulse" />
                  </div>
                  <div className="px-5 py-2 rounded-xl border-4 border-red-600 bg-red-950/90 text-red-500 font-black text-2xl sm:text-3xl tracking-widest uppercase rotate-[-4deg] shadow-2xl shadow-red-950/80">
                    DROPPED!
                  </div>
                  <p className="text-xs font-bold text-neutral-300 mt-1">
                    Trụ được <strong className="text-red-400 font-mono text-sm">{survivedSeconds} giây</strong>
                  </p>
                  <span className="text-[10px] text-neutral-400 font-mono">Chuyển bài sau 3 giây...</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* TẦNG 3: SUB-BAR (10% Chiều cao)                          */}
        {/* ======================================================== */}
        <section className="h-[10%] w-full bg-neutral-950 border-t border-neutral-800/80 px-2 py-1 flex items-center gap-1.5 z-20 shrink-0">
          {/* Ô nhập chat nhanh */}
          <form onSubmit={handleSendChat} className="flex-1 flex items-center gap-1">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Chat nhanh Danmaku..."
              maxLength={100}
              className="w-full px-2.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-sans"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 active:scale-95 transition-all"
              title="Gửi chat miễn phí"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Nút [🔊 Ghim 5k]: Mở AudioHighlightModal với +10s hoặc -10s */}
          <button
            onClick={() => setIsAudioHighlightOpen(true)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black font-black text-[11px] shadow-md shadow-amber-600/20 active:scale-95 transition-all shrink-0"
            title="Ghim bình luận nổi bật + Đọc TTS + Thao túng 10 giây (5.000 VNĐ)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ghim 5k</span>
          </button>

          {/* Nút [➕ Đăng bài] */}
          <button
            onClick={() => setIsCreatePostOpen(true)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-[11px] shadow-md shadow-red-600/20 active:scale-95 transition-all shrink-0"
            title="Đưa bài lên sóng"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Đăng bài</span>
          </button>
        </section>

        {/* ======================================================== */}
        {/* TẦNG 4: CỤM NÚT THAO TÚNG THỜI GIAN (15% Chiều cao đáy) */}
        {/* ======================================================== */}
        <section className="h-[15%] w-full bg-black p-2 grid grid-cols-2 gap-2 z-20 shrink-0">
          {/* Nút Bên Trái: 🔴 DROP (-0.2s) */}
          <button
            onClick={handleDrop}
            disabled={isTransitioning}
            className={`h-full rounded-2xl bg-gradient-to-br from-red-700 via-rose-700 to-red-950 border-2 border-red-500/60 text-white flex flex-col items-center justify-center transition-all shadow-xl shadow-red-950/50 disabled:opacity-50 select-none ${
              isDropActive
                ? "scale-[0.92] translate-y-1 brightness-125 ring-4 ring-red-500"
                : "hover:brightness-110 active:scale-[0.94]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ThumbsDown className="w-5 h-5 text-red-200" />
              <span className="font-black text-sm sm:text-base tracking-wide">DROP</span>
              <span className="text-[11px] font-mono text-red-200 font-bold">(-0.2s)</span>
            </div>
            <div className="text-[10px] font-mono text-red-300/80 mt-0.5">
              Lượt vote: <strong className="text-white">{dropCount}</strong>
            </div>
          </button>

          {/* Nút Bên Phải: 🟢 KEEP (+0.2s) */}
          <button
            onClick={handleKeep}
            disabled={isTransitioning}
            className={`h-full rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-950 border-2 border-emerald-400/60 text-white flex flex-col items-center justify-center transition-all shadow-xl shadow-emerald-950/50 disabled:opacity-50 select-none ${
              isKeepActive
                ? "scale-[0.92] translate-y-1 brightness-125 ring-4 ring-emerald-400"
                : "hover:brightness-110 active:scale-[0.94]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Flame className="w-5 h-5 text-amber-300 animate-pulse" />
              <span className="font-black text-sm sm:text-base tracking-wide">KEEP</span>
              <span className="text-[11px] font-mono text-emerald-200 font-bold">(+0.2s)</span>
            </div>
            <div className="text-[10px] font-mono text-emerald-300/80 mt-0.5">
              Lượt vote: <strong className="text-white">{keepCount}</strong>
            </div>
          </button>
        </section>

        {/* Floating Quick Toast */}
        {feedbackToast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-neutral-900/95 border border-amber-500/50 text-amber-300 text-xs font-bold shadow-2xl backdrop-blur-md animate-in fade-in">
            {feedbackToast}
          </div>
        )}
      </div>

      {/* Modals */}
      <TopTierModal isOpen={isTopTierOpen} onClose={() => setIsTopTierOpen(false)} />
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        token={token}
        user={user}
        onSuccess={(newBalance, amt) => {
          setUser((prev) => (prev ? { ...prev, balance: newBalance } : null));
          audioManager.playKeep();
          showToast(`🎉 Nạp thành công +${new Intl.NumberFormat("vi-VN").format(amt)}đ!`);
        }}
      />
      <AudioHighlightModal
        isOpen={isAudioHighlightOpen}
        onClose={() => setIsAudioHighlightOpen(false)}
        token={token}
        userBalance={user.balance}
        onSuccess={(newBalance) => {
          setUser((prev) => (prev ? { ...prev, balance: newBalance } : null));
          showToast("Đã kích hoạt VIP Audio Highlight 5.000đ!");
        }}
      />
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        token={token}
        userBalance={user.balance}
        onSuccess={(newBalance) => {
          setUser((prev) => (prev ? { ...prev, balance: newBalance } : null));
          showToast("Bài đã được đưa vào hàng đợi phát sóng!");
        }}
      />
    </div>
  );
}
