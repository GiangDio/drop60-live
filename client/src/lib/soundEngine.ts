// Web Audio API Synthesizer & Speech Synthesis Engine for DROP60.LIVE
// Completely self-contained - zero external audio files needed

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // 1. Tiếng "bíp trầm" khi bấm DROP (Low descending thud)
  public playDrop() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      const now = ctx.currentTime;

      // Frequency drops from 160Hz down to 55Hz
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {
      console.warn("Audio playDrop failed:", e);
    }
  }

  // 2. Tiếng "ting cao" khi bấm KEEP (High crystal chime)
  public playKeep() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Two harmonic sine waves for a crystalline ting
      [880, 1760].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        const initialVol = idx === 0 ? 0.25 : 0.15;
        gain.gain.setValueAtTime(initialVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.26);
      });
    } catch (e) {
      console.warn("Audio playKeep failed:", e);
    }
  }

  // 3. Tiếng gõ phím nhẹ khi có Danmaku / Chat mới
  public playChat() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn("Audio playChat failed:", e);
    }
  }

  // 4. Tiếng ghim tin nhắn vàng 5k (Golden Sparkle Chime)
  public playHighlight() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        const noteStart = now + i * 0.07;
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.2, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.32);
      });
    } catch (e) {
      console.warn("Audio playHighlight failed:", e);
    }
  }

  // 5. Tiếng đóng dấu DROPPED (Heavy impact boom)
  public playStampDropped() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    } catch (e) {
      console.warn("Audio playStampDropped failed:", e);
    }
  }

  // 6. Tiếng vinh danh TOP TIER (Triumphant fanfare)
  public playStampTopTier() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chord = [440, 554.37, 659.25, 880]; // A major chord

      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.82);
      });
    } catch (e) {
      console.warn("Audio playStampTopTier failed:", e);
    }
  }

  // 7. Đọc to tiêu đề bài viết mới bằng Web Speech API (window.speechSynthesis)
  public speakPostTitle(title: string) {
    if (typeof window === "undefined" || !window.speechSynthesis || this.isMuted) return;

    try {
      window.speechSynthesis.cancel(); // Dừng câu đọc trước đó nếu còn
      const cleanTitle = title.replace(/[#*_~`]/g, "").slice(0, 80);
      const utterance = new SpeechSynthesisUtterance(cleanTitle);

      // Thử tìm giọng đọc tiếng Việt nếu trình duyệt hỗ trợ
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.includes("vi") || v.lang.includes("VN"));
      if (viVoice) {
        utterance.voice = viVoice;
      }
      utterance.lang = "vi-VN";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Web Speech API failed:", err);
    }
  }
}

export const soundEngine = new SoundEngine();
