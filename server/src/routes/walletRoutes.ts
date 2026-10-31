import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// GET /api/wallet/deposit-qr?amount=20000 - Sinh mã VietQR nạp tiền tự động
router.get("/deposit-qr", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Chưa xác thực." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, userNumber: true, username: true },
    });

    if (!user) {
      res.status(404).json({ error: "Người dùng không tồn tại." });
      return;
    }

    const rawAmount = parseInt(req.query.amount as string, 10);
    const amount = !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : 20000;

    const bankId = process.env.BANK_ID || "MB";
    const bankAccountNo = process.env.BANK_ACCOUNT_NO || "0123456789";
    const bankAccountName = process.env.BANK_ACCOUNT_NAME || "NGUYEN VAN A";

    // Format: DROP60 U{userNumber} (e.g. DROP60 U15) or DROP60 U{userId}
    const userIdentifier = user.userNumber !== null && user.userNumber !== undefined ? user.userNumber : user.id;
    const transferContent = `DROP60 U${userIdentifier}`;

    const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
      transferContent
    )}&accountName=${encodeURIComponent(bankAccountName)}`;

    res.status(200).json({
      qrUrl,
      bankId,
      accountNo: bankAccountNo,
      accountName: bankAccountName,
      amount,
      transferContent,
      userId: user.id,
      userNumber: user.userNumber,
      username: user.username,
    });
  } catch (err) {
    console.error("[Deposit QR Error]:", err);
    res.status(500).json({ error: "Lỗi máy chủ khi tạo mã VietQR." });
  }
});

// POST /api/wallet/mock-deposit - Cũ: nạp nhanh 20k local
router.post("/mock-deposit", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Chưa xác thực." });
      return;
    }

    const DEPOSIT_AMOUNT = 20000.0;

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: req.user!.userId },
        data: {
          balance: {
            increment: DEPOSIT_AMOUNT,
          },
        },
        select: {
          id: true,
          username: true,
          balance: true,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: req.user!.userId,
          amount: DEPOSIT_AMOUNT,
          type: "deposit",
          referenceCode: `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
      });

      return { user: updatedUser, transaction };
    });

    res.status(200).json({
      message: "Nạp thử nghiệm 20.000 VNĐ thành công!",
      balance: result.user.balance,
      transaction: result.transaction,
    });
  } catch (error) {
    console.error("[Mock Deposit Error]:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi nạp tiền thử nghiệm." });
  }
});

export default router;
