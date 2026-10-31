import { Server } from "socket.io";
import prisma from "../prisma";
import { Post } from "@prisma/client";
import { ttsService } from "./ttsService";

export interface StageState {
  currentPost: (Post & { user?: { username: string } }) | null;
  remainingMs: number;
  elapsedMs: number;
  keepCount: number;
  dropCount: number;
  isTransitioning: boolean;
  transitionStatus: "none" | "dropped" | "top_tier";
  isBotsEnabled?: boolean;
  ttsTitleUrl?: string;
}

export interface VipAudioHighlightEvent {
  id: string;
  username: string;
  message: string;
  actionType: "keep" | "drop";
  timeDeltaMs: number;
  remainingMs: number;
  elapsedMs: number;
  createdAt: string;
  ttsCommentUrl?: string;
}

class StageEngine {
  private io: Server | null = null;
  private state: StageState = {
    currentPost: null,
    remainingMs: 60000,
    elapsedMs: 0,
    keepCount: 0,
    dropCount: 0,
    isTransitioning: false,
    transitionStatus: "none",
    isBotsEnabled: false,
  };

  private timer: NodeJS.Timeout | null = null;
  private readonly TICK_MS = 200;
  private readonly MAX_LIFETIME_MS = 180000; // 180 seconds cap
  private readonly INITIAL_MS = 60000; // 60 seconds initial
  private readonly STEP_MS = 200; // 0.2s for KEEP/DROP

  // Bot Simulation State
  private botsEnabled: boolean = false;
  private botActionTimer: NodeJS.Timeout | null = null;
  private botChatTimer: NodeJS.Timeout | null = null;
  private readonly BOT_NAMES = [
    "CyberGamer99",
    "StreamSniper_VN",
    "NeonRunner_X",
    "DropMaster2026",
    "VocaloidFan",
  ];
  private readonly BOT_COMMENTS = [
    "Bài này cuốn thực sự, KEEP mạnh tay nào anh em! 🔥",
    "Cứu bài này đi, đang hay mà!",
    "Chán quá, DROP lẹ đi chuyển bài mới 💀",
    "Beat drop nghe phê đấy!",
    "Giữ bài này đến hết giờ nhé!",
    "180s Top Tier thẳng tiến nào!",
    "Ai vừa dìm bài thế?? Đang hay!",
    "Nhạc này mà cũng có người nghe à :)) DROP!",
    "Đỉnh của chóp!! ❤️",
    "Cộng giờ cứu bài đê!",
  ];

  public getOnlineUsers(): number {
    const realUsers = this.io?.engine.clientsCount || 0;
    return this.botsEnabled ? realUsers + this.BOT_NAMES.length : realUsers;
  }

  public getState() {
    return {
      ...this.state,
      isBotsEnabled: this.botsEnabled,
      onlineUsers: this.getOnlineUsers(),
    };
  }

  public async init(io: Server) {
    this.io = io;
    console.log("[StageEngine] Initializing Core 24/7 Loop...");

    // 1. Load initial live post or next queued post
    await this.loadNextPost();

    // 2. Start game loop every 200ms
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.tick();
    }, this.TICK_MS);

    console.log("[StageEngine] Core Loop running at 200ms ticks.");
  }

  private tick() {
    if (!this.io || !this.state.currentPost) return;

    // Pause time during post transition / stamp animation
    if (this.state.isTransitioning) {
      return;
    }

    // Decrement remaining & increment elapsed
    this.state.remainingMs = Math.max(0, this.state.remainingMs - this.TICK_MS);
    this.state.elapsedMs += this.TICK_MS;

    // Check Drop condition: remainingMs <= 0
    if (this.state.remainingMs <= 0) {
      this.handleStageEnd("dropped");
      return;
    }

    // Check Top Tier condition: elapsedMs >= 180,000ms
    if (this.state.elapsedMs >= this.MAX_LIFETIME_MS) {
      this.handleStageEnd("top_tier");
      return;
    }

    // Broadcast STAGE_TICK to all connected clients
    this.io.emit("STAGE_TICK", {
      remainingMs: this.state.remainingMs,
      elapsedMs: this.state.elapsedMs,
      keepCount: this.state.keepCount,
      dropCount: this.state.dropCount,
      onlineUsers: this.getOnlineUsers(),
    });
  }

  public handleActionDrop(username: string) {
    if (this.state.isTransitioning || !this.state.currentPost) return;

    this.state.dropCount++;
    this.state.remainingMs = Math.max(0, this.state.remainingMs - this.STEP_MS);

    // Broadcast instant action feedback
    this.io?.emit("ACTION_FEEDBACK", {
      type: "drop",
      username,
      dropCount: this.state.dropCount,
      remainingMs: this.state.remainingMs,
    });

    if (this.state.remainingMs <= 0) {
      this.handleStageEnd("dropped");
    }
  }

  public handleActionKeep(username: string) {
    if (this.state.isTransitioning || !this.state.currentPost) return;

    this.state.keepCount++;

    // Cap rule: elapsedMs + remainingMs cannot exceed 180s (180000ms)
    const maxAllowedRemaining = this.MAX_LIFETIME_MS - this.state.elapsedMs;
    this.state.remainingMs = Math.min(
      this.state.remainingMs + this.STEP_MS,
      maxAllowedRemaining
    );

    // Broadcast instant action feedback
    this.io?.emit("ACTION_FEEDBACK", {
      type: "keep",
      username,
      keepCount: this.state.keepCount,
      remainingMs: this.state.remainingMs,
    });
  }

  // Feature: Audio Highlight 5k with +10s (Keep) or -10s (Drop) and TTS Stream
  public async handleAudioHighlight(username: string, rawMessage: string, actionType: "keep" | "drop" = "keep") {
    if (this.state.isTransitioning || !this.state.currentPost) return;

    const message = rawMessage?.trim();
    if (!message || message.length > 100) return;

    const TIME_DELTA_MS = 10000; // 10 seconds

    if (actionType === "keep") {
      this.state.keepCount++;
      const maxAllowedRemaining = this.MAX_LIFETIME_MS - this.state.elapsedMs;
      this.state.remainingMs = Math.min(
        this.state.remainingMs + TIME_DELTA_MS,
        maxAllowedRemaining
      );
    } else {
      this.state.dropCount++;
      this.state.remainingMs = Math.max(0, this.state.remainingMs - TIME_DELTA_MS);
    }

    // Generate synced server-side TTS audio for all clients
    let ttsCommentUrl = "";
    try {
      const actionText = actionType === "keep" ? "Cộng mười giây cứu bài!" : "Trừ mười giây dìm bài!";
      const speech = `${username} bình luận: ${message}. ${actionText}`;
      const ttsRes = await ttsService.synthesize(speech);
      ttsCommentUrl = ttsRes.url;
    } catch (err) {
      console.warn("[StageEngine] TTS synthesize error for comment:", err);
    }

    const highlightEvent: VipAudioHighlightEvent = {
      id: "hl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      username,
      message,
      actionType,
      timeDeltaMs: TIME_DELTA_MS,
      remainingMs: this.state.remainingMs,
      elapsedMs: this.state.elapsedMs,
      createdAt: new Date().toISOString(),
      ttsCommentUrl,
    };

    console.log(`[StageEngine] VIP AUDIO HIGHLIGHT from @${username} (${actionType.toUpperCase()} 10s): "${message}" (TTS: ${ttsCommentUrl || "none"})`);

    // 1. Broadcast VIP Audio Highlight event to all clients
    this.io?.emit("AUDIO_HIGHLIGHT", highlightEvent);

    // 2. Also stream as Danmaku message
    this.handleSendHighlightChat(username, `${actionType === "keep" ? "🟢 [+10s Cứu]" : "🔴 [-10s Dìm]"} ${message}`);

    // 3. Immediately end stage if time ran out
    if (this.state.remainingMs <= 0) {
      this.handleStageEnd("dropped");
    }
  }

  public handleSendChat(username: string, rawMessage: string) {
    const message = rawMessage?.trim();
    if (!message || message.length > 150) return;

    const danmaku = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      username,
      message,
      isHighlight: false,
      createdAt: new Date().toISOString(),
    };

    this.io?.emit("NEW_DANMAKU", danmaku);
  }

  public handleSendHighlightChat(username: string, rawMessage: string) {
    const message = rawMessage?.trim();
    if (!message || message.length > 150) return;

    const danmaku = {
      id: "msg_hl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      username,
      message,
      isHighlight: true,
      createdAt: new Date().toISOString(),
    };

    this.io?.emit("NEW_DANMAKU", danmaku);
  }

  // Feature: Bot Simulation (Admin Local Test)
  public toggleBots(enabled?: boolean): boolean {
    if (enabled !== undefined) {
      this.botsEnabled = enabled;
    } else {
      this.botsEnabled = !this.botsEnabled;
    }

    this.state.isBotsEnabled = this.botsEnabled;

    if (this.botsEnabled) {
      this.startBotSimulation();
    } else {
      this.stopBotSimulation();
    }

    // Broadcast status to all clients
    this.io?.emit("BOTS_STATUS", {
      enabled: this.botsEnabled,
      botCount: this.BOT_NAMES.length,
      onlineUsers: this.getOnlineUsers(),
    });

    console.log(`[StageEngine] Bot Simulation is now: ${this.botsEnabled ? "ENABLED (" + this.BOT_NAMES.length + " bots)" : "DISABLED"}`);
    return this.botsEnabled;
  }

  public getBotsStatus() {
    return {
      enabled: this.botsEnabled,
      botCount: this.BOT_NAMES.length,
    };
  }

  private startBotSimulation() {
    this.stopBotSimulation();

    // 1. Random KEEP/DROP every 800ms - 1800ms
    const scheduleNextAction = () => {
      if (!this.botsEnabled) return;
      const delay = Math.floor(Math.random() * 1000) + 800;
      this.botActionTimer = setTimeout(() => {
        if (!this.botsEnabled) return;

        if (!this.state.isTransitioning && this.state.currentPost) {
          const botName = this.BOT_NAMES[Math.floor(Math.random() * this.BOT_NAMES.length)];
          const isKeep = Math.random() < 0.55;

          if (isKeep) {
            this.handleActionKeep(botName);
          } else {
            this.handleActionDrop(botName);
          }
        }

        scheduleNextAction();
      }, delay);
    };

    scheduleNextAction();

    // 2. Random Chat Comment every 3s - 6s
    const scheduleNextChat = () => {
      if (!this.botsEnabled) return;
      const delay = Math.floor(Math.random() * 3000) + 3000;
      this.botChatTimer = setTimeout(() => {
        if (!this.botsEnabled) return;

        if (!this.state.isTransitioning && this.state.currentPost) {
          const botName = this.BOT_NAMES[Math.floor(Math.random() * this.BOT_NAMES.length)];
          const comment = this.BOT_COMMENTS[Math.floor(Math.random() * this.BOT_COMMENTS.length)];

          this.handleSendChat(botName, comment);
        }

        scheduleNextChat();
      }, delay);
    };

    scheduleNextChat();
  }

  private stopBotSimulation() {
    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }
    if (this.botChatTimer) {
      clearTimeout(this.botChatTimer);
      this.botChatTimer = null;
    }
  }

  private async handleStageEnd(status: "dropped" | "top_tier") {
    if (this.state.isTransitioning || !this.state.currentPost) return;

    this.state.isTransitioning = true;
    this.state.transitionStatus = status;

    const survivedSeconds =
      status === "top_tier"
        ? 180
        : Math.round((this.state.elapsedMs / 1000) * 10) / 10;

    console.log(
      `[StageEngine] Stage ended: Post "${this.state.currentPost.title}" -> ${status.toUpperCase()} (${survivedSeconds}s survived)`
    );

    // Update database
    try {
      await prisma.post.update({
        where: { id: this.state.currentPost.id },
        data: {
          status,
          survivedSeconds,
        },
      });
    } catch (err) {
      console.error("[StageEngine] Failed to update post status in DB:", err);
    }

    // Broadcast STAGE_ENDED event
    this.io?.emit("STAGE_ENDED", {
      status,
      survivedSeconds,
      post: this.state.currentPost,
      keepCount: this.state.keepCount,
      dropCount: this.state.dropCount,
    });

    // Pause cooldown: 3s for DROPPED, 4s for TOP_TIER
    const delayMs = status === "top_tier" ? 4000 : 3000;
    setTimeout(async () => {
      await this.loadNextPost();
    }, delayMs);
  }

  public async loadNextPost() {
    try {
      // 1. Prioritize queued posts with isPriority = true
      let nextPost = await prisma.post.findFirst({
        where: { status: "queued", isPriority: true },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      });

      // 2. If no priority post, pick normal queued post
      if (!nextPost) {
        nextPost = await prisma.post.findFirst({
          where: { status: "queued" },
          include: { user: { select: { username: true } } },
          orderBy: { createdAt: "asc" },
        });
      }

      // 3. If queue is empty, recycle posts so 24/7 stream never stops
      if (!nextPost) {
        console.log("[StageEngine] Queue exhausted. Recycling all posts to 'queued' for 24/7 continuity...");
        await prisma.post.updateMany({
          data: { status: "queued" },
        });

        nextPost = await prisma.post.findFirst({
          include: { user: { select: { username: true } } },
          orderBy: { createdAt: "asc" },
        });
      }

      if (nextPost) {
        // Mark as live in database
        await prisma.post.update({
          where: { id: nextPost.id },
          data: { status: "live" },
        });

        // Synthesize synchronized TTS audio for post title
        let ttsTitleUrl = "";
        try {
          const ttsRes = await ttsService.synthesize(nextPost.title);
          ttsTitleUrl = ttsRes.url;
        } catch (ttsErr) {
          console.warn("[StageEngine] Failed to synthesize title TTS:", ttsErr);
        }

        // Reset in-memory state
        this.state = {
          currentPost: nextPost,
          remainingMs: this.INITIAL_MS,
          elapsedMs: 0,
          keepCount: 0,
          dropCount: 0,
          isTransitioning: false,
          transitionStatus: "none",
          isBotsEnabled: this.botsEnabled,
          ttsTitleUrl,
        };

        console.log(`[StageEngine] >> NEW POST ON AIR: "${nextPost.title}" (BGM: ${nextPost.bgmCategory}, Priority: ${nextPost.isPriority}) [TTS: ${ttsTitleUrl || "none"}]`);

        // Broadcast STAGE_NEW_POST with synced ttsTitleUrl
        this.io?.emit("STAGE_NEW_POST", {
          post: this.state.currentPost,
          remainingMs: this.state.remainingMs,
          elapsedMs: this.state.elapsedMs,
          keepCount: this.state.keepCount,
          dropCount: this.state.dropCount,
          ttsTitleUrl,
        });
      } else {
        console.warn("[StageEngine] Warning: No posts found in database.");
      }
    } catch (err) {
      console.error("[StageEngine] Error loading next post:", err);
    }
  }
}

export const stageEngine = new StageEngine();
