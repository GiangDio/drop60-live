import { Router, Request, Response } from "express";
import { ttsService } from "../services/ttsService";

const router = Router();

// GET /api/tts/:filename - Serve cached MP3 audio file
router.get("/:filename", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawFilename = req.params.filename;
    const hash = rawFilename.replace(/\.mp3$/, "");

    const buffer = ttsService.getCachedBuffer(hash);
    if (!buffer) {
      res.status(404).json({ error: "File âm thanh TTS không tồn tại hoặc đã hết hạn." });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Accept-Ranges", "bytes");

    res.status(200).send(buffer);
  } catch (err) {
    console.error("[TTS Route Error]:", err);
    res.status(500).json({ error: "Lỗi máy chủ khi phát âm thanh TTS." });
  }
});

// GET /api/tts?text=... - On-demand TTS generation and streaming
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const text = req.query.text as string;
    if (!text || !text.trim()) {
      res.status(400).json({ error: "Tham số 'text' không được để trống." });
      return;
    }

    const result = await ttsService.synthesize(text.trim());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", result.buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("X-TTS-Hash", result.hash);
    res.setHeader("X-TTS-Provider", result.provider);

    res.status(200).send(result.buffer);
  } catch (err) {
    console.error("[TTS Generate Error]:", err);
    res.status(500).json({ error: "Lỗi khi tạo giọng đọc TTS." });
  }
});

export default router;
