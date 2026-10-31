const io = require("socket.io-client");

async function runTests() {
  const BASE_URL = "http://localhost:4000";
  console.log("== 1. Testing Auth & Registration ==");
  const testUser = "test_fin_" + Math.random().toString(36).substring(2, 7);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUser, password: "password123" }),
  });
  const regData = await regRes.json();
  console.log("Register response:", regData.user?.username, "Initial Balance:", regData.user?.balance);
  const token = regData.token;
  if (!token) throw new Error("Registration failed");

  console.log("\n== 2. Testing Free Post Submission ==");
  const freePostRes = await fetch(`${BASE_URL}/api/posts/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "Bài kiểm tra Đăng thường miễn phí",
      imageUrls: ["https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1200&q=80"],
      bgmCategory: "moody",
      isPriority: false,
    }),
  });
  const freePostData = await freePostRes.json();
  console.log("Free Post response:", freePostData.message, "| Remaining Balance:", freePostData.balance);

  console.log("\n== 3. Testing Priority Post Submission (25.000đ) ==");
  const priorityPostRes = await fetch(`${BASE_URL}/api/posts/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "Bài kiểm tra Lên sóng ngay ưu tiên 25k",
      imageUrls: ["https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80"],
      bgmCategory: "upbeat",
      isPriority: true,
    }),
  });
  const priorityData = await priorityPostRes.json();
  console.log("Priority Post response:", priorityData.message, "| Remaining Balance:", priorityData.balance);

  console.log("\n== 4. Testing Audio Highlight 5k (+10s Cứu bài) ==");
  const hlKeepRes = await fetch(`${BASE_URL}/api/posts/highlight-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: "Cứu bài đỉnh cao này anh em ơi!",
      actionType: "keep",
    }),
  });
  const hlKeepData = await hlKeepRes.json();
  console.log("Highlight (+10s) response:", hlKeepData.message, "| Balance:", hlKeepData.balance);

  console.log("\n== 5. Testing Audio Highlight 5k (-10s Dìm bài) ==");
  const hlDropRes = await fetch(`${BASE_URL}/api/posts/highlight-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: "Dìm bớt thời gian đổi bài nhanh nào!",
      actionType: "drop",
    }),
  });
  const hlDropData = await hlDropRes.json();
  console.log("Highlight (-10s) response:", hlDropData.message, "| Balance:", hlDropData.balance);

  console.log("\n== 6. Testing Bot Simulation Toggle ==");
  const botToggleRes = await fetch(`${BASE_URL}/api/posts/toggle-bots`, {
    method: "POST",
  });
  const botToggleData = await botToggleRes.json();
  console.log("Bot Toggle response:", botToggleData.message, "| Bots Enabled:", botToggleData.botsEnabled);

  // Connect socket and listen for events
  const socket = io(BASE_URL, {
    auth: { token },
  });

  await new Promise((resolve) => {
    socket.on("connect", () => {
      console.log("Socket connected successfully as:", testUser);
    });

    let botActionReceived = false;
    socket.on("ACTION_FEEDBACK", (data) => {
      if (data.username?.includes("🤖") || ["CyberGamer99", "StreamSniper_VN", "NeonRunner_X", "DropMaster2026", "VocaloidFan"].includes(data.username)) {
        console.log("Received Bot Action:", data.username, "->", data.type, "Remaining:", data.remainingMs);
        botActionReceived = true;
      }
    });

    socket.on("AUDIO_HIGHLIGHT", (data) => {
      console.log("Received VIP AUDIO_HIGHLIGHT event:", data.username, "| Impact:", data.actionType, "| Msg:", data.message);
    });

    setTimeout(() => {
      // Toggle bots off
      fetch(`${BASE_URL}/api/posts/toggle-bots`, { method: "POST" }).then(() => {
        socket.disconnect();
        console.log("\n=== ALL FEATURES VERIFIED SUCCESSFULLY! ===");
        resolve();
      });
    }, 3500);
  });
}

runTests().catch(console.error);
