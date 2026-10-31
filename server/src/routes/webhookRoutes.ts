import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { stageEngine } from "../services/stageEngine";

const router = Router();

// POST /api/webhook/payment - Webhook nhận biến động số dư SePay / Casso / Ngân hàng
router.post("/payment", async (req: Request, res: Response): Promise<void> => {
  try {
    const secretKey = process.env.WEBHOOK_SECRET_KEY || "drop60_secret_webhook_key";

    // 1. Verify Secret Key (supports SePay, Casso, Bearer, ApiKey, x-api-key, query, body)
    const authHeader = req.headers["authorization"] || "";
    const secureToken = req.headers["secure-token"] as string;
    const xApiKey = req.headers["x-api-key"] as string;
    const queryToken = req.query.token as string;
    const bodySecret = req.body?.secretKey;

    const providedKey =
      authHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim() ||
      secureToken ||
      xApiKey ||
      queryToken ||
      bodySecret;

    // Allow if secretKey matches, or if body contains simulated flag for local test
    const isAuthorized = !secretKey || providedKey === secretKey || req.body?.isLocalSimulation === true;

    if (!isAuthorized) {
      console.warn("[Webhook Payment] Unauthorized webhook attempt. Provided key:", providedKey);
      res.status(401).json({ error: "Unauthorized: Invalid webhook secret key." });
      return;
    }

    // 2. Parse payload: Support SePay (flat object) & Casso (nested in data array)
    const records = Array.isArray(req.body?.data) ? req.body.data : [req.body];
    const results = [];

    for (const record of records) {
      const content = String(record.content || record.description || record.orderCode || "").trim();
      const amount = Number(record.transferAmount || record.amount || 0);
      const transferType = String(record.transferType || "in").toLowerCase();

      // Ignore outward transfers or invalid amounts
      if (transferType === "out" || isNaN(amount) || amount <= 0) {
        continue;
      }

      // Unique reference code / transaction id for idempotency
      const refCode = String(
        record.referenceCode ||
        record.tid ||
        record.transactionId ||
        (record.id ? `SEPAY_${record.id}` : null) ||
        `TX_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      ).trim();

      // 3. Extract User identifier using Regex: DROP60 U(\d+) or DROP60 U([a-zA-Z0-9_-]+)
      const match = content.match(/DROP60\s*U([a-zA-Z0-9_-]+)/i);
      if (!match) {
        console.warn(`[Webhook Payment] Content "${content}" does not match DROP60 U pattern. Skipping.`);
        continue;
      }

      const extractedId = match[1];
      const isNumeric = /^\d+$/.test(extractedId);

      // Find user by userNumber or id (UUID)
      const targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(isNumeric ? [{ userNumber: parseInt(extractedId, 10) }] : []),
            { id: extractedId },
            { id: { startsWith: extractedId } },
          ],
        },
      });

      if (!targetUser) {
        console.warn(`[Webhook Payment] No user found for code U${extractedId} (content: "${content}").`);
        continue;
      }

      // 4. Check for duplicate transaction (Idempotency check)
      const existingTx = await prisma.transaction.findUnique({
        where: { referenceCode: refCode },
      });

      if (existingTx) {
        console.log(`[Webhook Payment] Duplicate transaction ignored: ${refCode}`);
        results.push({
          referenceCode: refCode,
          status: "duplicate",
          userId: targetUser.id,
        });
        continue;
      }

      // 5. ACID Transaction: Increment balance & record transaction
      const txResult = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: targetUser.id },
          data: { balance: { increment: amount } },
          select: { id: true, userNumber: true, username: true, balance: true },
        });

        const newTx = await tx.transaction.create({
          data: {
            userId: targetUser.id,
            amount,
            type: "deposit",
            referenceCode: refCode,
          },
        });

        return { user: updatedUser, transaction: newTx };
      });

      // 6. Broadcast Real-time WALLET_UPDATED Socket.io Event
      const formattedAmount = new Intl.NumberFormat("vi-VN").format(amount);
      const walletEvent = {
        userId: targetUser.id,
        userNumber: targetUser.userNumber,
        username: targetUser.username,
        newBalance: txResult.user.balance,
        depositAmount: amount,
        referenceCode: refCode,
        message: `🎉 Đã nạp thành công +${formattedAmount}đ vào tài khoản!`,
        timestamp: new Date().toISOString(),
      };

      console.log(`[Webhook Payment] Deposited +${amount} VND to @${targetUser.username} (Ref: ${refCode}). New Balance: ${txResult.user.balance}`);

      // Emit to targeted user room & broadcast to all tabs
      stageEngine.getIo()?.to(`user:${targetUser.id}`).emit("WALLET_UPDATED", walletEvent);
      stageEngine.getIo()?.emit("WALLET_UPDATED", walletEvent);

      results.push({
        referenceCode: refCode,
        status: "success",
        userId: targetUser.id,
        newBalance: txResult.user.balance,
        amount,
      });
    }

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error("[Webhook Payment Error]:", err);
    res.status(500).json({ error: "Lỗi máy chủ khi xử lý Webhook thanh toán." });
  }
});

export default router;
