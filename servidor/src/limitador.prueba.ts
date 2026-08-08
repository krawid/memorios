import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crearLimitador } from './limitador.ts';

test('deja pasar hasta el límite y corta a partir de ahí', () => {
  const limitador = crearLimitador(3, 60_000);
  const t = 1_000;

  assert.equal(limitador.supera('1.1.1.1', t), false); // 1.ª
  assert.equal(limitador.supera('1.1.1.1', t), false); // 2.ª
  assert.equal(limitador.supera('1.1.1.1', t), false); // 3.ª
  assert.equal(limitador.supera('1.1.1.1', t), true); // 4.ª: se pasa
});

test('cada IP lleva su propia cuenta', () => {
  const limitador = crearLimitador(2, 60_000);
  const t = 1_000;

  limitador.supera('1.1.1.1', t);
  limitador.supera('1.1.1.1', t);
  assert.equal(limitador.supera('1.1.1.1', t), true, 'la primera IP ya se pasó');
  assert.equal(limitador.supera('2.2.2.2', t), false, 'la segunda IP no debe verse afectada');
});

test('la cuenta se reinicia al pasar la ventana', () => {
  const limitador = crearLimitador(2, 60_000);

  limitador.supera('1.1.1.1', 1_000);
  limitador.supera('1.1.1.1', 1_000);
  assert.equal(limitador.supera('1.1.1.1', 1_000), true);

  // Un minuto y pico después: ventana nueva, vuelve a contar desde cero.
  assert.equal(limitador.supera('1.1.1.1', 70_000), false);
});

test('no acumula IPs caducadas para siempre', () => {
  // Regresión de una fuga real: el Map crecía con cada IP nueva y no se vaciaba nunca.
  const limitador = crearLimitador(60, 60_000);

  for (let i = 0; i < 1_500; i++) {
    limitador.supera(`10.0.${Math.floor(i / 256)}.${i % 256}`, 1_000);
  }
  const antes = limitador.vigiladas();

  // Una petición mucho después dispara la limpieza de todo lo caducado.
  limitador.supera('9.9.9.9', 5_000_000);

  assert.ok(antes > 1_000, `esperaba muchas IPs vigiladas, había ${antes}`);
  assert.ok(
    limitador.vigiladas() < 10,
    `tras limpiar debería quedar casi nada, quedan ${limitador.vigiladas()}`,
  );
});

test('la limpieza no se lleva por delante las ventanas aún vivas', () => {
  const limitador = crearLimitador(60, 60_000);

  for (let i = 0; i < 1_500; i++) {
    limitador.supera(`10.0.${Math.floor(i / 256)}.${i % 256}`, 1_000);
  }
  // Misma ventana: nada ha caducado todavía, así que no debe borrarse nada.
  limitador.supera('9.9.9.9', 1_500);

  assert.ok(
    limitador.vigiladas() > 1_000,
    `no debería haber borrado nada vivo, quedan ${limitador.vigiladas()}`,
  );
});
