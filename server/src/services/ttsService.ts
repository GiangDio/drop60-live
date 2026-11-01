import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as googleTTS from "google-tts-api";

export interface ITTSAdapter {
  name: string;
  generateAudio(text: string, lang?: string): Promise<Buffer>;
}

// ============================================================
// Adapter 1: Google Translate TTS Adapter (Local Free Default)
// ============================================================
class GoogleTTSAdapter implements ITTSAdapter {
  public name = "google";

  public async generateAudio(text: string, lang: string = "vi"): Promise<Buffer> {
    try {
      // 1. Try google-tts-api base64 retrieval
      const base64Audio = await googleTTS.getAudioBase64(text, {
        lang,
        slow: false,
        host: "https://translate.google.com",
        timeout: 10000,
      });
      return Buffer.from(base64Audio, "base64");
    } catch (apiErr) {
      console.warn("[GoogleTTSAdapter] google-tts-api package failed, falling back to direct tw-ob endpoint:", apiErr);
      // 2. Direct fallback to Google Translate endpoint
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) {
        throw new Error(`Google Translate TTS returned status ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }
}

// ============================================================
// Adapter 2: OpenAI Audio TTS Adapter (Production Quality)
// ============================================================
class OpenAITTSAdapter implements ITTSAdapter {
  public name = "openai";
  private apiKey: string;
  private voice: string;

  constructor(apiKey: string, voice: string = "alloy") {
    this.apiKey = apiKey;
    this.voice = voice;
  }

  public async generateAudio(text: string): Promise<Buffer> {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: this.voice,
        input: text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI TTS error (${res.status}): ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

// ============================================================
// Adapter 3: ElevenLabs TTS Adapter (Hyper-realistic Voice)
// ============================================================
class ElevenLabsTTSAdapter implements ITTSAdapter {
  public name = "elevenlabs";
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  public async generateAudio(text: string): Promise<Buffer> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs TTS error (${res.status}): ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

// ============================================================
// TTSService Manager with Disk Cache & Architecture
// ============================================================
export interface TTSSynthesizeResult {
  hash: string;
  url: string;
  buffer: Buffer;
  provider: string;
}

class TTSService {
  private adapter: ITTSAdapter;
  private cacheDir: string;

  constructor() {
    this.cacheDir = path.join(process.cwd(), "cache", "tts");
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Determine adapter based on environment variables
    const provider = process.env.TTS_PROVIDER?.toLowerCase() || "google";
    const openaiKey = process.env.OPENAI_API_KEY;
    const elevenlabsKey = process.env.ELEVENLABS_API_KEY;

    if (provider === "elevenlabs" && elevenlabsKey) {
      console.log("[TTSService] Using ElevenLabs TTS Adapter.");
      this.adapter = new ElevenLabsTTSAdapter(elevenlabsKey, process.env.ELEVENLABS_VOICE_ID);
    } else if (provider === "openai" && openaiKey) {
      console.log("[TTSService] Using OpenAI TTS Adapter.");
      this.adapter = new OpenAITTSAdapter(openaiKey, process.env.OPENAI_TTS_VOICE || "alloy");
    } else {
      console.log("[TTSService] Using Google Translate Vietnamese TTS Adapter (Free Local Default).");
      this.adapter = new GoogleTTSAdapter();
    }
  }

  public getHash(text: string): string {
    return crypto
      .createHash("sha256")
      .update(text.trim() + "_" + this.adapter.name)
      .digest("hex")
      .slice(0, 24);
  }

  public getCachedBuffer(hash: string): Buffer | null {
    const filePath = path.join(this.cacheDir, `${hash}.mp3`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  }

  public async synthesize(text: string): Promise<TTSSynthesizeResult> {
    const cleanText = text.replace(/[#*_~`]/g, "").trim().slice(0, 150);
    const hash = this.getHash(cleanText);
    const cached = this.getCachedBuffer(hash);

    const rawBaseUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const baseUrl = rawBaseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/api/tts/${hash}.mp3`;

    if (cached) {
      return {
        hash,
        url,
        buffer: cached,
        provider: this.adapter.name,
      };
    }

    try {
      console.log(`[TTSService] Synthesizing audio for: "${cleanText}" via ${this.adapter.name}...`);
      const buffer = await this.adapter.generateAudio(cleanText, "vi");

      // Save to cache
      const filePath = path.join(this.cacheDir, `${hash}.mp3`);
      fs.writeFileSync(filePath, buffer);

      return {
        hash,
        url,
        buffer,
        provider: this.adapter.name,
      };
    } catch (err) {
      console.error("[TTSService] Synthesize failed, falling back to Google TTS:", err);
      // Fallback to Google Translate if external paid API failed
      if (this.adapter.name !== "google") {
        const fallbackAdapter = new GoogleTTSAdapter();
        const buffer = await fallbackAdapter.generateAudio(cleanText, "vi");
        const filePath = path.join(this.cacheDir, `${hash}.mp3`);
        fs.writeFileSync(filePath, buffer);
        return {
          hash,
          url,
          buffer,
          provider: "google",
        };
      }
      throw err;
    }
  }
}

export const ttsService = new TTSService();
