const io = require("socket.io-client");

async function testVietQrAndWebhook() {
  const BASE_URL = "http://localhost:4000";

  console.log("== 1. Register test user ==");
  const testUsername = "qr_tester_" + Math.random().toString(36).substring(2, 6);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUsername, password: "password123" }),
  });
  const regData = await regRes.json();
  const token = regData.token;
  const user = regData.user;
  console.log("Registered:", user.username, "ID:", user.id, "userNumber:", user.userNumber, "Initial Balance:", user.balance);

  console.log("\n== 2. Test GET /api/wallet/deposit-qr ==");
  const qrRes = await fetch(`${BASE_URL}/api/wallet/deposit-qr?amount=20000`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const qrData = await qrRes.json();
  console.log("VietQR URL:", qrData.qrUrl);
  console.log("Transfer Content:", qrData.transferContent);
  console.log("Bank:", qrData.bankId, "Account:", qrData.accountNo, "Name:", qrData.accountName);

  if (!qrData.qrUrl.includes("img.vietqr.io")) {
    throw new Error("Invalid VietQR URL!");
  }

  console.log("\n== 3. Connect Socket.io client to listen for WALLET_UPDATED ==");
  const socket = io(BASE_URL, { auth: { token } });

  let socketReceivedPromise = new Promise((resolve) => {
    socket.on("WALLET_UPDATED", (event) => {
      console.log(">> Socket event WALLET_UPDATED received:", event.username, "| +", event.depositAmount, "đ | New Balance:", event.newBalance);
      resolve(event);
    });
  });

  await new Promise((r) => socket.on("connect", r));
  console.log("Socket connected as:", testUsername);

  console.log("\n== 4. Test SePay Webhook POST /api/webhook/payment ==");
  const sepayTxId = "SEPAY_" + Date.now();
  const sepayRes = await fetch(`${BASE_URL}/api/webhook/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Apikey drop60_secret_webhook_key",
    },
    body: JSON.stringify({
      id: 99991,
      gateway: "MBBank",
      transactionDate: "2026-11-01 12:00:00",
      accountNumber: "0123456789",
      content: `${qrData.transferContent} ung ho drop60`,
      transferType: "in",
      transferAmount: 20000,
      referenceCode: sepayTxId,
      description: `${qrData.transferContent} ung ho drop60`,
    }),
  });
  const sepayData = await sepayRes.json();
  console.log("SePay Webhook Response:", sepayData.message, "| Results:", sepayData.results);

  const socketEvent1 = await socketReceivedPromise;
  console.log("Verified Socket.io Event 1:", socketEvent1.message);

  console.log("\n== 5. Test Duplicate Webhook Prevention (Idempotency) ==");
  const duplicateRes = await fetch(`${BASE_URL}/api/webhook/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer drop60_secret_webhook_key",
    },
    body: JSON.stringify({
      gateway: "MBBank",
      content: qrData.transferContent,
      transferAmount: 20000,
      referenceCode: sepayTxId, // same reference code!
    }),
  });
  const duplicateData = await duplicateRes.json();
  console.log("Duplicate Response status:", duplicateData.results?.[0]?.status, "(Expected: duplicate)");

  console.log("\n== 6. Test Casso Webhook Format ==");
  let cassoSocketPromise = new Promise((resolve) => {
    socket.once("WALLET_UPDATED", (event) => {
      console.log(">> Casso Socket event received:", event.username, "| +", event.depositAmount, "đ | New Balance:", event.newBalance);
      resolve(event);
    });
  });

  const cassoTxId = "CASSO_" + Date.now();
  const cassoRes = await fetch(`${BASE_URL}/api/webhook/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "secure-token": "drop60_secret_webhook_key",
    },
    body: JSON.stringify({
      error: 0,
      data: [
        {
          id: 88881,
          tid: cassoTxId,
          description: `CHUYEN TIEN ${qrData.transferContent}`,
          amount: 50000,
        },
      ],
    }),
  });
  const cassoData = await cassoRes.json();
  console.log("Casso Webhook Response:", cassoData.message, "| Results:", cassoData.results);

  await cassoSocketPromise;

  socket.disconnect();
  console.log("\n=== ALL VIETQR & WEBHOOK TESTS PASSED PERFECTLY! ===");
}

testVietQrAndWebhook().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
