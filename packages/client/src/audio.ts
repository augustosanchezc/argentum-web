// Sonido del AO: los WAV originales del cliente (AUDIO/WAV del ao-cliente),
// servidos desde /ao-assets/wav/{n}.wav. WebAudio con caché de buffers.
//
// Números canónicos (Declares.bas del server + cliente clásico):
//   2 swing · 3 warp · 5 puerta · 6 subir nivel · 10 impacto cuerpo
//   11 muerte · 12 impacto2 · 23/24 pasos · 37 rechazo con escudo

export const SND = {
  swing: 2,
  warp: 3,
  puerta: 5,
  nivel: 6,
  impacto: 10,
  muerte: 11,
  impacto2: 12,
  paso1: 23,
  paso2: 24,
  escudo: 37,
} as const;

class AudioManager {
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<number, AudioBuffer | null>();
  private readonly pending = new Map<number, Promise<AudioBuffer | null>>();
  private unlocked = false;
  volume = 0.5;

  // Los navegadores bloquean el audio hasta el primer gesto del usuario.
  // Llamar en el primer keydown/click de la escena.
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.ctx = new AudioContext();
    void this.ctx.resume();
  }

  private async load(n: number): Promise<AudioBuffer | null> {
    if (this.buffers.has(n)) return this.buffers.get(n) ?? null;
    const inflight = this.pending.get(n);
    if (inflight) return inflight;

    const p = (async (): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(`/ao-assets/wav/${n.toString()}.wav`);
        if (!res.ok) throw new Error(`${res.status.toString()}`);
        const data = await res.arrayBuffer();
        const buf = await this.ctx!.decodeAudioData(data);
        this.buffers.set(n, buf);
        return buf;
      } catch {
        this.buffers.set(n, null); // no reintentar
        return null;
      } finally {
        this.pending.delete(n);
      }
    })();
    this.pending.set(n, p);
    return p;
  }

  // Reproduce el WAV n. vol relativo 0-1 (se multiplica por el master).
  play(n: number, vol = 1): void {
    if (!this.ctx || n <= 0) return;
    void this.load(n).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.value = this.volume * vol;
      src.connect(gain).connect(this.ctx.destination);
      src.start();
    });
  }
}

export const audio = new AudioManager();
