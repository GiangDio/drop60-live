// Centralized Audio Manager using Howler.js for DROP60.LIVE
// Manages 4 Looping BGM tracks, SFX, Audio Ducking, and Mobile Autoplay Policy

import { Howl, Howler } from "howler";

export type BgmCategory = "dramatic" | "upbeat" | "moody" | "funny";

export type SfxName =
  | "drop_click"
  | "keep_click"
  | "chat_type"
  | "tick_urgent"
  | "stamp_dropped"
  | "stamp_toptier";

class AudioManager {
  private bgmMap: Map<BgmCategory, Howl> = new Map();
  private sfxMap: Map<SfxName, Howl> = new Map();

  private currentBgmCategory: BgmCategory | null = null;
  private currentBgmHowl: Howl | null = null;

  private isMuted: boolean = false;
  private isUnlocked: boolean = false;
  private isDucked: boolean = false;

  private readonly NORMAL_BGM_VOL = 0.5;
  private readonly DUCKED_BGM_VOL = 0.12;

  private lastUrgentTickTime: number = 0;
  private unlockListeners: Set<(unlocked: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.initSounds();
      this.setupAutoplayListener();
    }
  }

  private initSounds() {
    // 1. Initialize BGM Streams (loop: true, html5: true for smooth streaming & background play)
    const bgmConfigs: Record<BgmCategory, string> = {
      dramatic: "/sounds/bgm_dramatic.wav",
      upbeat: "/sounds/bgm_upbeat.wav",
      moody: "/sounds/bgm_moody.wav",
      funny: "/sounds/bgm_funny.wav",
    };

    (Object.keys(bgmConfigs) as BgmCategory[]).forEach((cat) => {
      const howl = new Howl({
        src: [bgmConfigs[cat]],
        loop: true,
        html5: true,
        volume: this.NORMAL_BGM_VOL,
        preload: true,
      });
      this.bgmMap.set(cat, howl);
    });

    // 2. Initialize SFX Streams (Web Audio API buffer for zero latency)
    const sfxConfigs: Record<SfxName, string> = {
      drop_click: "/sounds/drop_click.wav",
      keep_click: "/sounds/keep_click.wav",
      chat_type: "/sounds/chat_type.wav",
      tick_urgent: "/sounds/tick_urgent.wav",
      stamp_dropped: "/sounds/stamp_dropped.wav",
      stamp_toptier: "/sounds/stamp_toptier.wav",
    };

    (Object.keys(sfxConfigs) as SfxName[]).forEach((sfx) => {
      const howl = new Howl({
        src: [sfxConfigs[sfx]],
        html5: false,
        preload: true,
        volume: 0.8,
      });
      this.sfxMap.set(sfx, howl);
    });
  }

  private setupAutoplayListener() {
    if (typeof window === "undefined") return;

    // Detect browser audio context unlock
    const checkState = () => {
      if (Howler.ctx && Howler.ctx.state === "running") {
        this.setUnlocked(true);
      }
    };

    window.addEventListener("click", checkState, { once: false, passive: true });
    window.addEventListener("touchstart", checkState, { once: false, passive: true });
    window.addEventListener("keydown", checkState, { once: false, passive: true });
  }

  private setUnlocked(val: boolean) {
    if (this.isUnlocked !== val) {
      this.isUnlocked = val;
      this.unlockListeners.forEach((fn) => fn(val));
      if (val && this.currentBgmHowl && !this.currentBgmHowl.playing() && !this.isMuted) {
        this.currentBgmHowl.play();
      }
    }
  }

  public onUnlockChange(fn: (unlocked: boolean) => void) {
    this.unlockListeners.add(fn);
    fn(this.isUnlocked);
    return () => this.unlockListeners.delete(fn);
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  // Force unlock audio context on explicit user click
  public unlockAudio() {
    if (typeof window === "undefined") return;

    try {
      if (Howler.ctx && Howler.ctx.state === "suspended") {
        Howler.ctx.resume();
      }
      this.setUnlocked(true);

      // Play current BGM if queued
      if (this.currentBgmHowl && !this.currentBgmHowl.playing() && !this.isMuted) {
        this.currentBgmHowl.play();
      }
    } catch (err) {
      console.warn("[AudioManager] Failed to resume Howler context:", err);
    }
  }

  // ==========================================
  // BGM MANAGEMENT WITH SEAMLESS CROSSFADE
  // ==========================================

  public playBgm(category: string | undefined) {
    if (typeof window === "undefined") return;

    const validCategory: BgmCategory =
      category && ["dramatic", "upbeat", "moody", "funny"].includes(category)
        ? (category as BgmCategory)
        : "dramatic";

    // If same category is already playing, keep playing smoothly
    if (this.currentBgmCategory === validCategory && this.currentBgmHowl?.playing()) {
      return;
    }

    const nextBgm = this.bgmMap.get(validCategory);
    if (!nextBgm) return;

    const prevBgm = this.currentBgmHowl;
    this.currentBgmCategory = validCategory;
    this.currentBgmHowl = nextBgm;

    const targetVol = this.isDucked ? this.DUCKED_BGM_VOL : this.NORMAL_BGM_VOL;

    if (prevBgm && prevBgm.playing()) {
      // Crossfade: Fade out previous track in 600ms, fade in new track in 600ms
      prevBgm.fade(prevBgm.volume(), 0, 600);
      setTimeout(() => {
        prevBgm.stop();
      }, 650);

      nextBgm.volume(0);
      nextBgm.play();
      nextBgm.fade(0, targetVol, 600);
    } else {
      nextBgm.volume(targetVol);
      if (this.isUnlocked && !this.isMuted) {
        nextBgm.play();
      }
    }
  }

  public stopBgm() {
    if (this.currentBgmHowl) {
      this.currentBgmHowl.fade(this.currentBgmHowl.volume(), 0, 400);
      setTimeout(() => {
        this.currentBgmHowl?.stop();
      }, 450);
    }
  }

  // ==========================================
  // AUDIO DUCKING MECHANISM (FOR TTS)
  // ==========================================

  public duckBgm(durationMs: number = 300) {
    if (!this.currentBgmHowl || this.isDucked) return;
    this.isDucked = true;

    try {
      const fromVol = this.currentBgmHowl.volume();
      this.currentBgmHowl.fade(fromVol, this.DUCKED_BGM_VOL, durationMs);
    } catch (e) {
      console.warn("[AudioManager] duckBgm failed:", e);
    }
  }

  public unduckBgm(durationMs: number = 500) {
    if (!this.currentBgmHowl || !this.isDucked) return;
    this.isDucked = false;

    try {
      const fromVol = this.currentBgmHowl.volume();
      this.currentBgmHowl.fade(fromVol, this.NORMAL_BGM_VOL, durationMs);
    } catch (e) {
      console.warn("[AudioManager] unduckBgm failed:", e);
    }
  }

  // Speak with automatic audio ducking
  public speakWithDucking(
    text: string,
    options: {
      volume?: number;
      rate?: number;
      pitch?: number;
      lang?: string;
    } = {}
  ) {
    if (typeof window === "undefined" || !window.speechSynthesis || this.isMuted) {
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const cleanText = text.replace(/[#*_~`]/g, "").slice(0, 100);
      const utterance = new SpeechSynthesisUtterance(cleanText);

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.includes("vi") || v.lang.includes("VN"));
      if (viVoice) {
        utterance.voice = viVoice;
      }
      utterance.lang = options.lang || "vi-VN";
      utterance.rate = options.rate || 1.05;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume !== undefined ? options.volume : 1.0;

      // Duck BGM immediately when speech starts
      utterance.onstart = () => {
        this.duckBgm(250);
      };

      // Unduck BGM when speech ends or errors out
      utterance.onend = () => {
        this.unduckBgm(500);
      };

      utterance.onerror = () => {
        this.unduckBgm(400);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[AudioManager] speakWithDucking failed:", err);
      this.unduckBgm(300);
    }
  }

  public cancelSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.unduckBgm(300);
    }
  }

  // ==========================================
  // SFX PLAYERS
  // ==========================================

  public playDrop() {
    if (this.isMuted) return;
    this.sfxMap.get("drop_click")?.play();
  }

  public playKeep() {
    if (this.isMuted) return;
    this.sfxMap.get("keep_click")?.play();
  }

  public playChat() {
    if (this.isMuted) return;
    this.sfxMap.get("chat_type")?.play();
  }

  // Throttle tick so it only clicks once every 800ms
  public playUrgentTick() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastUrgentTickTime >= 850) {
      this.lastUrgentTickTime = now;
      this.sfxMap.get("tick_urgent")?.play();
    }
  }

  public playStampDropped() {
    if (this.isMuted) return;
    this.sfxMap.get("stamp_dropped")?.play();
  }

  public playStampTopTier() {
    if (this.isMuted) return;
    this.sfxMap.get("stamp_toptier")?.play();
  }

  // ==========================================
  // MUTE / UNMUTE MANAGEMENT
  // ==========================================

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);

    if (!this.isMuted) {
      this.unlockAudio();
    } else {
      this.cancelSpeech();
    }

    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const audioManager = new AudioManager();
