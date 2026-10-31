import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// POST /api/wallet/mock-deposit
router.post("/mock-deposit", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Chưa xác thực." });
      return;
    }

    const DEPOSIT_AMOUNT = 20000.0;

    // Use interactive transaction to ensure balance and transaction record are in sync
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
