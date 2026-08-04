// Genera los tonos del juego como archivos WAV sintéticos (sin dependencias externas).
// Cada dirección lleva un timbre (forma de onda) y una nota distintos, no solo un tono
// diferente, para que sean reconocibles incluso con pérdida auditiva parcial en una banda.
// Ejecutar con: node scripts/generate-tones.js

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function envelope(t, duration) {
  const attack = 0.008;
  const release = 0.08;
  if (t < attack) return t / attack;
  if (t > duration - release) return Math.max(0, (duration - t) / release);
  return 1;
}

function waveform(shape, phase) {
  switch (shape) {
    case 'sine':
      return Math.sin(2 * Math.PI * phase);
    case 'square':
      return phase < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * phase - 1;
    case 'triangle':
      return 1 - 4 * Math.abs(phase - 0.5);
    default:
      throw new Error(`Forma de onda desconocida: ${shape}`);
  }
}

function renderTone({ shape, frequency, duration, amplitude = 0.5 }) {
  const sampleCount = Math.round(SAMPLE_RATE * duration);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / SAMPLE_RATE;
    const phase = (frequency * t) % 1;
    const value = waveform(shape, phase) * envelope(t, duration) * amplitude;
    samples[i] = Math.max(-1, Math.min(1, value)) * 32767;
  }
  return samples;
}

// Barrido de frecuencia (frequency sweep / chirp): a diferencia de renderTone, la frecuencia
// cambia con el tiempo, así que la fase no es frequency*t sino la integral de la frecuencia
// en el tiempo. Con un barrido lineal entre startFrequency y endFrequency, esa integral tiene
// forma cerrada: f0*t + (f1-f0)*t²/(2*duration).
function renderSweep({ shape, startFrequency, endFrequency, duration, amplitude = 0.5 }) {
  const sampleCount = Math.round(SAMPLE_RATE * duration);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / SAMPLE_RATE;
    const phaseAccum = startFrequency * t + ((endFrequency - startFrequency) * t * t) / (2 * duration);
    const phase = phaseAccum % 1;
    const value = waveform(shape, phase) * envelope(t, duration) * amplitude;
    samples[i] = Math.max(-1, Math.min(1, value)) * 32767;
  }
  return samples;
}

function concat(...chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function silence(duration) {
  return new Int16Array(Math.round(SAMPLE_RATE * duration));
}

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

const outDir = path.join(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(outDir, { recursive: true });

// Escalera de tono: abajo el más grave y, subiendo, izquierda, derecha y arriba.
// La regla es una sola y se aprende de golpe: cuanto más arriba está el pad, más agudo suena.
// Izquierda antes que derecha por el anclaje del teclado de piano (graves a la izquierda) y
// por la dirección de lectura; además izquierda y derecha están a media altura en la cruz, así
// que llevarse los tonos intermedios hace que altura de sonido y altura en pantalla coincidan
// en los cuatro casos.
// Las cuatro comparten forma de onda a propósito: con timbres distintos, una nota grave de
// sierra suena "más brillante" que una aguda de seno y la escalera grave->agudo deja de
// percibirse limpia. La redundancia no auditiva la siguen dando el háptico y el color.
// Triangular (y no seno) porque el altavoz del iPhone reproduce muy flojo por debajo de
// ~500 Hz: sus armónicos hacen audibles las notas graves.
// Notas alternando La y Mi (quintas/octavas): consonantes y con hueco amplio entre vecinas.
const directionTones = {
  down: { shape: 'triangle', frequency: 220.0, duration: 0.32 }, // A3 — el más grave
  left: { shape: 'triangle', frequency: 329.63, duration: 0.32 }, // E4
  right: { shape: 'triangle', frequency: 440.0, duration: 0.32 }, // A4
  up: { shape: 'triangle', frequency: 659.25, duration: 0.32 }, // E5 — el más agudo
};

for (const [direction, spec] of Object.entries(directionTones)) {
  writeWav(path.join(outDir, `tone-${direction}.wav`), renderTone(spec));
  console.log(`generado tone-${direction}.wav`);
}

// Fallo: dos avisos descendentes en cuadrada, patrón "womp-womp". Va entero por DEBAJO de la
// dirección más grave (A3, 220 Hz) a propósito: como el tono ya codifica la altura del pad,
// un sonido de error dentro de ese rango podría leerse un instante como una dirección más.
// Aquí queda fuera de la escalera, y además con otro timbre y en dos notas descendentes.
const failTone = concat(
  renderTone({ shape: 'square', frequency: 196.0, duration: 0.14, amplitude: 0.55 }), // G3
  silence(0.05),
  renderTone({ shape: 'square', frequency: 146.83, duration: 0.2, amplitude: 0.55 }), // D3
);
writeWav(path.join(outDir, 'tone-fail.wav'), failTone);
console.log('generado tone-fail.wav');

// Aviso de "ronda invertida": un barrido de agudo a grave, la metáfora sonora más directa de
// "hacia atrás" que hay. Nada más en el juego usa un barrido (todo lo demás son notas fijas),
// así que basta con que suene ESTO, sin decir nada, para que se note que algo es distinto.
// Mismo timbre (triangular) que las direcciones para que se sienta parte de la misma familia
// de sonidos y no como un elemento ajeno.
const reverseCue = renderSweep({
  shape: 'triangle',
  startFrequency: 900,
  endFrequency: 150,
  duration: 0.3,
  amplitude: 0.5,
});
writeWav(path.join(outDir, 'tone-reverse.wav'), reverseCue);
console.log('generado tone-reverse.wav');
