import { MODE_CONFIG, playbackTimingForRound } from '../modes';

describe('MODE_CONFIG', () => {
  it('tranqui no acelera ni permite invertidas', () => {
    expect(MODE_CONFIG.tranqui).toEqual({ accelerates: false, allowsReversal: false });
  });

  it('chunguillo acelera pero no permite invertidas', () => {
    expect(MODE_CONFIG.chunguillo).toEqual({ accelerates: true, allowsReversal: false });
  });

  it('nidecona acelera y permite invertidas', () => {
    expect(MODE_CONFIG.nidecona).toEqual({ accelerates: true, allowsReversal: true });
  });
});

describe('playbackTimingForRound', () => {
  it('sin aceleración, la velocidad es siempre la base, en cualquier ronda', () => {
    const base = playbackTimingForRound(1, false);
    expect(playbackTimingForRound(20, false)).toEqual(base);
  });

  it('con aceleración, las rondas 1-3 van a velocidad base', () => {
    const round1 = playbackTimingForRound(1, true);
    const round3 = playbackTimingForRound(3, true);
    expect(round1).toEqual(round3);
  });

  it('con aceleración, la ronda 4 es más rápida que la ronda 3', () => {
    const round3 = playbackTimingForRound(3, true);
    const round4 = playbackTimingForRound(4, true);
    expect(round4.toneOnMs).toBeLessThan(round3.toneOnMs);
    expect(round4.toneGapMs).toBeLessThan(round3.toneGapMs);
  });

  it('con aceleración, las rondas 4-6 tienen la misma velocidad entre sí', () => {
    expect(playbackTimingForRound(4, true)).toEqual(playbackTimingForRound(6, true));
  });

  it('con aceleración, la ronda 7 es más rápida que la ronda 6', () => {
    const round6 = playbackTimingForRound(6, true);
    const round7 = playbackTimingForRound(7, true);
    expect(round7.toneOnMs).toBeLessThan(round6.toneOnMs);
  });

  it('con aceleración, cada ronda desde la 7 es igual o más rápida que la anterior', () => {
    let previous = playbackTimingForRound(7, true);
    for (let round = 8; round <= 30; round += 1) {
      const current = playbackTimingForRound(round, true);
      expect(current.toneOnMs).toBeLessThanOrEqual(previous.toneOnMs);
      previous = current;
    }
  });

  it('con aceleración, nunca baja de un suelo mínimo', () => {
    const veryLateRound = playbackTimingForRound(100, true);
    const round50 = playbackTimingForRound(50, true);
    expect(veryLateRound).toEqual(round50);
    expect(veryLateRound.toneOnMs).toBeGreaterThan(0);
  });
});
