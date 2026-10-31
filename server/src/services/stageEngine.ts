import { Server } from "socket.io";
import prisma from "../prisma";
import { Post } from "@prisma/client";

export interface StageState {
  currentPost: (Post & { user?: { username: string } }) | null;
  remainingMs: number;
  elapsedMs: number;
  keepCount: number;
  dropCount: number;
  isTransitioning: boolean;
  transitionStatus: "none" | "dropped" | "top_tier";
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
  };

  private timer: NodeJS.Timeout | null = null;
  private readonly TICK_MS = 200;
  private readonly MAX_LIFETIME_MS = 180000; // 180 seconds cap
  private readonly INITIAL_MS = 60000; // 60 seconds initial
  private readonly STEP_MS = 200; // 0.2s for KEEP/DROP

  public getOnlineUsers(): number {
    return this.io?.engine.clientsCount || 0;
  }

  public getState() {
    return {
      ...this.state,
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

        // Reset in-memory state
        this.state = {
          currentPost: nextPost,
          remainingMs: this.INITIAL_MS,
          elapsedMs: 0,
          keepCount: 0,
          dropCount: 0,
          isTransitioning: false,
          transitionStatus: "none",
        };

        console.log(`[StageEngine] >> NEW POST ON AIR: "${nextPost.title}" (BGM: ${nextPost.bgmCategory}, Priority: ${nextPost.isPriority})`);

        // Broadcast STAGE_NEW_POST
        this.io?.emit("STAGE_NEW_POST", {
          post: this.state.currentPost,
          remainingMs: this.state.remainingMs,
          elapsedMs: this.state.elapsedMs,
          keepCount: this.state.keepCount,
          dropCount: this.state.dropCount,
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
