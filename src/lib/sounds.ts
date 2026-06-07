const ctx = () => new (window.AudioContext || (window as any).webkitAudioContext)();

function playTone(
  frequency: number,
  type: OscillatorType,
  duration: number,
  volume = 0.3,
  delay = 0
) {
  try {
    const ac = ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ac.currentTime + delay);

    gain.gain.setValueAtTime(0, ac.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);

    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration);
  } catch {
    // Silently fail si audio non supporté
  }
}

export const Sounds = {
  correct() {
    // Accord majeur montant — positif
    playTone(523, "sine", 0.15, 0.25, 0);
    playTone(659, "sine", 0.15, 0.25, 0.08);
    playTone(784, "sine", 0.2, 0.3, 0.16);
  },

  wrong() {
    // Descente dissonante — négatif
    playTone(300, "sawtooth", 0.1, 0.2, 0);
    playTone(200, "sawtooth", 0.15, 0.2, 0.1);
  },

  timeout() {
    // Bip grave court
    playTone(180, "sine", 0.3, 0.2, 0);
  },

  joker() {
    // Petite montée magique
    playTone(400, "sine", 0.08, 0.15, 0);
    playTone(600, "sine", 0.08, 0.15, 0.08);
    playTone(800, "sine", 0.12, 0.2, 0.16);
  },

  tick() {
    // Tick discret pour les 5 dernières secondes
    playTone(1000, "square", 0.03, 0.08, 0);
  },

  victory() {
    // Fanfare finale
    playTone(523, "sine", 0.15, 0.3, 0);
    playTone(659, "sine", 0.15, 0.3, 0.1);
    playTone(784, "sine", 0.15, 0.3, 0.2);
    playTone(1047, "sine", 0.3, 0.4, 0.3);
  },

  result(money: number, status: string) {
    if (status === "won") {
      this.victory();
      return;
    }

    if (money <= 0) {
      this.wrong();
      return;
    }

    if (money < 10_000) {
      playTone(392, "sine", 0.12, 0.2, 0);
      playTone(494, "sine", 0.14, 0.2, 0.12);
      return;
    }

    if (money < 100_000) {
      playTone(440, "sine", 0.12, 0.22, 0);
      playTone(554, "sine", 0.12, 0.22, 0.1);
      playTone(659, "sine", 0.18, 0.25, 0.2);
      return;
    }

    playTone(523, "sine", 0.12, 0.25, 0);
    playTone(659, "sine", 0.12, 0.25, 0.1);
    playTone(784, "sine", 0.16, 0.28, 0.2);
    playTone(988, "sine", 0.22, 0.32, 0.32);
  },
};
