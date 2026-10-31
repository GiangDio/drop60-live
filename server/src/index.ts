import express, { Request, Response } from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import prisma from "./prisma";
import authRoutes from "./routes/authRoutes";
import walletRoutes from "./routes/walletRoutes";
import postRoutes from "./routes/postRoutes";
import { AuthenticatedUser } from "./middleware/auth";
import { seedSamplePosts } from "./services/seedService";
import { stageEngine } from "./services/stageEngine";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "drop60-live-super-secret-jwt-key-2026";

// Middlewares
app.use(cors({
  origin: [CLIENT_URL, "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/posts", postRoutes);

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      service: "DROP60.LIVE Backend",
      timestamp: new Date().toISOString(),
      database: "connected (SQLite)",
      stage: stageEngine.getState(),
    });
  } catch (error) {
    res.status(200).json({
      status: "degraded",
      service: "DROP60.LIVE Backend",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/", (_req: Request, res: Response) => {
  res.send("DROP60.LIVE Realtime Stage Server is running.");
});

// Create HTTP and Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket.io Authentication Middleware
io.use((socket: Socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization &&
      socket.handshake.headers.authorization.split(" ")[1]);

  if (!token) {
    return next(new Error("Authentication error: Token required to join Live Stage"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    socket.data.user = decoded;
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid or expired token"));
  }
});

io.on("connection", (socket: Socket) => {
  const user = socket.data.user as AuthenticatedUser;
  console.log(`[Socket.io] User connected: ${user.username} (${socket.id}) | Online: ${stageEngine.getOnlineUsers()}`);

  // 1. Send current live stage snapshot immediately to new connection
  socket.emit("STAGE_INITIAL_STATE", stageEngine.getState());

  // 2. Send personalized welcome event
  socket.emit("stage:welcome", {
    message: `Xin chào ${user.username}! Chào mừng bạn đến với sàn diễn trực tiếp DROP60.LIVE 24/7.`,
    username: user.username,
    serverTime: new Date().toISOString(),
  });

  // 3. Handle ACTION_DROP (-200ms)
  socket.on("ACTION_DROP", () => {
    stageEngine.handleActionDrop(user.username);
  });

  // 4. Handle ACTION_KEEP (+200ms, capped at 180s)
  socket.on("ACTION_KEEP", () => {
    stageEngine.handleActionKeep(user.username);
  });

  // 5. Handle SEND_CHAT -> broadcast NEW_DANMAKU
  socket.on("SEND_CHAT", (data: { message: string }) => {
    stageEngine.handleSendChat(user.username, data?.message);
  });

  // 6. Handle ADMIN_TOGGLE_BOTS -> toggle bot simulation
  socket.on("ADMIN_TOGGLE_BOTS", () => {
    stageEngine.toggleBots();
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.io] User disconnected: ${user.username} (${socket.id}) | Online: ${stageEngine.getOnlineUsers()}`);
  });
});

// Initialize and start listening
async function bootstrap() {
  try {
    // 1. Seed initial sample posts if needed
    await seedSamplePosts();

    // 2. Start HTTP & Socket server
    server.listen(PORT, async () => {
      console.log(`===============================================`);
      console.log(`🚀 DROP60.LIVE Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections from ${CLIENT_URL}`);
      console.log(`🩺 Health check available at: http://localhost:${PORT}/health`);
      console.log(`===============================================`);

      // 3. Initialize Stage Core Loop
      await stageEngine.init(io);
    });
  } catch (err) {
    console.error("Fatal bootstrap error:", err);
    process.exit(1);
  }
}

bootstrap();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
