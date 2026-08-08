import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asignarPuestos, normalizarApodo, validarPuntuacion } from './validacion.ts';

// Los caracteres de control se escriben SIEMPRE con escape (, \n), nunca literales: como
// bytes de verdad son invisibles en el editor, y cualquier herramienta que toque el archivo los
// puede borrar dejando un test que aprueba sin comprobar nada.
const NULO = String.fromCharCode(0);
const CAMPANA = String.fromCharCode(7);
const SUPRIMIR = String.fromCharCode(127);

test('normalizarApodo recorta y colapsa espacios', () => {
  assert.equal(normalizarApodo('  Moisés   González  '), 'Moisés González');
});

test('normalizarApodo rechaza vacío, solo espacios y demasiado largo', () => {
  assert.equal(normalizarApodo(''), null);
  assert.equal(normalizarApodo('    '), null);
  assert.equal(normalizarApodo('a'.repeat(21)), null);
});

test('normalizarApodo rechaza caracteres de control', () => {
  // Un salto de línea dentro del apodo rompería la lista, y VoiceOver lee fatal estas cosas.
  assert.equal(normalizarApodo('Moi\nsés'), null);
  assert.equal(normalizarApodo(`Moi${NULO}sés`), null);
  assert.equal(normalizarApodo(`Moi${CAMPANA}sés`), null);
  assert.equal(normalizarApodo(`Moi${SUPRIMIR}sés`), null);
});

test('normalizarApodo acepta apodos normales, con tildes y eñes', () => {
  assert.equal(normalizarApodo('Agus'), 'Agus');
  assert.equal(normalizarApodo('Begoña'), 'Begoña');
});

test('validarPuntuacion acepta una puntuación correcta', () => {
  const r = validarPuntuacion({ jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui', rondas: 14 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.valor, { jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui', rondas: 14 });
});

test('validarPuntuacion rechaza modos inventados', () => {
  const r = validarPuntuacion({ jugadorId: 'abcd1234', apodo: 'Agus', modo: 'imposible', rondas: 3 });
  assert.equal(r.ok, false);
});

test('validarPuntuacion rechaza rondas absurdas, negativas o decimales', () => {
  const base = { jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui' };
  assert.equal(validarPuntuacion({ ...base, rondas: 9999 }).ok, false);
  assert.equal(validarPuntuacion({ ...base, rondas: -1 }).ok, false);
  assert.equal(validarPuntuacion({ ...base, rondas: 3.5 }).ok, false);
  assert.equal(validarPuntuacion({ ...base, rondas: '5' }).ok, false);
});

test('validarPuntuacion acepta 0 rondas (perder en la primera es un resultado válido)', () => {
  assert.equal(validarPuntuacion({ jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui', rondas: 0 }).ok, true);
});

test('validarPuntuacion rechaza identificadores raros o cortos', () => {
  const base = { apodo: 'Agus', modo: 'tranqui', rondas: 3 };
  assert.equal(validarPuntuacion({ ...base, jugadorId: 'corto' }).ok, false);
  assert.equal(validarPuntuacion({ ...base, jugadorId: 'con espacios!' }).ok, false);
});

test('validarPuntuacion rechaza lo que no sea un objeto', () => {
  assert.equal(validarPuntuacion(null).ok, false);
  assert.equal(validarPuntuacion('hola').ok, false);
});

test('asignarPuestos comparte el puesto en los empates', () => {
  const puestos = asignarPuestos([
    { jugadorId: 'a', apodo: 'A', rondas: 20 },
    { jugadorId: 'b', apodo: 'B', rondas: 14 },
    { jugadorId: 'c', apodo: 'C', rondas: 14 },
    { jugadorId: 'd', apodo: 'D', rondas: 9 },
  ]);

  // Dos empatados a 14 comparten el 2.º puesto, y el siguiente es 4.º (no 3.º).
  assert.deepEqual(
    puestos.map((p) => p.puesto),
    [1, 2, 2, 4],
  );
});

test('asignarPuestos con la lista vacía no revienta', () => {
  assert.deepEqual(asignarPuestos([]), []);
});
