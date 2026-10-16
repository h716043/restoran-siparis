// Web Audio API tabanlı GloriaFood tarzı sipariş zili ve masa garson çağrı zili
class SoundAlertManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playOrderRing() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // GloriaFood benzeri 3'lü dikkat çekici melodi (Ding - Dong - Ding!)
    const notes = [
      { freq: 880, start: 0, duration: 0.18 }, // A5
      { freq: 1174.66, start: 0.2, duration: 0.18 }, // D6
      { freq: 1318.51, start: 0.4, duration: 0.35 }, // E6
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.4, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + n.start + n.duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.duration);
    }
  }

  public playTableCallRing() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Masa Çağrısı / Hesap İsteği için çift resepsiyon çanı sesi
    const notes = [
      { freq: 1046.5, start: 0, duration: 0.22 }, // C6
      { freq: 783.99, start: 0.25, duration: 0.35 }, // G5
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.45, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + n.start + n.duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.duration);
    }
  }

  public playReadyBeep() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 987.77, start: 0, duration: 0.2 }, // B5
      { freq: 1318.51, start: 0.22, duration: 0.4 }, // E6
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.4, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + n.start + n.duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.duration);
    }
  }
}

export const soundAlert = new SoundAlertManager();
