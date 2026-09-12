// Sons sintetizados via WebAudio (sem arquivos externos).

let ctx: AudioContext | null = null;
let volume = 0.7;
let musicVolume = 0.4;
let battleMusicTimer: number | null = null;

export function setSfxVolume(v: number) {
  volume = v;
}

export function setMusicVolume(v: number) {
  musicVolume = v;
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.2, slideTo?: number) {
  const c = ensure();
  if (!c || volume <= 0) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), c.currentTime + dur);
  g.gain.setValueAtTime(gain * volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

export function playSound(name: string) {
  switch (name) {
    case "shot":
      beep(320, 0.09, "square", 0.16, 90);
      break;
    case "reload":
      beep(180, 0.12, "triangle", 0.12, 260);
      break;
    case "hurt":
      beep(140, 0.15, "sawtooth", 0.15, 70);
      break;
    case "diamond":
      beep(880, 0.12, "triangle", 0.14, 1200);
      break;
    case "buy":
      beep(660, 0.1, "square", 0.12, 990);
      break;
    case "core":
      beep(90, 0.5, "sawtooth", 0.22, 40);
      break;
    case "respawn":
      beep(400, 0.25, "sine", 0.14, 800);
      break;
    case "victory":
      beep(523, 0.2, "square", 0.16);
      setTimeout(() => beep(784, 0.35, "square", 0.16), 180);
      break;
    case "defeat":
      beep(300, 0.4, "sawtooth", 0.16, 110);
      break;
    default:
      break;
  }
}

// Tema original de batalha chiptune: não reproduz músicas de outros jogos.
const BATTLE_MELODY = [659, 784, 880, 784, 659, 587, 659, 523, 659, 784, 988, 784, 698, 659, 587, 523];
const BATTLE_BASS = [131, 131, 147, 147, 165, 165, 147, 147];

function musicNote(c: AudioContext, when: number, freq: number, duration: number, gain: number, type: OscillatorType) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(Math.max(0.0001, gain * musicVolume), when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(g).connect(c.destination);
  osc.start(when);
  osc.stop(when + duration + 0.03);
}

export function startBattleMusic() {
  if (battleMusicTimer !== null) return;
  const c = ensure();
  if (!c) return;
  const step = 0.19;
  const cycle = BATTLE_MELODY.length * step;
  const schedule = () => {
    const start = c.currentTime + 0.06;
    for (let i = 0; i < BATTLE_MELODY.length; i++) {
      const when = start + i * step;
      musicNote(c, when, BATTLE_MELODY[i]!, step * 0.72, 0.075, "square");
      if (i % 2 === 0) musicNote(c, when, BATTLE_BASS[(i / 2) % BATTLE_BASS.length]!, step * 1.5, 0.095, "triangle");
    }
  };
  schedule();
  battleMusicTimer = window.setInterval(schedule, cycle * 1000);
}

export function stopBattleMusic() {
  if (battleMusicTimer !== null) window.clearInterval(battleMusicTimer);
  battleMusicTimer = null;
}
