import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { stageEngine } from "../services/stageEngine";

const router = Router();

// GET /api/posts/top-tier - Bảng vàng vinh danh
router.get("/top-tier", async (_req, res: Response): Promise<void> => {
  try {
    let topTierPosts = await prisma.post.findMany({
      where: { status: "top_tier" },
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // If no post has reached 180s top tier yet, also display top survived posts as honorable mentions
    if (topTierPosts.length === 0) {
      topTierPosts = await prisma.post.findMany({
        include: {
          user: { select: { username: true } },
        },
        orderBy: { survivedSeconds: "desc" },
        take: 10,
      });
    }

    res.status(200).json({ posts: topTierPosts });
  } catch (error) {
    console.error("[Get Top Tier Error]:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy danh sách Top Tier." });
  }
});

// POST /api/posts/create - Đăng bài mới lên hàng chờ (Miễn phí hoặc 25.000đ cho Priority Queue)
router.post("/create", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Chưa xác thực." });
      return;
    }

    const { title, imageUrls, bgmCategory, isPriority } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      res.status(400).json({ error: "Tiêu đề bài đăng phải có ít nhất 3 ký tự." });
      return;
    }

    let formattedImages: string[] = [];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      formattedImages = imageUrls.slice(0, 3);
    } else if (typeof imageUrls === "string" && imageUrls.trim()) {
      formattedImages = [imageUrls.trim()];
    } else {
      // Default fallback unsplash image
      formattedImages = ["https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1200&q=80"];
    }

    const PRIORITY_FEE = 25000.0; // 25.000 VNĐ cho Hàng chờ Ưu tiên
    const priority = Boolean(isPriority);

    const result = await prisma.$transaction(async (tx) => {
      // If priority queue is requested, deduct 25,000 VND
      if (priority) {
        const currentUser = await tx.user.findUnique({
          where: { id: req.user!.userId },
        });

        if (!currentUser || currentUser.balance < PRIORITY_FEE) {
          throw new Error("Số dư không đủ 25.000 VNĐ để đặt hàng chờ ưu tiên 'Lên sóng ngay'. Vui lòng nạp thêm tiền.");
        }

        await tx.user.update({
          where: { id: req.user!.userId },
          data: { balance: { decrement: PRIORITY_FEE } },
        });

        await tx.transaction.create({
          data: {
            userId: req.user!.userId,
            amount: -PRIORITY_FEE,
            type: "priority_queue",
          },
        });
      }

      const post = await tx.post.create({
        data: {
          userId: req.user!.userId,
          title: title.trim(),
          imageUrls: JSON.stringify(formattedImages),
          bgmCategory: ["dramatic", "upbeat", "moody", "funny"].includes(bgmCategory)
            ? bgmCategory
            : "dramatic",
          isPriority: priority,
          status: "queued",
          survivedSeconds: 0,
        },
        include: {
          user: { select: { username: true } },
        },
      });

      const updatedUser = await tx.user.findUnique({
        where: { id: req.user!.userId },
        select: { balance: true },
      });

      return { post, balance: updatedUser?.balance || 0 };
    });

    res.status(201).json({
      message: priority
        ? "Đăng bài Ưu tiên thành công! Trừ 25.000 VNĐ (sẽ phát sóng ngay bài kế tiếp)."
        : "Đăng bài Miễn phí thành công vào hàng đợi!",
      post: result.post,
      balance: result.balance,
    });
  } catch (error) {
    console.error("[Create Post Error]:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Lỗi khi đăng bài.",
    });
  }
});

// POST /api/posts/highlight-chat - Audio Highlight 5k (+10s hoặc -10s)
router.post("/highlight-chat", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Chưa xác thực." });
      return;
    }

    const { message, actionType } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Nội dung bình luận không được trống." });
      return;
    }

    if (message.trim().length > 100) {
      res.status(400).json({ error: "Nội dung bình luận tối đa 100 ký tự." });
      return;
    }

    const type = actionType === "drop" ? "drop" : "keep";
    const HIGHLIGHT_FEE = 5000.0;

    const result = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!currentUser || currentUser.balance < HIGHLIGHT_FEE) {
        throw new Error("Số dư không đủ 5.000 VNĐ để ghim bình luận Audio Highlight.");
      }

      const updatedUser = await tx.user.update({
        where: { id: req.user!.userId },
        data: { balance: { decrement: HIGHLIGHT_FEE } },
        select: { balance: true },
      });

      await tx.transaction.create({
        data: {
          userId: req.user!.userId,
          amount: -HIGHLIGHT_FEE,
          type: "audio_highlight",
        },
      });

      return { balance: updatedUser.balance };
    });

    // Broadcast VIP Audio Highlight event & impact +10s / -10s
    await stageEngine.handleAudioHighlight(req.user.username, message.trim(), type);

    res.status(200).json({
      message: `Audio Highlight 5.000 VNĐ thành công! Tác động ${type === "keep" ? "+10s (Cứu bài)" : "-10s (Dìm bài)"}.`,
      balance: result.balance,
    });
  } catch (error) {
    console.error("[Highlight Chat Error]:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Lỗi khi ghim bình luận.",
    });
  }
});

// POST /api/posts/toggle-bots - Bật/Tắt Bot Mồi giả lập
router.post("/toggle-bots", (_req, res: Response): Promise<void> => {
  const isEnabled = stageEngine.toggleBots();
  res.status(200).json({
    message: isEnabled ? "Đã bật Bot Mồi giả lập phòng chiếu!" : "Đã tắt Bot Mồi.",
    botsEnabled: isEnabled,
    onlineUsers: stageEngine.getOnlineUsers(),
  });
  return Promise.resolve();
});

export default router;
