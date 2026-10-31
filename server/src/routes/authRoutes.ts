import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "drop60-live-super-secret-jwt-key-2026";

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      res.status(400).json({ error: "Tên đăng nhập phải có ít nhất 3 ký tự." });
      return;
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check existing user
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (existing) {
      res.status(409).json({ error: "Tên đăng nhập đã tồn tại, vui lòng chọn tên khác." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with 50,000 VND default balance for testing
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        passwordHash,
        balance: 50000.0,
      },
      select: {
        id: true,
        username: true,
        balance: true,
        createdAt: true,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Đăng ký thành công! Bạn nhận được 50.000 VNĐ trải nghiệm.",
      token,
      user,
    });
  } catch (error) {
    console.error("[Register Error]:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng ký tài khoản." });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (!user) {
      res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác." });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[Login Error]:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng nhập." });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Chưa xác thực." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        balance: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Không tìm thấy người dùng." });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("[Me Error]:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy thông tin người dùng." });
  }
});

export default router;
