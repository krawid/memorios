import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  asignarPuestos,
  compararMarcas,
  normalizarApodo,
  ordenarMarcas,
  validarPuntuacion,
  aPuestoPublico,
  type Marcas,
} from './validacion.ts';

// Los caracteres de control se construyen con fromCharCode, nunca se escriben literales: como
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

test('ordenarMarcas ordena de mayor a menor y rellena con ceros', () => {
  assert.deepEqual(ordenarMarcas([9, 12, 10]), [12, 10, 9]);
  assert.deepEqual(ordenarMarcas([12]), [12, 0, 0]);
  assert.deepEqual(ordenarMarcas([12, 10]), [12, 10, 0]);
});

test('ordenarMarcas rechaza listas vacías, largas o con valores no válidos', () => {
  assert.equal(ordenarMarcas([]), null);
  assert.equal(ordenarMarcas([1, 2, 3, 4]), null);
  assert.equal(ordenarMarcas([1, -2]), null);
  assert.equal(ordenarMarcas([1, 9999]), null);
  assert.equal(ordenarMarcas([1, 2.5]), null);
  assert.equal(ordenarMarcas(['12']), null);
  assert.equal(ordenarMarcas('12'), null);
});

test('compararMarcas desempata por la segunda marca', () => {
  const agus: Marcas = [12, 10, 9];
  const moises: Marcas = [12, 9, 9];
  assert.ok(compararMarcas(agus, moises) > 0);
  assert.ok(compararMarcas(moises, agus) < 0);
});

test('compararMarcas desempata por la tercera cuando la segunda también empata', () => {
  assert.ok(compararMarcas([12, 10, 9], [12, 10, 4]) > 0);
});

test('compararMarcas: quien solo ha jugado una vez queda por debajo con la misma mejor marca', () => {
  // El caso que motivó todo esto: mismo tope, pero uno lo ha repetido y el otro no.
  assert.ok(compararMarcas([12, 10, 9], [12, 0, 0]) > 0);
});

test('compararMarcas devuelve 0 solo si las tres coinciden (ahí decide la fecha)', () => {
  assert.equal(compararMarcas([12, 10, 9], [12, 10, 9]), 0);
});

test('validarPuntuacion acepta una puntuación correcta y ordena las marcas', () => {
  const r = validarPuntuacion({ jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui', marcas: [10, 14, 3] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.valor.marcas, [14, 10, 3]);
});

test('validarPuntuacion acepta una sola marca', () => {
  const r = validarPuntuacion({ jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui', marcas: [14] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.valor.marcas, [14, 0, 0]);
});

test('validarPuntuacion acepta 0 rondas (perder en la primera es un resultado válido)', () => {
  assert.equal(validarPuntuacion({ jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui', marcas: [0] }).ok, true);
});

test('validarPuntuacion rechaza modos inventados', () => {
  const r = validarPuntuacion({ jugadorId: 'abcd1234', apodo: 'Agus', modo: 'imposible', marcas: [3] });
  assert.equal(r.ok, false);
});

test('validarPuntuacion rechaza marcas absurdas, negativas o decimales', () => {
  const base = { jugadorId: 'abcd1234', apodo: 'Agus', modo: 'tranqui' };
  assert.equal(validarPuntuacion({ ...base, marcas: [9999] }).ok, false);
  assert.equal(validarPuntuacion({ ...base, marcas: [-1] }).ok, false);
  assert.equal(validarPuntuacion({ ...base, marcas: [3.5] }).ok, false);
  assert.equal(validarPuntuacion({ ...base, marcas: 5 }).ok, false);
});

test('validarPuntuacion rechaza identificadores raros o cortos', () => {
  const base = { apodo: 'Agus', modo: 'tranqui', marcas: [3] };
  assert.equal(validarPuntuacion({ ...base, jugadorId: 'corto' }).ok, false);
  assert.equal(validarPuntuacion({ ...base, jugadorId: 'con espacios!' }).ok, false);
});

test('validarPuntuacion rechaza lo que no sea un objeto', () => {
  assert.equal(validarPuntuacion(null).ok, false);
  assert.equal(validarPuntuacion('hola').ok, false);
});

test('asignarPuestos numera sin empates', () => {
  const puestos = asignarPuestos([
    { jugadorId: 'a', apodo: 'A', rondas: 12, marcas: [12, 10, 9] },
    { jugadorId: 'b', apodo: 'B', rondas: 12, marcas: [12, 9, 9] },
    { jugadorId: 'c', apodo: 'C', rondas: 12, marcas: [12, 0, 0] },
  ]);

  assert.deepEqual(
    puestos.map((p) => p.puesto),
    [1, 2, 3],
  );
});

test('asignarPuestos con la lista vacía no revienta', () => {
  assert.deepEqual(asignarPuestos([]), []);
});

test('aPuestoPublico NUNCA expone el jugadorId', () => {
  // Regresión de un agujero real: con el jugadorId en la clasificación pública, cualquiera
  // podía coger el de otro y renombrarlo. Si alguien vuelve a meterlo, este test lo caza.
  const publico = aPuestoPublico(
    { jugadorId: 'secreto-de-agus', apodo: 'Agus', rondas: 12, marcas: [12, 10, 9], puesto: 1 },
    null,
  );

  assert.equal('jugadorId' in publico, false);
  assert.equal(JSON.stringify(publico).includes('secreto-de-agus'), false);
});

test('aPuestoPublico marca eresTu solo para quien pregunta', () => {
  const fila = { jugadorId: 'soy-yo', apodo: 'Yo', rondas: 12, marcas: [12, 0, 0] as const, puesto: 1 };

  assert.equal(aPuestoPublico(fila, 'soy-yo').eresTu, true);
  assert.equal(aPuestoPublico(fila, 'es-otro').eresTu, false);
  assert.equal(aPuestoPublico(fila, null).eresTu, false);
});
