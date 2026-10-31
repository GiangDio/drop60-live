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
import ttsRoutes from "./routes/ttsRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import { AuthenticatedUser } from "./middleware/auth";
import { seedSamplePosts } from "./services/seedService";
import { stageEngine } from "./services/stageEngine";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "drop60-live-super-secret-jwt-key-2026";

// Parse ALLOWED_ORIGINS: Comma-separated list of origins, with local fallback
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "http://localhost:3000";
const configuredOrigins = rawAllowedOrigins
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Always ensure local development origins are present
["http://localhost:3000", "http://127.0.0.1:3000"].forEach((loc) => {
  if (!configuredOrigins.includes(loc)) configuredOrigins.push(loc);
});

export const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, Render health check)
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/$/, "");

  // 1. Wildcard allow-all
  if (configuredOrigins.includes("*")) return true;

  // 2. Exact match in configured ALLOWED_ORIGINS
  if (configuredOrigins.includes(cleanOrigin)) return true;

  // 3. Automatically allow all *.vercel.app preview & production domains
  try {
    const parsed = new URL(cleanOrigin);
    if (parsed.hostname.endsWith(".vercel.app")) {
      return true;
    }
  } catch {
    // Ignore invalid origin URLs
  }

  return false;
};

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/webhook", webhookRoutes);

// Health check endpoint (compatible with Render & automated monitoring)
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      service: "DROP60.LIVE Backend",
      timestamp: new Date().toISOString(),
      database: "connected",
      stage: stageEngine.getState(),
    });
  } catch (error) {
    res.status(200).json({
      status: "degraded",
      uptime: process.uptime(),
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

// Create HTTP and Socket.IO server with resilient transport options
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`[Socket.io CORS] Blocked connection from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
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

  // Join user room for targeted notifications (e.g. deposit webhook)
  socket.join(`user:${user.userId}`);
  socket.join(`user:${user.username}`);

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
      console.log(`📡 Allowed Origins: [${configuredOrigins.join(", ")}] (*.vercel.app auto-allowed)`);
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
