const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, 'client', 'public', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

function createWavBuffer(sampleRate, durationSec, generatorFn) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const numChannels = 1; // mono
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM = 1
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // blockAlign
  buffer.writeUInt16LE(16, 34); // bitsPerSample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = generatorFn(t, durationSec, i);
    // Clamp to -1.0 .. 1.0
    sample = Math.max(-1.0, Math.min(1.0, sample));
    const intSample = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

const SAMPLE_RATE = 22050;

console.log('Generating procedural audio assets in /client/public/sounds/ ...');

// 1. SFX: drop_click (Low-frequency impact)
const dropClick = createWavBuffer(SAMPLE_RATE, 0.2, (t, dur) => {
  const env = Math.exp(-t * 25);
  const freq = 150 - t * 500;
  return Math.sin(2 * Math.PI * Math.max(30, freq) * t) * env * 0.8;
});
fs.writeFileSync(path.join(soundsDir, 'drop_click.wav'), dropClick);

// 2. SFX: keep_click (High crystalline ting)
const keepClick = createWavBuffer(SAMPLE_RATE, 0.25, (t, dur) => {
  const env = Math.exp(-t * 18);
  const s1 = Math.sin(2 * Math.PI * 880 * t);
  const s2 = Math.sin(2 * Math.PI * 1760 * t) * 0.5;
  const s3 = Math.sin(2 * Math.PI * 2640 * t) * 0.25;
  return (s1 + s2 + s3) * env * 0.5;
});
fs.writeFileSync(path.join(soundsDir, 'keep_click.wav'), keepClick);

// 3. SFX: chat_type (Mechanical typewriter click)
const chatType = createWavBuffer(SAMPLE_RATE, 0.08, (t, dur) => {
  const env = Math.exp(-t * 60);
  const noise = (Math.random() * 2 - 1) * 0.4;
  const tone = Math.sin(2 * Math.PI * 900 * t) * 0.6;
  return (noise + tone) * env * 0.4;
});
fs.writeFileSync(path.join(soundsDir, 'chat_type.wav'), chatType);

// 4. SFX: tick_urgent (Intense radar alert beep)
const tickUrgent = createWavBuffer(SAMPLE_RATE, 0.12, (t, dur) => {
  const env = Math.exp(-t * 30);
  const tone = Math.sin(2 * Math.PI * 1200 * t);
  return tone * env * 0.7;
});
fs.writeFileSync(path.join(soundsDir, 'tick_urgent.wav'), tickUrgent);

// 5. SFX: stamp_dropped (Heavy bass impact slam)
const stampDropped = createWavBuffer(SAMPLE_RATE, 0.6, (t, dur) => {
  const env = Math.exp(-t * 8);
  const noise = (Math.random() * 2 - 1) * 0.3 * Math.exp(-t * 20);
  const sub = Math.sin(2 * Math.PI * Math.max(25, 90 - t * 120) * t);
  return (sub + noise) * env * 0.9;
});
fs.writeFileSync(path.join(soundsDir, 'stamp_dropped.wav'), stampDropped);

// 6. SFX: stamp_toptier (Triumphant fanfare chord)
const stampTopTier = createWavBuffer(SAMPLE_RATE, 1.0, (t, dur) => {
  const env = Math.exp(-t * 3.5);
  // A major chord (440, 554, 659, 880)
  const a = Math.sin(2 * Math.PI * 440 * t);
  const cs = Math.sin(2 * Math.PI * 554.37 * t) * 0.8;
  const e = Math.sin(2 * Math.PI * 659.25 * t) * 0.8;
  const a2 = Math.sin(2 * Math.PI * 880 * t) * 0.6;
  return (a + cs + e + a2) * env * 0.35;
});
fs.writeFileSync(path.join(soundsDir, 'stamp_toptier.wav'), stampTopTier);

// 7. BGM 1: bgm_dramatic (8 seconds seamless loop - dark suspenseful pulsating bass & synth)
const bgmDramatic = createWavBuffer(SAMPLE_RATE, 8.0, (t, dur) => {
  const beat = (t % 0.5) / 0.5;
  const kickEnv = Math.exp(-beat * 12);
  const kick = Math.sin(2 * Math.PI * Math.max(35, 110 - beat * 200) * (beat * 0.5)) * kickEnv * 0.5;

  // Bass chord progression: Dm -> Bb -> Gm -> A
  const bar = Math.floor(t / 2) % 4;
  const rootFreqs = [73.42, 58.27, 49.0, 55.0]; // D2, Bb1, G1, A1
  const root = rootFreqs[bar];
  const bass = Math.sin(2 * Math.PI * root * t) * 0.35 + Math.sin(2 * Math.PI * (root * 2) * t) * 0.15;

  // Pulsing strings
  const pad = Math.sin(2 * Math.PI * (root * 4) * t) * 0.12 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 2 * t));

  return (kick + bass + pad) * 0.7;
});
fs.writeFileSync(path.join(soundsDir, 'bgm_dramatic.wav'), bgmDramatic);

// 8. BGM 2: bgm_upbeat (6 seconds seamless loop - energetic EDM synth & 4-on-the-floor beat)
const bgmUpbeat = createWavBuffer(SAMPLE_RATE, 6.0, (t, dur) => {
  const beatTime = 0.468; // ~128 BPM
  const phase = (t % beatTime) / beatTime;
  const kick = Math.sin(2 * Math.PI * Math.max(40, 130 - phase * 300) * phase) * Math.exp(-phase * 10) * 0.5;
  
  // Hi-hat on offbeat
  const offbeat = ((t + beatTime * 0.5) % beatTime) / beatTime;
  const hat = (Math.random() * 2 - 1) * Math.exp(-offbeat * 25) * 0.2;

  // Synth arpeggio (16th notes)
  const step = Math.floor((t / (beatTime / 4))) % 8;
  const arpNotes = [261.63, 329.63, 392.0, 523.25, 440.0, 392.0, 329.63, 293.66]; // C major pentatonic
  const noteFreq = arpNotes[step];
  const stepPhase = (t % (beatTime / 4)) / (beatTime / 4);
  const synth = (Math.sin(2 * Math.PI * noteFreq * t) + 0.3 * Math.sin(2 * Math.PI * noteFreq * 2 * t)) * Math.exp(-stepPhase * 8) * 0.3;

  return (kick + hat + synth) * 0.75;
});
fs.writeFileSync(path.join(soundsDir, 'bgm_upbeat.wav'), bgmUpbeat);

// 9. BGM 3: bgm_moody (8 seconds seamless loop - ambient chill wave / lofi chords)
const bgmMoody = createWavBuffer(SAMPLE_RATE, 8.0, (t, dur) => {
  // Soft vinyl noise
  const vinyl = (Math.random() * 2 - 1) * 0.03;

  // Slow chord progression (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
  const bar = Math.floor(t / 2) % 4;
  const chords = [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [164.81, 196.0, 246.94, 293.66], // Em7
    [146.83, 174.61, 220.0, 261.63], // Dm7
    [130.81, 164.81, 196.0, 246.94], // Cmaj7
  ];
  const currentChord = chords[bar];

  let chordSound = 0;
  for (const freq of currentChord) {
    chordSound += Math.sin(2 * Math.PI * freq * t) * 0.08;
    chordSound += Math.sin(2 * Math.PI * (freq * 2) * t) * 0.03;
  }
  // LFO tremolo
  chordSound *= (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.8 * t));

  // Gentle lofi sub kick on bar start
  const barPhase = (t % 2.0) / 2.0;
  const lofiKick = Math.sin(2 * Math.PI * 55 * barPhase) * Math.exp(-barPhase * 8) * 0.35;

  return (vinyl + chordSound + lofiKick) * 0.8;
});
fs.writeFileSync(path.join(soundsDir, 'bgm_moody.wav'), bgmMoody);

// 10. BGM 4: bgm_funny (6 seconds seamless loop - quirky playful bounce)
const bgmFunny = createWavBuffer(SAMPLE_RATE, 6.0, (t, dur) => {
  const beatTime = 0.375; // ~160 BPM bouncy
  const step = Math.floor(t / beatTime) % 8;
  const notes = [196.0, 246.94, 293.66, 392.0, 329.63, 293.66, 246.94, 196.0]; // G major bounce
  const noteFreq = notes[step];
  const phase = (t % beatTime) / beatTime;

  // Staccato pizzicato pluck
  const pluck = (Math.sin(2 * Math.PI * noteFreq * t) + 0.5 * Math.sin(2 * Math.PI * noteFreq * 3 * t)) * Math.exp(-phase * 14) * 0.45;
  // Bouncy spring modulation
  const spring = Math.sin(2 * Math.PI * 120 * phase) * Math.exp(-phase * 10) * 0.2;

  return (pluck + spring) * 0.7;
});
fs.writeFileSync(path.join(soundsDir, 'bgm_funny.wav'), bgmFunny);

console.log('All 10 sound assets generated successfully in /client/public/sounds/!');
